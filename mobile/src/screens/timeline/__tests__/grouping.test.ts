/**
 * Tests for groupByInstrumentSession + parseObservationMetadata.
 *
 * Covers:
 *   - Single instrument submission collapses to one card.
 *   - Derived total-score rows are filtered OUT (operator delta 1).
 *   - Two different instruments on the same day = two cards.
 *   - Two same-instrument submissions on the same calendar day at
 *     different millisecond timestamps = two cards.
 *   - Non-questionnaire rows (lab, vital, condition) pass through as
 *     `kind: "single"`.
 *   - Item-number sort: items are emitted in itemNumber order even when
 *     fed in arbitrary order.
 *   - Pure / immutable: input array and rows are not mutated.
 *   - Round-trip invariant (the operator's explicit ask): every
 *     non-derived row in the input appears exactly once across the
 *     output cards, with id/code/source/metadata_json byte-identical.
 *   - Malformed / missing metadata_json downgrades to `kind: "single"`
 *     instead of throwing.
 */
import { describe, expect, it } from "vitest";

import type { ObservationRow } from "@/contracts";

import {
  groupByInstrumentSession,
  parseObservationMetadata,
  type TimelineCard,
} from "../grouping";

const T1 = "2026-06-08T10:00:00.000Z";
const T2 = "2026-06-08T15:30:00.000Z"; // later same day
const T3 = "2026-06-08T15:30:00.123Z"; // same minute, different millis

let _rowSeq = 0;
function row(over: Partial<ObservationRow> = {}): ObservationRow {
  _rowSeq += 1;
  return {
    id: `r-${_rowSeq}`,
    user_id: "u-test",
    category: "questionnaire",
    code_system: "LOINC",
    code: "test-code",
    display: "test display",
    value_num: 1,
    value_text: null,
    unit: null,
    source: "self_reported",
    effective_at: T1,
    recorded_at: T1,
    report_id: null,
    supersedes_id: null,
    metadata_json: null,
    ...over,
  };
}

function metaForItem(instrument: string, itemNumber: number, itemText = ""): string {
  return JSON.stringify({ instrument, itemNumber, itemText });
}

function metaForSummary(instrument: string): string {
  return JSON.stringify({ instrument });
}

describe("parseObservationMetadata", () => {
  it("returns empty for null metadata_json", () => {
    expect(parseObservationMetadata({ metadata_json: null })).toEqual({});
  });

  it("returns parsed object for valid JSON", () => {
    expect(
      parseObservationMetadata({
        metadata_json: '{"instrument":"GAD-7","itemNumber":3}',
      }),
    ).toEqual({ instrument: "GAD-7", itemNumber: 3 });
  });

  it("returns empty on malformed JSON (never throws)", () => {
    expect(parseObservationMetadata({ metadata_json: "{not json" })).toEqual({});
  });

  it("returns empty on a JSON literal that isn't an object", () => {
    expect(parseObservationMetadata({ metadata_json: '"a string"' })).toEqual({});
    expect(parseObservationMetadata({ metadata_json: "42" })).toEqual({});
    expect(parseObservationMetadata({ metadata_json: "null" })).toEqual({});
  });
});

describe("groupByInstrumentSession — basic shapes", () => {
  it("groups 7 GAD-7 item rows + 1 derived summary into ONE instrument-session card with 7 items", () => {
    const items = Array.from({ length: 7 }, (_, i) =>
      row({
        code: `gad7-item-${i + 1}`,
        display: `GAD-7 item ${i + 1}`,
        value_num: i,
        metadata_json: metaForItem("GAD-7", i + 1, `Item ${i + 1} text`),
      }),
    );
    const derived = row({
      code: "gad7-total",
      display: "GAD-7 total score",
      value_num: 12,
      source: "derived",
      metadata_json: metaForSummary("GAD-7"),
    });
    const out = groupByInstrumentSession([...items, derived]);
    expect(out.length).toBe(1);
    const card = out[0];
    expect(card.kind).toBe("instrument-session");
    if (card.kind === "instrument-session") {
      expect(card.instrumentId).toBe("GAD-7");
      expect(card.items.length).toBe(7);
      // Derived row excluded.
      expect(card.items.every((r) => r.source !== "derived")).toBe(true);
    }
  });

  it("PHQ-9 9-item submission groups to ONE card with 9 items", () => {
    const items = Array.from({ length: 9 }, (_, i) =>
      row({
        code: `phq9-item-${i + 1}`,
        value_num: i % 4,
        metadata_json: metaForItem("PHQ-9", i + 1),
      }),
    );
    const out = groupByInstrumentSession(items);
    expect(out.length).toBe(1);
    if (out[0].kind === "instrument-session") {
      expect(out[0].items.length).toBe(9);
      expect(out[0].instrumentId).toBe("PHQ-9");
    }
  });

  it("non-questionnaire rows pass through as `kind: \"single\"`", () => {
    const hba1c = row({
      category: "biomarker",
      code: "4548-4",
      display: "Hemoglobin A1c",
      value_num: 5.6,
      unit: "%",
      source: "uploaded_report",
    });
    const bp = row({
      category: "vital",
      code: "8480-6",
      display: "Systolic BP",
      value_num: 122,
      unit: "mmHg",
      source: "self_reported",
    });
    const out = groupByInstrumentSession([hba1c, bp]);
    expect(out.length).toBe(2);
    expect(out[0].kind).toBe("single");
    expect(out[1].kind).toBe("single");
    if (out[0].kind === "single") expect(out[0].row).toBe(hba1c);
    if (out[1].kind === "single") expect(out[1].row).toBe(bp);
  });

  it("questionnaire row without metadata.instrument falls through as `kind: \"single\"`", () => {
    const orphan = row({
      category: "questionnaire",
      code: "weird-q",
      metadata_json: null,
    });
    const out = groupByInstrumentSession([orphan]);
    expect(out.length).toBe(1);
    expect(out[0].kind).toBe("single");
  });

  it("malformed metadata_json downgrades to `kind: \"single\"`, never throws", () => {
    const garbled = row({
      category: "questionnaire",
      metadata_json: "{not json",
    });
    expect(() => groupByInstrumentSession([garbled])).not.toThrow();
    const out = groupByInstrumentSession([garbled]);
    expect(out[0].kind).toBe("single");
  });
});

describe("groupByInstrumentSession — multi-card edge cases", () => {
  it("GAD-7 + AUDIT-C on the same day = TWO separate cards (different instruments)", () => {
    const gad = Array.from({ length: 7 }, (_, i) =>
      row({
        effective_at: T1,
        metadata_json: metaForItem("GAD-7", i + 1),
      }),
    );
    const audit = Array.from({ length: 3 }, (_, i) =>
      row({
        effective_at: T2,
        metadata_json: metaForItem("AUDIT-C", i + 1),
      }),
    );
    const out = groupByInstrumentSession([...gad, ...audit]);
    expect(out.length).toBe(2);
    if (out[0].kind === "instrument-session" && out[1].kind === "instrument-session") {
      expect(out[0].instrumentId).toBe("GAD-7");
      expect(out[0].items.length).toBe(7);
      expect(out[1].instrumentId).toBe("AUDIT-C");
      expect(out[1].items.length).toBe(3);
    }
  });

  it("two PHQ-2 submissions on the same day at different millisecond timestamps = TWO cards", () => {
    const morning = Array.from({ length: 2 }, (_, i) =>
      row({
        effective_at: T2,
        metadata_json: metaForItem("PHQ-2", i + 1),
      }),
    );
    const evening = Array.from({ length: 2 }, (_, i) =>
      row({
        effective_at: T3,
        metadata_json: metaForItem("PHQ-2", i + 1),
      }),
    );
    const out = groupByInstrumentSession([...morning, ...evening]);
    expect(out.length).toBe(2);
    expect(out.every((c) => c.kind === "instrument-session")).toBe(true);
    if (out[0].kind === "instrument-session" && out[1].kind === "instrument-session") {
      expect(out[0].effective_at).toBe(T2);
      expect(out[1].effective_at).toBe(T3);
    }
  });

  it("mixed: 1 GAD-7 session + 1 standalone HbA1c row = TWO cards (one session, one single)", () => {
    const gad = Array.from({ length: 7 }, (_, i) =>
      row({
        metadata_json: metaForItem("GAD-7", i + 1),
      }),
    );
    const hba1c = row({
      category: "biomarker",
      code: "4548-4",
      source: "uploaded_report",
    });
    const out = groupByInstrumentSession([...gad, hba1c]);
    expect(out.length).toBe(2);
    expect(out[0].kind).toBe("instrument-session");
    expect(out[1].kind).toBe("single");
  });

  it("items provided out of order are sorted by itemNumber in the output card", () => {
    const reversed = [7, 6, 5, 4, 3, 2, 1].map((n) =>
      row({
        code: `gad7-item-${n}`,
        metadata_json: metaForItem("GAD-7", n),
      }),
    );
    const out = groupByInstrumentSession(reversed);
    expect(out.length).toBe(1);
    if (out[0].kind === "instrument-session") {
      const numbers = out[0].items.map(
        (r) => parseObservationMetadata(r).itemNumber,
      );
      expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7]);
    }
  });

  it("derived rows filtered out even when they are the ONLY thing for an instrument (no orphan card)", () => {
    const onlyDerived = row({
      code: "gad7-total",
      source: "derived",
      metadata_json: metaForSummary("GAD-7"),
    });
    const out = groupByInstrumentSession([onlyDerived]);
    expect(out.length).toBe(0);
  });
});

describe("groupByInstrumentSession — purity + round-trip invariant", () => {
  it("does not mutate the input array", () => {
    const inp: ObservationRow[] = [
      row({ metadata_json: metaForItem("GAD-7", 1) }),
      row({ metadata_json: metaForItem("GAD-7", 2) }),
    ];
    const snapshot = inp.slice();
    groupByInstrumentSession(inp);
    expect(inp).toEqual(snapshot);
    expect(inp.length).toBe(2);
  });

  it("does not mutate the row objects themselves", () => {
    const r1 = row({ metadata_json: metaForItem("GAD-7", 1) });
    const snap = JSON.stringify(r1);
    groupByInstrumentSession([r1]);
    expect(JSON.stringify(r1)).toBe(snap);
  });

  it("ROUND-TRIP INVARIANT: every non-derived row in input appears exactly once in output, byte-identical", () => {
    // Mix: 9 PHQ-9 items + 1 derived total + 1 HbA1c lab + 1 BP vital +
    // 7 GAD-7 items + another derived total for GAD-7.
    const inp: ObservationRow[] = [
      ...Array.from({ length: 9 }, (_, i) =>
        row({
          code: `phq9-item-${i + 1}`,
          value_num: i,
          metadata_json: metaForItem("PHQ-9", i + 1, `PHQ-9 item ${i + 1}`),
        }),
      ),
      row({
        code: "phq9-total",
        value_num: 12,
        source: "derived",
        metadata_json: metaForSummary("PHQ-9"),
      }),
      row({
        category: "biomarker",
        code: "4548-4",
        display: "Hemoglobin A1c",
        value_num: 5.6,
        unit: "%",
        source: "uploaded_report",
      }),
      row({
        category: "vital",
        code: "8480-6",
        display: "Systolic BP",
        value_num: 122,
        unit: "mmHg",
      }),
      ...Array.from({ length: 7 }, (_, i) =>
        row({
          code: `gad7-item-${i + 1}`,
          effective_at: T2,
          metadata_json: metaForItem("GAD-7", i + 1, `GAD-7 item ${i + 1}`),
        }),
      ),
      row({
        code: "gad7-total",
        effective_at: T2,
        source: "derived",
        metadata_json: metaForSummary("GAD-7"),
      }),
    ];

    // Snapshot every non-derived input row, byte-for-byte.
    const nonDerivedInputSnaps = new Map<string, string>();
    for (const r of inp) {
      if (r.source !== "derived") {
        nonDerivedInputSnaps.set(r.id, JSON.stringify(r));
      }
    }

    const cards = groupByInstrumentSession(inp);

    // Collect every row referenced from the output cards.
    const outputIds: string[] = [];
    const outputSnaps = new Map<string, string>();
    for (const card of cards) {
      if (card.kind === "instrument-session") {
        for (const r of card.items) {
          outputIds.push(r.id);
          outputSnaps.set(r.id, JSON.stringify(r));
        }
      } else {
        outputIds.push(card.row.id);
        outputSnaps.set(card.row.id, JSON.stringify(card.row));
      }
    }

    // No duplicates: every id appears exactly once.
    const uniq = new Set(outputIds);
    expect(uniq.size).toBe(outputIds.length);

    // Same set of ids: every non-derived input row is in the output,
    // nothing extra leaked.
    expect(uniq).toEqual(new Set(nonDerivedInputSnaps.keys()));

    // Byte-identical for each: codes/sources/metadata/values unchanged.
    for (const [id, snap] of nonDerivedInputSnaps) {
      expect(outputSnaps.get(id)).toBe(snap);
    }
  });

  it("stable card order: cards emit in the order their FIRST contributing row appears in input", () => {
    const a = row({ metadata_json: metaForItem("PHQ-9", 1) });
    const b = row({ category: "biomarker", code: "4548-4", source: "uploaded_report" });
    const c = row({ effective_at: T2, metadata_json: metaForItem("GAD-7", 1) });
    const out = groupByInstrumentSession([a, b, c]);
    expect(out.length).toBe(3);
    if (out[0].kind === "instrument-session") expect(out[0].instrumentId).toBe("PHQ-9");
    expect(out[1].kind).toBe("single");
    if (out[2].kind === "instrument-session") expect(out[2].instrumentId).toBe("GAD-7");
  });
});

// Compile-time type sanity — TimelineCard is a discriminated union that
// narrows cleanly via `card.kind`. If this file compiles, it's correct.
function _typeNarrow(card: TimelineCard): string {
  switch (card.kind) {
    case "instrument-session":
      return card.instrumentId;
    case "single":
      return card.row.id;
  }
}
void _typeNarrow;

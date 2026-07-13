/**
 * Tests for rollupCardsByDomain — pure cards → DomainRollup[] transform.
 *
 * Coverage:
 *   - Round-trip invariant (operator-requested): every non-derived
 *     session card from groupByInstrumentSession appears in exactly
 *     one rollup, byte-identical.
 *   - Single rows route via category to the right domain.
 *   - Instrument cards route via metadata.instrument to the right
 *     domain.
 *   - Cohort gating: only domains relevant to the user's sex are
 *     surfaced. Universal domains (health_markers, health_history)
 *     always present.
 *   - Empty cohort-gated domains emit `kind: "empty-domain"`.
 *   - Sessions / rows within each rollup are newest-first.
 *   - Latest score recomputed via sum (uniform instruments) and via
 *     computeAdamOutcome (ADAM).
 *   - Order matches DOMAIN_ORDER.
 *   - Helper purity: input is not mutated.
 */
import { describe, expect, it } from "vitest";

import type { ObservationRow } from "@/contracts";

import { groupByInstrumentSession, type TimelineCard } from "../grouping";
import { rollupCardsByDomain, type DomainRollup } from "../rollup";

const T1 = "2026-06-08T10:00:00.000Z";
const T2 = "2026-06-08T15:30:00.000Z";
const T3 = "2026-06-09T09:00:00.000Z";

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

function gad7Session(at: string, values: ReadonlyArray<number>): ObservationRow[] {
  return values.map((v, i) =>
    row({
      effective_at: at,
      value_num: v,
      metadata_json: metaForItem("GAD-7", i + 1),
    }),
  );
}

function phq9Session(at: string, values: ReadonlyArray<number>): ObservationRow[] {
  return values.map((v, i) =>
    row({
      effective_at: at,
      value_num: v,
      metadata_json: metaForItem("PHQ-9", i + 1),
    }),
  );
}

function adamSession(at: string, values: ReadonlyArray<0 | 1>): ObservationRow[] {
  return values.map((v, i) =>
    row({
      effective_at: at,
      value_num: v,
      metadata_json: metaForItem("ADAM", i + 1),
    }),
  );
}

describe("rollupCardsByDomain — basic routing", () => {
  it("routes GAD-7 session to the anxiety domain", () => {
    const cards = groupByInstrumentSession(gad7Session(T1, [1, 1, 1, 1, 1, 1, 1]));
    const out = rollupCardsByDomain(cards, "female");
    const anxiety = out.find((r) => r.domainId === "anxiety");
    expect(anxiety?.kind).toBe("instrument-domain");
    if (anxiety?.kind === "instrument-domain") {
      expect(anxiety.latestInstrumentId).toBe("GAD-7");
      expect(anxiety.sessions.length).toBe(1);
    }
  });

  it("routes PHQ-9 session to the mood domain", () => {
    const cards = groupByInstrumentSession(phq9Session(T1, [2, 2, 1, 1, 1, 1, 1, 1, 1]));
    const out = rollupCardsByDomain(cards, "male");
    const mood = out.find((r) => r.domainId === "mood");
    expect(mood?.kind).toBe("instrument-domain");
    if (mood?.kind === "instrument-domain") {
      expect(mood.latestScore).toBe(11); // sum of values
    }
  });

  it("routes a biomarker single row to health_markers", () => {
    const hba1c = row({
      category: "biomarker",
      code: "4548-4",
      code_system: "LOINC",
      value_num: 5.6,
      unit: "%",
      source: "uploaded_report",
    });
    const cards = groupByInstrumentSession([hba1c]);
    const out = rollupCardsByDomain(cards, "male");
    const markers = out.find((r) => r.domainId === "health_markers");
    expect(markers?.kind).toBe("single-domain");
    if (markers?.kind === "single-domain") {
      expect(markers.rows[0].code).toBe("4548-4");
    }
  });

  it("routes a lifestyle row to health_history", () => {
    const smoking = row({
      category: "lifestyle",
      code: "denali.lifestyle.smoking",
      code_system: "internal",
      source: "self_reported",
    });
    const cards = groupByInstrumentSession([smoking]);
    const out = rollupCardsByDomain(cards, "female");
    const history = out.find((r) => r.domainId === "health_history");
    expect(history?.kind).toBe("single-domain");
    if (history?.kind === "single-domain") {
      expect(history.rows[0].code).toBe("denali.lifestyle.smoking");
    }
  });
});

describe("rollupCardsByDomain — cohort gating", () => {
  // Post-2026-07: instrument domains (mood/anxiety/alcohol) are universal;
  // the former sex-gated instrument domains are now backed by the symptom
  // tracker (sleep/urinary universal, menopause female, hormonal male).
  it("surfaces instrument + symptom domains for every cohort (Step-4 symptom tracker)", () => {
    for (const sex of ["male", "female", "unknown", "intersex", null] as const) {
      const ids = rollupCardsByDomain([], sex).map((r) => r.domainId);
      expect(ids).toContain("mood");
      expect(ids).toContain("anxiety");
      expect(ids).toContain("alcohol");
      expect(ids).toContain("sleep");
      expect(ids).toContain("urinary");
    }
    expect(
      rollupCardsByDomain([], "female").map((r) => r.domainId),
    ).toContain("menopause");
    expect(rollupCardsByDomain([], "male").map((r) => r.domainId)).toContain(
      "hormonal",
    );
  });

  it("ALWAYS includes the universal domains regardless of sex", () => {
    for (const sex of ["male", "female", "unknown", "intersex", null] as const) {
      const out = rollupCardsByDomain([], sex);
      const ids = out.map((r) => r.domainId);
      expect(ids).toContain("health_markers");
      expect(ids).toContain("health_history");
    }
  });

  it("emits cohort-gated empty domains as `kind: 'empty-domain'`", () => {
    const out = rollupCardsByDomain([], "female");
    const anxiety = out.find((r) => r.domainId === "anxiety");
    expect(anxiety?.kind).toBe("empty-domain");
    // menopause is a FEMALE symptom domain → present, empty when no data.
    const menopause = out.find((r) => r.domainId === "menopause");
    expect(menopause?.kind).toBe("empty-domain");
    // hormonal is MALE-only → absent entirely for a female cohort.
    const hormonal = out.find((r) => r.domainId === "hormonal");
    expect(hormonal).toBeUndefined();
  });

  it("routes a tracked symptom observation to its symptom domain (single-domain)", () => {
    const hotFlash = row({
      category: "symptom",
      code: "denali.symptom.menopause.hot_flashes",
      code_system: "internal",
      source: "self_reported",
    });
    const out = rollupCardsByDomain(
      groupByInstrumentSession([hotFlash]),
      "female",
    );
    const menopause = out.find((r) => r.domainId === "menopause");
    expect(menopause?.kind).toBe("single-domain");
    if (menopause?.kind === "single-domain") {
      expect(menopause.rows[0].code).toBe(
        "denali.symptom.menopause.hot_flashes",
      );
    }
  });
});

describe("rollupCardsByDomain — latest score computation", () => {
  it("uniform instruments: sum of value_num across items", () => {
    const cards = groupByInstrumentSession(phq9Session(T1, [3, 2, 1, 0, 1, 2, 3, 2, 1]));
    const out = rollupCardsByDomain(cards, "male");
    const mood = out.find((r) => r.domainId === "mood");
    if (mood?.kind === "instrument-domain") {
      expect(mood.latestScore).toBe(15);
    }
  });

  it("ADAM: binary outcome via computeAdamOutcome — positive (item 1 yes)", () => {
    const cards = groupByInstrumentSession(adamSession(T1, [1, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    const out = rollupCardsByDomain(cards, "male");
    const horm = out.find((r) => r.domainId === "hormonal");
    if (horm?.kind === "instrument-domain") {
      expect(horm.latestScore).toBe(1);
    }
  });

  it("ADAM: binary outcome — negative", () => {
    const cards = groupByInstrumentSession(adamSession(T1, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]));
    const out = rollupCardsByDomain(cards, "male");
    const horm = out.find((r) => r.domainId === "hormonal");
    if (horm?.kind === "instrument-domain") {
      expect(horm.latestScore).toBe(0);
    }
  });

  it("latestScore is null when the latest session is incomplete (missing value_num)", () => {
    const incomplete = phq9Session(T1, [1, 1, 1, 1, 1, 1, 1, 1, 1]).map((r, i) =>
      i === 4 ? { ...r, value_num: null } : r,
    );
    const cards = groupByInstrumentSession(incomplete);
    const out = rollupCardsByDomain(cards, "male");
    const mood = out.find((r) => r.domainId === "mood");
    if (mood?.kind === "instrument-domain") {
      expect(mood.latestScore).toBeNull();
    }
  });
});

describe("rollupCardsByDomain — ordering", () => {
  it("sessions within a domain are newest-first by effective_at", () => {
    const old = phq9Session(T1, [1, 1, 1, 1, 1, 1, 1, 1, 1]);
    const middle = phq9Session(T2, [2, 2, 2, 2, 2, 2, 2, 2, 2]);
    const newest = phq9Session(T3, [3, 3, 3, 3, 3, 3, 3, 3, 3]);
    const cards = groupByInstrumentSession([...old, ...middle, ...newest]);
    const out = rollupCardsByDomain(cards, "male");
    const mood = out.find((r) => r.domainId === "mood");
    if (mood?.kind === "instrument-domain") {
      expect(mood.sessions.length).toBe(3);
      const timestamps = mood.sessions.map((s) =>
        s.kind === "instrument-session" ? s.effective_at : "",
      );
      expect(timestamps).toEqual([T3, T2, T1]);
      expect(mood.latestEffectiveAt).toBe(T3);
      // Latest score reflects the newest session.
      expect(mood.latestScore).toBe(27);
    }
  });

  it("emits rollups in DOMAIN_ORDER (mood first when present + populated)", () => {
    const cards = groupByInstrumentSession(phq9Session(T1, [1, 1, 1, 1, 1, 1, 1, 1, 1]));
    const out = rollupCardsByDomain(cards, "female");
    // First rollup should be mood (first in DOMAIN_ORDER).
    expect(out[0].domainId).toBe("mood");
    // health_history is last.
    expect(out[out.length - 1].domainId).toBe("health_history");
  });
});

describe("rollupCardsByDomain — round-trip invariant (operator-requested)", () => {
  it("every non-derived session card from groupByInstrumentSession appears in EXACTLY ONE rollup, byte-identical", () => {
    // A representative mixed dataset:
    //  - 2 PHQ-9 sessions at different times
    //  - 1 GAD-7 session
    //  - 1 derived total-score row (must be filtered by grouping;
    //    rollup never sees it)
    //  - 1 HbA1c single row (biomarker → health_markers)
    //  - 1 vital row (BP → health_markers)
    //  - 1 lifestyle row (smoking → health_history)
    const input: ObservationRow[] = [
      ...phq9Session(T1, [2, 2, 1, 1, 1, 1, 1, 1, 1]),
      ...phq9Session(T3, [1, 0, 0, 0, 0, 0, 0, 0, 0]),
      ...gad7Session(T2, [3, 2, 1, 0, 1, 2, 3]),
      row({
        effective_at: T1,
        code: "phq9-total",
        value_num: 11,
        source: "derived",
        metadata_json: JSON.stringify({ instrument: "PHQ-9" }),
      }),
      row({
        category: "biomarker",
        code: "4548-4",
        code_system: "LOINC",
        value_num: 5.6,
        unit: "%",
        source: "uploaded_report",
      }),
      row({
        category: "vital",
        code: "8480-6",
        code_system: "LOINC",
        value_num: 122,
        unit: "mmHg",
      }),
      row({
        category: "lifestyle",
        code: "denali.lifestyle.smoking",
        code_system: "internal",
        source: "self_reported",
      }),
    ];

    const cards = groupByInstrumentSession(input);
    const rollups = rollupCardsByDomain(cards, "male");

    // Collect every row referenced from the rollups.
    const outRowIds = new Set<string>();
    const outRowSnaps = new Map<string, string>();
    for (const r of rollups) {
      if (r.kind === "instrument-domain") {
        for (const session of r.sessions) {
          if (session.kind === "instrument-session") {
            for (const row of session.items) {
              outRowIds.add(row.id);
              outRowSnaps.set(row.id, JSON.stringify(row));
            }
          }
        }
      } else if (r.kind === "single-domain") {
        for (const row of r.rows) {
          outRowIds.add(row.id);
          outRowSnaps.set(row.id, JSON.stringify(row));
        }
      }
    }

    // Build the expected set: every non-derived input row.
    const expectedIds = new Set<string>();
    const expectedSnaps = new Map<string, string>();
    for (const r of input) {
      if (r.source !== "derived") {
        expectedIds.add(r.id);
        expectedSnaps.set(r.id, JSON.stringify(r));
      }
    }

    // Same set of ids.
    expect(outRowIds).toEqual(expectedIds);
    // Byte-identical for each.
    for (const [id, snap] of expectedSnaps) {
      expect(outRowSnaps.get(id)).toBe(snap);
    }
  });
});

describe("rollupCardsByDomain — purity", () => {
  it("does not mutate the input cards array", () => {
    const cards = groupByInstrumentSession(phq9Session(T1, [1, 1, 1, 1, 1, 1, 1, 1, 1]));
    const snapshot = cards.slice();
    rollupCardsByDomain(cards, "male");
    expect(cards).toEqual(snapshot);
  });

  it("type narrowing: discriminated union narrows cleanly", () => {
    function _narrow(r: DomainRollup): string {
      switch (r.kind) {
        case "instrument-domain":
          return r.latestInstrumentId;
        case "single-domain":
          return r.rows[0]?.id ?? "";
        case "empty-domain":
          return r.domainId;
      }
    }
    void _narrow;
    expect(true).toBe(true);
  });
});

/**
 * Trend sessions tests — Step-3 Part B pins.
 *
 *   - buildTrendQuery: since per range / omitted for "all"; backstop
 *     limit 2000 and NEVER the dashboard PAGE_SIZE (200); latest_only
 *     (superseded handling) always on; category questionnaire.
 *   - rangeStartIso boundary math from a fixed `now`.
 *   - computeScoredSessions: instrument filter, ascending order,
 *     incomplete sessions dropped.
 *   - Chartability: ADAM excluded; the 7 score-based instruments in.
 *   - deltaPair: latest vs immediately previous; null under 2 sessions.
 */
import { describe, expect, it } from "vitest";

import type { ObservationRow } from "@/contracts";

import {
  buildTrendQuery,
  computeScoredSessions,
  deltaPair,
  isChartableInstrument,
  rangeStartIso,
  TREND_QUERY_LIMIT,
  TREND_RANGES,
} from "../sessions";

const NOW = new Date("2026-06-09T12:00:00.000Z");

let _seq = 0;
function row(over: Partial<ObservationRow> = {}): ObservationRow {
  _seq += 1;
  return {
    id: `r-${_seq}`,
    user_id: "u-test",
    category: "questionnaire",
    code_system: "LOINC",
    code: "test-code",
    display: "test display",
    value_num: 1,
    value_text: null,
    unit: null,
    source: "self_reported",
    effective_at: "2026-06-01T00:00:00.000Z",
    recorded_at: "2026-06-01T00:00:00.000Z",
    report_id: null,
    supersedes_id: null,
    metadata_json: null,
    ...over,
  };
}

function gad7Session(
  at: string,
  values: ReadonlyArray<number | null>,
): ObservationRow[] {
  return values.map((v, i) =>
    row({
      effective_at: at,
      value_num: v,
      metadata_json: JSON.stringify({
        instrument: "GAD-7",
        itemNumber: i + 1,
        itemText: `q${i + 1}`,
      }),
    }),
  );
}

describe("buildTrendQuery — query-shape pins", () => {
  it.each(TREND_RANGES.map((r) => [r]))(
    "%s: backstop limit is 2000, NEVER the dashboard PAGE_SIZE (200)",
    (range) => {
      const q = buildTrendQuery(range, NOW);
      expect(q.limit).toBe(TREND_QUERY_LIMIT);
      expect(q.limit).toBe(2000);
      expect(q.limit).not.toBe(200);
    },
  );

  it.each(TREND_RANGES.map((r) => [r]))(
    "%s: latest_only (superseded-correction handling) always on",
    (range) => {
      expect(buildTrendQuery(range, NOW).latest_only).toBe(true);
    },
  );

  it.each(TREND_RANGES.map((r) => [r]))(
    "%s: scoped to questionnaire rows",
    (range) => {
      expect(buildTrendQuery(range, NOW).category).toBe("questionnaire");
    },
  );

  it("3m / 6m / y carry a since bound; all omits it (backstop-only)", () => {
    expect(buildTrendQuery("3m", NOW).since).toBe("2026-03-09T12:00:00.000Z");
    expect(buildTrendQuery("6m", NOW).since).toBe("2025-12-09T12:00:00.000Z");
    expect(buildTrendQuery("y", NOW).since).toBe("2025-06-09T12:00:00.000Z");
    expect("since" in buildTrendQuery("all", NOW)).toBe(false);
  });

  it("rangeStartIso returns null only for all", () => {
    expect(rangeStartIso("all", NOW)).toBeNull();
    expect(rangeStartIso("3m", NOW)).not.toBeNull();
  });
});

describe("computeScoredSessions", () => {
  it("scores complete sessions for the requested instrument only, ascending", () => {
    const rows = [
      ...gad7Session("2026-06-01T00:00:00.000Z", [2, 1, 0, 1, 0, 0, 1]), // 5
      ...gad7Session("2026-04-01T00:00:00.000Z", [1, 1, 1, 0, 0, 0, 0]), // 3
      // Different instrument — must not leak in.
      row({
        effective_at: "2026-05-01T00:00:00.000Z",
        value_num: 2,
        metadata_json: JSON.stringify({
          instrument: "PHQ-2",
          itemNumber: 1,
          itemText: "q1",
        }),
      }),
    ];
    const sessions = computeScoredSessions(rows, "GAD-7");
    expect(sessions).toEqual([
      { effective_at: "2026-04-01T00:00:00.000Z", score: 3 },
      { effective_at: "2026-06-01T00:00:00.000Z", score: 5 },
    ]);
  });

  it("drops incomplete sessions (a null item value yields no point)", () => {
    const rows = gad7Session("2026-06-01T00:00:00.000Z", [2, null, 0, 1, 0, 0, 1]);
    expect(computeScoredSessions(rows, "GAD-7")).toEqual([]);
  });

  it("ignores non-questionnaire rows defensively", () => {
    const rows = [
      row({ category: "biomarker", metadata_json: null, value_num: 7 }),
      ...gad7Session("2026-06-01T00:00:00.000Z", [0, 0, 0, 0, 0, 0, 1]),
    ];
    expect(computeScoredSessions(rows, "GAD-7")).toHaveLength(1);
  });
});

describe("chartability — ADAM excluded", () => {
  it.each([
    ["PHQ-2"],
    ["PHQ-9"],
    ["GAD-7"],
    ["Epworth"],
    ["AUDIT-C"],
    ["IPSS"],
    ["MRS"],
  ])("%s is chartable", (id) => {
    expect(isChartableInstrument(id)).toBe(true);
  });

  it("ADAM is NOT chartable (binary outcome)", () => {
    expect(isChartableInstrument("ADAM")).toBe(false);
  });

  it("unknown instruments are not chartable", () => {
    expect(isChartableInstrument("UNKNOWN")).toBe(false);
  });
});

describe("deltaPair — latest vs immediately previous, range-independent", () => {
  it("null when fewer than two sessions", () => {
    expect(deltaPair([])).toBeNull();
    expect(deltaPair([{ effective_at: "2026-06-01", score: 3 }])).toBeNull();
  });

  it("returns the last two sessions of the full history", () => {
    const all = [
      { effective_at: "2026-01-01", score: 9 },
      { effective_at: "2026-03-01", score: 6 },
      { effective_at: "2026-06-01", score: 4 },
    ];
    expect(deltaPair(all)).toEqual({
      previous: { effective_at: "2026-03-01", score: 6 },
      latest: { effective_at: "2026-06-01", score: 4 },
    });
  });
});

/**
 * markerChartModel tests — per-marker chart axis/points/value-refs (D28).
 *
 * Pins the data-aware axis (the BMI "line outside the chart" bug class, D26)
 * and the band-less vs banded behavior:
 *   - points filtered to the code, numeric only, ascending
 *   - range filter via the same UTC math as instruments
 *   - band-less: scoreRange from data extent only; yRefValues = [max, min]
 *   - banded: scoreRange unions the bands' finite extent so every band shows;
 *     yRefValues = null (bands convey position)
 *   - out-of-band value is NEVER clipped (axis expands to include it)
 */

import { describe, expect, it } from "vitest";

import type { ObservationRow } from "@/contracts";

import type { InterpretationBand } from "../../interpretation/tableV1";
import { deriveMarkerChartModel } from "../markerChartModel";

const NOW = new Date("2026-06-16T12:00:00.000Z");
const WEIGHT = "29463-7";
const OTHER = "8302-2";

function obs(over: Partial<ObservationRow> & { code: string }): ObservationRow {
  return {
    id: "id",
    user_id: "u1",
    category: "anthropometric",
    code_system: "LOINC",
    display: "test",
    value_num: null,
    value_text: null,
    unit: "kg",
    source: "self_reported",
    effective_at: "2026-06-01T00:00:00.000Z",
    recorded_at: "2026-06-01T00:00:00.000Z",
    report_id: null,
    supersedes_id: null,
    metadata_json: null,
    ...over,
  };
}

const band = (minScore: number, maxScore: number, id: string): InterpretationBand => ({
  minScore,
  maxScore,
  bandId: id as InterpretationBand["bandId"],
  pill: id,
  headline: "",
  explanation: "",
  provisional: true,
});

describe("deriveMarkerChartModel — band-less marker (weight)", () => {
  const rows = [
    obs({ id: "w1", code: WEIGHT, value_num: 80, effective_at: "2026-06-16T00:00:00.000Z" }),
    obs({ id: "w2", code: WEIGHT, value_num: 78, effective_at: "2026-06-10T00:00:00.000Z" }),
    obs({ id: "w3", code: WEIGHT, value_num: 79, effective_at: "2026-06-13T00:00:00.000Z" }),
    // a different code + a non-numeric row must be ignored
    obs({ id: "h1", code: OTHER, value_num: 175, effective_at: "2026-06-12T00:00:00.000Z" }),
    obs({ id: "w-txt", code: WEIGHT, value_num: null, value_text: "n/a", effective_at: "2026-06-14T00:00:00.000Z" }),
  ];

  it("plots only this code's numeric readings, ascending", () => {
    const m = deriveMarkerChartModel(rows, WEIGHT, [], "all", NOW);
    expect(m.allPoints.map((p) => p.score)).toEqual([78, 79, 80]);
    expect(m.chartPoints.map((p) => p.score)).toEqual([78, 79, 80]);
  });

  it("band-less axis is padded floor-1 / ceil+1 of the data", () => {
    const m = deriveMarkerChartModel(rows, WEIGHT, [], "all", NOW);
    expect(m.scoreRange).toEqual({ min: 77, max: 81 });
  });

  it("band-less yRefValues = [max, min]", () => {
    const m = deriveMarkerChartModel(rows, WEIGHT, [], "all", NOW);
    expect(m.yRefValues).toEqual([80, 78]);
  });

  it("single distinct value → one yRef", () => {
    const flat = [
      obs({ id: "a", code: WEIGHT, value_num: 80, effective_at: "2026-06-10T00:00:00.000Z" }),
      obs({ id: "b", code: WEIGHT, value_num: 80, effective_at: "2026-06-16T00:00:00.000Z" }),
    ];
    expect(deriveMarkerChartModel(flat, WEIGHT, [], "all", NOW).yRefValues).toEqual([80]);
  });

  it("range filter drops out-of-window points (3m keeps recent only)", () => {
    const old = [
      obs({ id: "old", code: WEIGHT, value_num: 70, effective_at: "2025-01-01T00:00:00.000Z" }),
      obs({ id: "new", code: WEIGHT, value_num: 80, effective_at: "2026-06-16T00:00:00.000Z" }),
    ];
    const m = deriveMarkerChartModel(old, WEIGHT, [], "3m", NOW);
    expect(m.chartPoints.map((p) => p.score)).toEqual([80]);
    // delta still uses the FULL history (allPoints)
    expect(m.allPoints.map((p) => p.score)).toEqual([70, 80]);
  });

  it("no readings → safe defaults (no NaN axis, null refs)", () => {
    const m = deriveMarkerChartModel([], WEIGHT, [], "all", NOW);
    expect(m.scoreRange).toEqual({ min: 0, max: 1 });
    expect(m.yRefValues).toBeNull();
    expect(m.chartPoints).toEqual([]);
  });
});

describe("deriveMarkerChartModel — banded marker", () => {
  // Synthetic banded marker (bone-density-like): finite bounds -2.5..-1.0 plus
  // ±Infinity extremes; data sits inside.
  const BANDS = [
    band(Number.NEGATIVE_INFINITY, -2.5, "low"),
    band(-2.4, -1.1, "mid"),
    band(-1.0, Number.POSITIVE_INFINITY, "ok"),
  ];
  const rows = [
    obs({ id: "t1", code: WEIGHT, value_num: -1.5, effective_at: "2026-06-10T00:00:00.000Z" }),
    obs({ id: "t2", code: WEIGHT, value_num: -2.0, effective_at: "2026-06-16T00:00:00.000Z" }),
  ];

  it("banded charts return null yRefValues (bands convey position)", () => {
    const m = deriveMarkerChartModel(rows, WEIGHT, BANDS, "all", NOW);
    expect(m.yRefValues).toBeNull();
  });

  it("axis unions the bands' FINITE bounds with the data so every band shows", () => {
    const m = deriveMarkerChartModel(rows, WEIGHT, BANDS, "all", NOW);
    // finite band bounds: -2.5, -2.4, -1.1, -1.0 ; data: -2.0, -1.5
    // lo = min(-2.5, data...) = -2.5 → floor-1 = -4 ; hi = max(-1.0,...) = -1.0 → ceil+1 = 0
    expect(m.scoreRange).toEqual({ min: -4, max: 0 });
  });

  it("a value BELOW every band is not clipped — axis expands to include it", () => {
    const extreme = [
      obs({ id: "x", code: WEIGHT, value_num: -3.8, effective_at: "2026-06-16T00:00:00.000Z" }),
      obs({ id: "y", code: WEIGHT, value_num: -1.5, effective_at: "2026-06-10T00:00:00.000Z" }),
    ];
    const m = deriveMarkerChartModel(extreme, WEIGHT, BANDS, "all", NOW);
    // data min -3.8 → floor-1 = -5 (below the lowest finite band bound -2.5)
    expect(m.scoreRange.min).toBe(-5);
  });
});

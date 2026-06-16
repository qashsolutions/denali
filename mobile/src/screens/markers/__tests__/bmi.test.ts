/**
 * BMI derivation tests — provability for the pure helper.
 *
 * Tests cover:
 *   - Correct formula: bmi = weightKg / (heightM)²
 *   - Missing height → null (never a guess)
 *   - Missing weight → null (never a guess)
 *   - Both missing → null
 *   - Zero-guard (height = 0 → null)
 *   - Uses LATEST height and weight observations when multiple exist
 *   - effectiveAt = the LATER of the two source timestamps
 *   - source is always "derived"
 *   - deriveBmiTrend: returns chronological snapshots, propagates last-known
 *     height/weight, returns [] when <2 snapshots
 */

import { describe, expect, it } from "vitest";

import type { ObservationRow } from "@/contracts";

import {
  deriveBmi,
  deriveBmiTrend,
  LOINC_BMI,
  LOINC_HEIGHT,
  LOINC_WEIGHT,
} from "../bmi";

// ─── helpers ─────────────────────────────────────────────────────────────────

function makeObs(
  overrides: Partial<ObservationRow> & { code: string },
): ObservationRow {
  return {
    id: "test-id",
    user_id: "u1",
    category: "anthropometric",
    code_system: "LOINC",
    display: "test",
    value_num: null,
    value_text: null,
    unit: null,
    source: "self_reported",
    effective_at: "2026-06-01T00:00:00.000Z",
    recorded_at: "2026-06-01T00:00:00.000Z",
    report_id: null,
    supersedes_id: null,
    metadata_json: null,
    ...overrides,
  };
}

const HEIGHT_170 = makeObs({
  id: "h1",
  code: LOINC_HEIGHT,
  value_num: 170, // cm
  unit: "cm",
  effective_at: "2026-05-01T00:00:00.000Z",
});

const WEIGHT_70 = makeObs({
  id: "w1",
  code: LOINC_WEIGHT,
  value_num: 70, // kg
  unit: "kg",
  effective_at: "2026-06-01T00:00:00.000Z",
});

// ─── deriveBmi ────────────────────────────────────────────────────────────────

describe("deriveBmi", () => {
  it("computes BMI correctly: 70 kg / (1.70 m)² ≈ 24.2", () => {
    const result = deriveBmi([HEIGHT_170, WEIGHT_70]);
    expect(result).not.toBeNull();
    expect(result!.bmi).toBeCloseTo(24.2, 1);
  });

  it("returns null when height is missing", () => {
    expect(deriveBmi([WEIGHT_70])).toBeNull();
  });

  it("returns null when weight is missing", () => {
    expect(deriveBmi([HEIGHT_170])).toBeNull();
  });

  it("returns null when both are missing", () => {
    expect(deriveBmi([])).toBeNull();
  });

  it("returns null when height value_num is null", () => {
    const nullHeight = makeObs({ id: "h0", code: LOINC_HEIGHT, value_num: null });
    expect(deriveBmi([nullHeight, WEIGHT_70])).toBeNull();
  });

  it("returns null when weight value_num is null", () => {
    const nullWeight = makeObs({ id: "w0", code: LOINC_WEIGHT, value_num: null });
    expect(deriveBmi([HEIGHT_170, nullWeight])).toBeNull();
  });

  it("returns null when height is zero (guards against Infinity)", () => {
    const zeroHeight = makeObs({ id: "h0", code: LOINC_HEIGHT, value_num: 0 });
    expect(deriveBmi([zeroHeight, WEIGHT_70])).toBeNull();
  });

  it("source is always 'derived'", () => {
    const result = deriveBmi([HEIGHT_170, WEIGHT_70]);
    expect(result!.source).toBe("derived");
  });

  it("effectiveAt is the LATER of the two timestamps", () => {
    // HEIGHT_170 = 2026-05-01, WEIGHT_70 = 2026-06-01 → effectiveAt = June
    const result = deriveBmi([HEIGHT_170, WEIGHT_70]);
    expect(result!.effectiveAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("uses the LATEST height and weight when multiple observations exist", () => {
    const olderHeight = makeObs({
      id: "h-old",
      code: LOINC_HEIGHT,
      value_num: 165, // older, shorter
      effective_at: "2026-01-01T00:00:00.000Z",
    });
    const newerHeight = makeObs({
      id: "h-new",
      code: LOINC_HEIGHT,
      value_num: 170,
      effective_at: "2026-05-01T00:00:00.000Z",
    });
    const olderWeight = makeObs({
      id: "w-old",
      code: LOINC_WEIGHT,
      value_num: 80,
      effective_at: "2026-02-01T00:00:00.000Z",
    });
    const newerWeight = makeObs({
      id: "w-new",
      code: LOINC_WEIGHT,
      value_num: 70,
      effective_at: "2026-06-01T00:00:00.000Z",
    });
    // Should use 170cm + 70kg (latest of each), not 165cm + 80kg.
    const result = deriveBmi([olderHeight, newerHeight, olderWeight, newerWeight]);
    expect(result!.bmi).toBeCloseTo(24.2, 1);
    expect(result!.heightObs.id).toBe("h-new");
    expect(result!.weightObs.id).toBe("w-new");
  });

  it("ignores other LOINC codes (e.g. BMI code) — only height + weight", () => {
    const bmiObs = makeObs({
      code: LOINC_BMI,
      value_num: 25.0,
    });
    // Only the BMI obs, no height/weight → null
    expect(deriveBmi([bmiObs])).toBeNull();
    // With height + weight, the BMI code is ignored (doesn't corrupt result)
    const result = deriveBmi([HEIGHT_170, WEIGHT_70, bmiObs]);
    expect(result!.bmi).toBeCloseTo(24.2, 1);
  });

  it("rounds to one decimal place", () => {
    // 90kg / (1.75m)² = 29.387... → rounds to 29.4
    const h175 = makeObs({ id: "h2", code: LOINC_HEIGHT, value_num: 175 });
    const w90 = makeObs({ id: "w2", code: LOINC_WEIGHT, value_num: 90 });
    const result = deriveBmi([h175, w90]);
    expect(result!.bmi).toBe(29.4);
  });
});

// ─── deriveBmiTrend ──────────────────────────────────────────────────────────

describe("deriveBmiTrend", () => {
  it("returns [] when no height/weight observations exist", () => {
    expect(deriveBmiTrend([])).toEqual([]);
  });

  it("returns [] when only height is present (no weight)", () => {
    expect(deriveBmiTrend([HEIGHT_170])).toEqual([]);
  });

  it("returns [] when only weight is present (no height)", () => {
    expect(deriveBmiTrend([WEIGHT_70])).toEqual([]);
  });

  it("returns a single point when height + weight exist (1 snapshot)", () => {
    const points = deriveBmiTrend([HEIGHT_170, WEIGHT_70]);
    // Height at May-01, weight at Jun-01 — propagated height forward
    expect(points).toHaveLength(1);
    expect(points[0]!.bmi).toBeCloseTo(24.2, 1);
    expect(points[0]!.effectiveAt).toBe("2026-06-01T00:00:00.000Z");
  });

  it("propagates last-known height across multiple weight entries", () => {
    const w1 = makeObs({
      id: "w-a",
      code: LOINC_WEIGHT,
      value_num: 75,
      effective_at: "2026-04-01T00:00:00.000Z",
    });
    const w2 = makeObs({
      id: "w-b",
      code: LOINC_WEIGHT,
      value_num: 70,
      effective_at: "2026-06-01T00:00:00.000Z",
    });
    // Height entered once (May); weight entered twice (Apr, Jun).
    // Apr snapshot uses May height (propagated backward is not done —
    // height is only available AFTER May; Apr snapshot should not exist).
    // Actually: ascending sort → Apr first, height not yet seen → no point.
    // After May height: Jun weight → one point.
    const points = deriveBmiTrend([HEIGHT_170, w1, w2]);
    // w1 is Apr (before height at May) → no snapshot yet.
    // After height (May) → no new weight change → no snapshot emitted then.
    // w2 is Jun → snapshot using 170cm + 70kg.
    expect(points).toHaveLength(1);
    expect(points[0]!.bmi).toBeCloseTo(24.2, 1);
  });

  it("returns multiple points when weight changes while height is constant", () => {
    const h = makeObs({
      id: "h0",
      code: LOINC_HEIGHT,
      value_num: 170,
      effective_at: "2026-01-01T00:00:00.000Z",
    });
    const w1 = makeObs({
      id: "w1",
      code: LOINC_WEIGHT,
      value_num: 80,
      effective_at: "2026-02-01T00:00:00.000Z",
    });
    const w2 = makeObs({
      id: "w2",
      code: LOINC_WEIGHT,
      value_num: 75,
      effective_at: "2026-04-01T00:00:00.000Z",
    });
    const w3 = makeObs({
      id: "w3",
      code: LOINC_WEIGHT,
      value_num: 70,
      effective_at: "2026-06-01T00:00:00.000Z",
    });
    const points = deriveBmiTrend([h, w1, w2, w3]);
    expect(points).toHaveLength(3);
    // 80kg / (1.70)² ≈ 27.7
    expect(points[0]!.bmi).toBeCloseTo(27.7, 1);
    // 75kg / (1.70)² ≈ 26.0
    expect(points[1]!.bmi).toBeCloseTo(26.0, 1);
    // 70kg / (1.70)² ≈ 24.2
    expect(points[2]!.bmi).toBeCloseTo(24.2, 1);
    // Chronological order (ascending)
    expect(points[0]!.effectiveAt < points[1]!.effectiveAt).toBe(true);
    expect(points[1]!.effectiveAt < points[2]!.effectiveAt).toBe(true);
  });

  it("output is chronological (ascending effective_at)", () => {
    const h = makeObs({
      id: "h0",
      code: LOINC_HEIGHT,
      value_num: 170,
      effective_at: "2026-01-01T00:00:00.000Z",
    });
    const w1 = makeObs({
      id: "w1",
      code: LOINC_WEIGHT,
      value_num: 80,
      effective_at: "2026-03-01T00:00:00.000Z",
    });
    const w2 = makeObs({
      id: "w2",
      code: LOINC_WEIGHT,
      value_num: 70,
      effective_at: "2026-06-01T00:00:00.000Z",
    });
    // Feed in reverse order to verify sorting
    const points = deriveBmiTrend([w2, w1, h]);
    expect(points[0]!.effectiveAt).toBe("2026-03-01T00:00:00.000Z");
    expect(points[1]!.effectiveAt).toBe("2026-06-01T00:00:00.000Z");
  });
});

// ─── LOINC_BMI constant ────────────────────────────────────────────────────

describe("LOINC constants", () => {
  it("LOINC_HEIGHT is 8302-2", () => {
    expect(LOINC_HEIGHT).toBe("8302-2");
  });
  it("LOINC_WEIGHT is 29463-7", () => {
    expect(LOINC_WEIGHT).toBe("29463-7");
  });
  it("LOINC_BMI is 39156-5", () => {
    expect(LOINC_BMI).toBe("39156-5");
  });
});

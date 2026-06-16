/**
 * markerEntry tests — unit conversion, plausibility typo-guard, and the
 * observation builder. The durable correctness artifact for manual entry.
 */

import { describe, expect, it } from "vitest";

import {
  findMarker,
  MARKER_CATALOG,
  markersFor,
  trackedMarkers,
} from "../markerCatalog";
import {
  buildMarkerObservations,
  canonicalUnit,
  checkPlausible,
  toCanonical,
} from "../markerEntry";

const weight = findMarker("weight")!;
const glucose = findMarker("fasting_glucose")!;
const bp = findMarker("blood_pressure")!;
const hba1c = findMarker("hba1c")!;
const triglycerides = findMarker("triglycerides")!;
const waist = findMarker("waist_circumference")!;
const height = findMarker("height")!;
const boneDensity = findMarker("bone_density_tscore_hip")!;

describe("toCanonical", () => {
  it("converts lb → kg", () => {
    expect(toCanonical(weight.fields[0], 200, "lb")).toBeCloseTo(90.7185, 3);
  });

  it("is identity for the canonical unit (kg)", () => {
    expect(toCanonical(weight.fields[0], 80, "kg")).toBe(80);
  });

  it("converts glucose mmol/L → mg/dL (5 mmol/L ≈ 90 mg/dL)", () => {
    expect(toCanonical(glucose.fields[0], 5, "mmol/L")).toBeCloseTo(90.078, 2);
  });

  it("is identity for glucose mg/dL", () => {
    expect(toCanonical(glucose.fields[0], 100, "mg/dL")).toBe(100);
  });

  it("falls back to canonical for an unknown unit", () => {
    expect(toCanonical(weight.fields[0], 80, "stone")).toBe(80);
  });
});

describe("canonicalUnit", () => {
  it("returns the unit flagged canonical", () => {
    expect(canonicalUnit(weight.fields[0]).unit).toBe("kg");
    expect(canonicalUnit(glucose.fields[0]).unit).toBe("mg/dL");
  });
});

describe("checkPlausible (typo guard, not a clinical range)", () => {
  it("accepts an in-range value", () => {
    expect(checkPlausible(weight.fields[0], 80)).toEqual({ ok: true });
  });

  it("rejects below the floor", () => {
    expect(checkPlausible(weight.fields[0], 5)).toEqual({
      ok: false,
      reason: "out-of-range",
    });
  });

  it("rejects above the ceiling", () => {
    expect(checkPlausible(weight.fields[0], 500)).toEqual({
      ok: false,
      reason: "out-of-range",
    });
  });

  it("rejects NaN / non-finite", () => {
    expect(checkPlausible(weight.fields[0], Number.NaN)).toEqual({
      ok: false,
      reason: "not-a-number",
    });
  });
});

describe("buildMarkerObservations", () => {
  it("single-field marker → one LOINC observation, self_reported", () => {
    const [obs] = buildMarkerObservations({
      marker: hba1c,
      userId: "u1",
      effectiveAt: "2026-06-12T00:00:00.000Z",
      entries: [{ value: 6.1, unit: "%" }],
    });
    expect(obs).toMatchObject({
      user_id: "u1",
      category: "biomarker",
      code_system: "LOINC",
      code: "4548-4",
      value_num: 6.1,
      unit: "%",
      source: "self_reported",
      supersedes_id: null,
      effective_at: "2026-06-12T00:00:00.000Z",
    });
  });

  it("stores the canonical-unit value (lb entry → kg)", () => {
    const [obs] = buildMarkerObservations({
      marker: weight,
      userId: "u1",
      effectiveAt: "2026-06-12T00:00:00.000Z",
      entries: [{ value: 200, unit: "lb" }],
    });
    expect(obs.unit).toBe("kg");
    expect(obs.value_num).toBeCloseTo(90.7185, 3);
  });

  it("blood pressure → two observations (systolic + diastolic)", () => {
    const rows = buildMarkerObservations({
      marker: bp,
      userId: "u1",
      effectiveAt: "2026-06-12T00:00:00.000Z",
      entries: [
        { value: 120, unit: "mmHg" },
        { value: 80, unit: "mmHg" },
      ],
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ code: "8480-6", value_num: 120 });
    expect(rows[0].display).toContain("Systolic");
    expect(rows[1]).toMatchObject({ code: "8462-4", value_num: 80 });
    expect(rows[1].display).toContain("Diastolic");
  });
});

describe("markersFor (sex_at_birth cohort gate)", () => {
  it("offers male-only markers (testosterone, PSA) to males", () => {
    const keys = markersFor("male").map((m) => m.key);
    expect(keys).toContain("testosterone");
    expect(keys).toContain("psa");
  });

  it("never offers male-only markers to females (universal ones still show)", () => {
    const keys = markersFor("female").map((m) => m.key);
    expect(keys).not.toContain("testosterone");
    expect(keys).not.toContain("psa");
    expect(keys).toContain("triglycerides");
  });

  it("excludes sex-specific markers for null/unknown/intersex (never guesses)", () => {
    for (const sex of [null, "unknown", "intersex"] as const) {
      const keys = markersFor(sex).map((m) => m.key);
      expect(keys).not.toContain("testosterone");
      expect(keys).not.toContain("psa");
    }
  });
});

describe("expansion conversions + integrity", () => {
  it("triglycerides mmol/L → mg/dL (1 mmol/L ≈ 88.57 mg/dL)", () => {
    expect(toCanonical(triglycerides.fields[0], 1, "mmol/L")).toBeCloseTo(
      88.57,
      1,
    );
  });

  it("waist in → cm (10 in = 25.4 cm)", () => {
    expect(toCanonical(waist.fields[0], 10, "in")).toBeCloseTo(25.4, 3);
  });

  it("height in → cm (68 in = 172.72 cm)", () => {
    expect(toCanonical(height.fields[0], 68, "in")).toBeCloseTo(172.72, 2);
  });

  it("height cm stays cm (identity conversion)", () => {
    expect(toCanonical(height.fields[0], 170, "cm")).toBe(170);
  });

  it("every catalog marker is provisional + every field has a LOINC code", () => {
    for (const m of MARKER_CATALOG) {
      expect(m.provisional).toBe(true);
      for (const f of m.fields) {
        expect(f.loinc).toMatch(/^\d+-\d$/);
      }
    }
  });
});

describe("signed-number entry — bone-density T-score (LOINC 38264-8)", () => {
  it("bone_density_tscore_hip marker exists in the catalog", () => {
    expect(boneDensity).toBeDefined();
    expect(boneDensity.key).toBe("bone_density_tscore_hip");
  });

  it("LOINC code is 38264-8", () => {
    expect(boneDensity.fields[0].loinc).toBe("38264-8");
  });

  it("field is marked signed: true", () => {
    expect(boneDensity.fields[0].signed).toBe(true);
  });

  it("accepts a typical negative T-score (e.g. -1.5)", () => {
    const result = checkPlausible(boneDensity.fields[0], -1.5);
    expect(result).toEqual({ ok: true });
  });

  it("accepts a typical osteoporosis T-score (e.g. -2.7)", () => {
    const result = checkPlausible(boneDensity.fields[0], -2.7);
    expect(result).toEqual({ ok: true });
  });

  it("accepts a positive T-score (e.g. +1.0)", () => {
    const result = checkPlausible(boneDensity.fields[0], 1.0);
    expect(result).toEqual({ ok: true });
  });

  it("rejects values below the plausible floor (e.g. -6.0)", () => {
    const result = checkPlausible(boneDensity.fields[0], -6.0);
    expect(result).toEqual({ ok: false, reason: "out-of-range" });
  });

  it("rejects values above the plausible ceiling (e.g. 7.0)", () => {
    const result = checkPlausible(boneDensity.fields[0], 7.0);
    expect(result).toEqual({ ok: false, reason: "out-of-range" });
  });

  it("unsigned fields still REJECT negative values (weight field)", () => {
    // weight field: signed is absent (undefined), min is 20 kg.
    const result = checkPlausible(weight.fields[0], -10);
    expect(result).toEqual({ ok: false, reason: "out-of-range" });
  });

  it("unsigned HbA1c field rejects negative values", () => {
    const hba1cField = hba1c.fields[0];
    expect(hba1cField.signed).toBeFalsy();
    expect(checkPlausible(hba1cField, -1)).toEqual({
      ok: false,
      reason: "out-of-range",
    });
  });

  it("buildMarkerObservations for bone density stores the canonical value", () => {
    const [obs] = buildMarkerObservations({
      marker: boneDensity,
      userId: "u1",
      effectiveAt: "2026-06-15T00:00:00.000Z",
      entries: [{ value: -1.5, unit: "T-score" }],
    });
    expect(obs).toMatchObject({
      user_id: "u1",
      category: "biomarker",
      code_system: "LOINC",
      code: "38264-8",
      value_num: -1.5,
      unit: "T-score",
      source: "self_reported",
      supersedes_id: null,
    });
  });

  it("bone density group is 'Bone health' (NOT sex-gated)", () => {
    expect(boneDensity.group).toBe("Bone health");
    expect(boneDensity.cohort).toBeUndefined();
  });
});

describe("height marker (LOINC 8302-2)", () => {
  it("height marker exists in the catalog", () => {
    expect(height).toBeDefined();
    expect(height.key).toBe("height");
  });

  it("LOINC code is 8302-2", () => {
    expect(height.fields[0].loinc).toBe("8302-2");
  });

  it("canonical unit is cm", () => {
    expect(canonicalUnit(height.fields[0]).unit).toBe("cm");
  });

  it("is NOT sex-gated (universal)", () => {
    expect(height.cohort).toBeUndefined();
  });

  it("is in the 'Body' group", () => {
    expect(height.group).toBe("Body");
  });

  it("plausible range rejects a clearly-wrong value (e.g. 5 cm)", () => {
    expect(checkPlausible(height.fields[0], 5)).toEqual({
      ok: false,
      reason: "out-of-range",
    });
  });

  it("plausible range accepts 170 cm", () => {
    expect(checkPlausible(height.fields[0], 170)).toEqual({ ok: true });
  });

  it("plausible range rejects 300 cm", () => {
    expect(checkPlausible(height.fields[0], 300)).toEqual({
      ok: false,
      reason: "out-of-range",
    });
  });

  it("is NOT signed (no signed field)", () => {
    expect(height.fields[0].signed).toBeFalsy();
  });
});

describe("trackedMarkers (behavioral 'you're tracking' surface)", () => {
  it("surfaces markers the user has data for, most-recent first", () => {
    const obs = [
      { code: "4548-4", effective_at: "2026-06-01T00:00:00.000Z" }, // A1c
      { code: "2093-3", effective_at: "2026-06-10T00:00:00.000Z" }, // total chol
    ];
    expect(trackedMarkers(obs, "male").map((t) => t.marker.key)).toEqual([
      "total_cholesterol",
      "hba1c",
    ]);
  });

  it("uses the latest date among a marker's codes", () => {
    const obs = [
      { code: "4548-4", effective_at: "2026-05-01T00:00:00.000Z" },
      { code: "4548-4", effective_at: "2026-06-05T00:00:00.000Z" },
    ];
    const [t] = trackedMarkers(obs, "female");
    expect(t.marker.key).toBe("hba1c");
    expect(t.lastLoggedAt).toBe("2026-06-05T00:00:00.000Z");
  });

  it("respects the sex gate — a female never tracks a male-only marker", () => {
    const obs = [{ code: "2857-1", effective_at: "2026-06-01T00:00:00.000Z" }]; // PSA
    expect(trackedMarkers(obs, "female")).toHaveLength(0);
    expect(trackedMarkers(obs, "male").map((t) => t.marker.key)).toEqual([
      "psa",
    ]);
  });

  it("returns [] when the user has logged nothing", () => {
    expect(trackedMarkers([], "male")).toHaveLength(0);
  });
});

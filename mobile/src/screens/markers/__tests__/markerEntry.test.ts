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

  it("every catalog marker is provisional + every field has a LOINC code", () => {
    for (const m of MARKER_CATALOG) {
      expect(m.provisional).toBe(true);
      for (const f of m.fields) {
        expect(f.loinc).toMatch(/^\d+-\d$/);
      }
    }
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

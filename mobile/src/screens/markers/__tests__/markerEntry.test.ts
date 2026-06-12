/**
 * markerEntry tests — unit conversion, plausibility typo-guard, and the
 * observation builder. The durable correctness artifact for manual entry.
 */

import { describe, expect, it } from "vitest";

import { findMarker } from "../markerCatalog";
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

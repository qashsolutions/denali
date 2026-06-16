/**
 * markerEntry tests — unit conversion, plausibility typo-guard, live
 * validation helpers, ft/in helper, and the observation builder.
 * The durable correctness artifact for manual entry.
 */

import { describe, expect, it } from "vitest";

import {
  findMarker,
  formatMarkerValue,
  MARKER_CATALOG,
  markersFor,
  trackedMarkers,
} from "../markerCatalog";
import {
  buildMarkerObservations,
  canonicalUnit,
  checkPlausible,
  defaultUnitForField,
  deriveCanSave,
  feetInchesToCm,
  rangeErrorMessage,
  toCanonical,
  validateField,
} from "../markerEntry";

const weight = findMarker("weight")!;
const glucose = findMarker("fasting_glucose")!;
const bp = findMarker("blood_pressure")!;
const hba1c = findMarker("hba1c")!;
const triglycerides = findMarker("triglycerides")!;
const waist = findMarker("waist_circumference")!;
const height = findMarker("height")!;
const boneDensity = findMarker("bone_density_tscore_hip")!;

// ── feetInchesToCm ─────────────────────────────────────────────────────────────

describe("feetInchesToCm", () => {
  it("5 ft 9 in = 175.26 cm (spec invariant)", () => {
    expect(feetInchesToCm(5, 9)).toBeCloseTo(175.26, 2);
  });

  it("0 ft 0 in = 0 cm", () => {
    expect(feetInchesToCm(0, 0)).toBe(0);
  });

  it("6 ft 0 in = 182.88 cm", () => {
    expect(feetInchesToCm(6, 0)).toBeCloseTo(182.88, 2);
  });

  it("5 ft 0 in = 152.4 cm", () => {
    expect(feetInchesToCm(5, 0)).toBeCloseTo(152.4, 2);
  });

  it("0 ft 11 in = 27.94 cm (max inches before roll-over)", () => {
    expect(feetInchesToCm(0, 11)).toBeCloseTo(27.94, 2);
  });

  it("1 ft 8 in ≈ 50.8 cm (near the plausible floor for height)", () => {
    expect(feetInchesToCm(1, 8)).toBeCloseTo(50.8, 2);
  });

  it("8 ft 2 in ≈ 248.92 cm (near the plausible ceiling for height)", () => {
    expect(feetInchesToCm(8, 2)).toBeCloseTo(248.92, 2);
  });
});

// ── toCanonical ────────────────────────────────────────────────────────────────

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

// ── canonicalUnit ──────────────────────────────────────────────────────────────

describe("canonicalUnit", () => {
  it("returns the unit flagged canonical", () => {
    expect(canonicalUnit(weight.fields[0]).unit).toBe("kg");
    expect(canonicalUnit(glucose.fields[0]).unit).toBe("mg/dL");
  });

  it("height canonical unit is cm", () => {
    expect(canonicalUnit(height.fields[0]).unit).toBe("cm");
  });
});

describe("defaultUnitForField — entry default never diverges from canonical (except ft/in)", () => {
  it("height defaults to the ft/in composite (US-preferred)", () => {
    expect(defaultUnitForField(height.fields[0])).toBe("ft/in");
  });

  it("weight defaults to kg (canonical) — NOT lb", () => {
    // Regression: a rewrite once defaulted to units[0] (lb), silently storing
    // pounds-as-kg. The default must stay the canonical unit for non-ft/in.
    expect(defaultUnitForField(weight.fields[0])).toBe("kg");
  });

  it("multi-unit lab fields default to their canonical unit", () => {
    expect(defaultUnitForField(glucose.fields[0])).toBe("mg/dL");
    expect(defaultUnitForField(triglycerides.fields[0])).toBe("mg/dL");
    expect(defaultUnitForField(waist.fields[0])).toBe("cm");
  });

  it("single-unit fields default to that unit", () => {
    expect(defaultUnitForField(bp.fields[0])).toBe("mmHg");
    expect(defaultUnitForField(hba1c.fields[0])).toBe("%");
  });
});

// ── formatMarkerValue (display rounding; storage keeps full precision) ───────

describe("formatMarkerValue — display rounding", () => {
  it("weight (default 1 dp) strips float noise from a lb→kg conversion", () => {
    expect(formatMarkerValue("29463-7", 80)).toBe("80");
    expect(formatMarkerValue("29463-7", 36.287389600000004)).toBe("36.3");
  });

  it("height (0 dp) shows a whole number", () => {
    expect(formatMarkerValue("8302-2", 175.26)).toBe("175");
    expect(formatMarkerValue("8302-2", 180)).toBe("180");
  });

  it("creatinine (2 dp) keeps sub-decimal precision", () => {
    expect(formatMarkerValue("2160-0", 0.95)).toBe("0.95");
  });

  it("unknown code (e.g. uploaded lab) uses the default precision", () => {
    expect(formatMarkerValue("99999-9", 12.3456)).toBe("12.3");
    expect(formatMarkerValue("99999-9", 42)).toBe("42");
  });
});

// ── checkPlausible (typo guard, not a clinical range) ─────────────────────────

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

// ── validateField (live validation) ───────────────────────────────────────────

describe("validateField — standard single-input path", () => {
  it("empty string → empty", () => {
    expect(validateField(weight.fields[0], "kg", "")).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("whitespace-only → empty", () => {
    expect(validateField(weight.fields[0], "kg", "   ")).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("non-numeric text → not-a-number", () => {
    expect(validateField(weight.fields[0], "kg", "abc")).toEqual({
      ok: false,
      reason: "not-a-number",
    });
  });

  it("partial number (trailing dot) — Number('80.') = 80, valid", () => {
    // Number("80.") === 80 in JS; this is valid and in-range.
    expect(validateField(weight.fields[0], "kg", "80.")).toEqual({ ok: true });
  });

  it("out-of-range below floor → out-of-range", () => {
    expect(validateField(weight.fields[0], "kg", "5")).toEqual({
      ok: false,
      reason: "out-of-range",
    });
  });

  it("out-of-range above ceiling → out-of-range", () => {
    expect(validateField(weight.fields[0], "kg", "500")).toEqual({
      ok: false,
      reason: "out-of-range",
    });
  });

  it("valid value → ok", () => {
    expect(validateField(weight.fields[0], "kg", "80")).toEqual({ ok: true });
  });

  it("HbA1c — valid 6.5%", () => {
    expect(validateField(hba1c.fields[0], "%", "6.5")).toEqual({ ok: true });
  });

  it("HbA1c — empty", () => {
    expect(validateField(hba1c.fields[0], "%", "")).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("HbA1c — out of range (25%)", () => {
    expect(validateField(hba1c.fields[0], "%", "25")).toEqual({
      ok: false,
      reason: "out-of-range",
    });
  });
});

describe("validateField — signed bone-density field", () => {
  it("valid negative T-score -1.5 → ok", () => {
    expect(validateField(boneDensity.fields[0], "T-score", "-1.5")).toEqual({
      ok: true,
    });
  });

  it("valid osteoporosis T-score -2.7 → ok", () => {
    expect(validateField(boneDensity.fields[0], "T-score", "-2.7")).toEqual({
      ok: true,
    });
  });

  it("T-score below floor -6.0 → out-of-range", () => {
    expect(validateField(boneDensity.fields[0], "T-score", "-6.0")).toEqual({
      ok: false,
      reason: "out-of-range",
    });
  });

  it("T-score above ceiling 7.0 → out-of-range", () => {
    expect(validateField(boneDensity.fields[0], "T-score", "7.0")).toEqual({
      ok: false,
      reason: "out-of-range",
    });
  });

  it("empty T-score → empty", () => {
    expect(validateField(boneDensity.fields[0], "T-score", "")).toEqual({
      ok: false,
      reason: "empty",
    });
  });

  it("non-numeric T-score → not-a-number", () => {
    expect(validateField(boneDensity.fields[0], "T-score", "normal")).toEqual({
      ok: false,
      reason: "not-a-number",
    });
  });
});

describe("validateField — ft/in composite unit (height field)", () => {
  const heightField = height.fields[0];

  it("5 ft 9 in → ok (175.26 cm, in plausible range)", () => {
    expect(
      validateField(heightField, "ft/in", undefined, "5", "9"),
    ).toEqual({ ok: true });
  });

  it("6 ft 0 in → ok", () => {
    expect(
      validateField(heightField, "ft/in", undefined, "6", "0"),
    ).toEqual({ ok: true });
  });

  it("empty feet → empty", () => {
    expect(
      validateField(heightField, "ft/in", undefined, "", "9"),
    ).toEqual({ ok: false, reason: "empty" });
  });

  it("empty inches → empty", () => {
    expect(
      validateField(heightField, "ft/in", undefined, "5", ""),
    ).toEqual({ ok: false, reason: "empty" });
  });

  it("both empty → empty", () => {
    expect(
      validateField(heightField, "ft/in", undefined, "", ""),
    ).toEqual({ ok: false, reason: "empty" });
  });

  it("non-numeric feet → not-a-number", () => {
    expect(
      validateField(heightField, "ft/in", undefined, "five", "9"),
    ).toEqual({ ok: false, reason: "not-a-number" });
  });

  it("non-numeric inches → not-a-number", () => {
    expect(
      validateField(heightField, "ft/in", undefined, "5", "nine"),
    ).toEqual({ ok: false, reason: "not-a-number" });
  });

  it("inches = 12 → out-of-range (must be 0–11)", () => {
    expect(
      validateField(heightField, "ft/in", undefined, "5", "12"),
    ).toEqual({ ok: false, reason: "out-of-range" });
  });

  it("inches = 0 → ok (minimum valid)", () => {
    expect(
      validateField(heightField, "ft/in", undefined, "5", "0"),
    ).toEqual({ ok: true });
  });

  it("inches = 11 → ok (maximum valid within a foot)", () => {
    expect(
      validateField(heightField, "ft/in", undefined, "5", "11"),
    ).toEqual({ ok: true });
  });

  it("negative feet → out-of-range", () => {
    expect(
      validateField(heightField, "ft/in", undefined, "-1", "0"),
    ).toEqual({ ok: false, reason: "out-of-range" });
  });

  it("0 ft 0 in → out-of-range (0 cm, below plausible min 50)", () => {
    expect(
      validateField(heightField, "ft/in", undefined, "0", "0"),
    ).toEqual({ ok: false, reason: "out-of-range" });
  });

  it("huge height 10 ft 0 in → out-of-range (304.8 cm > 250)", () => {
    expect(
      validateField(heightField, "ft/in", undefined, "10", "0"),
    ).toEqual({ ok: false, reason: "out-of-range" });
  });

  it("1 ft 8 in (≈ 50.8 cm, near floor) → ok", () => {
    expect(
      validateField(heightField, "ft/in", undefined, "1", "8"),
    ).toEqual({ ok: true });
  });

  it("negative inches → out-of-range", () => {
    expect(
      validateField(heightField, "ft/in", undefined, "5", "-1"),
    ).toEqual({ ok: false, reason: "out-of-range" });
  });
});

// ── deriveCanSave ──────────────────────────────────────────────────────────────

describe("deriveCanSave", () => {
  it("single-field marker valid → true", () => {
    expect(deriveCanSave(hba1c, ["6.5"], ["%"], [""], [""])).toBe(true);
  });

  it("single-field marker empty → false", () => {
    expect(deriveCanSave(hba1c, [""], ["%"], [""], [""])).toBe(false);
  });

  it("single-field marker non-numeric → false", () => {
    expect(deriveCanSave(hba1c, ["abc"], ["%"], [""], [""])).toBe(false);
  });

  it("single-field marker out-of-range → false", () => {
    expect(deriveCanSave(hba1c, ["99"], ["%"], [""], [""])).toBe(false);
  });

  it("two-field BP — both valid → true", () => {
    expect(
      deriveCanSave(bp, ["120", "80"], ["mmHg", "mmHg"], ["", ""], ["", ""]),
    ).toBe(true);
  });

  it("two-field BP — one empty → false", () => {
    expect(
      deriveCanSave(bp, ["120", ""], ["mmHg", "mmHg"], ["", ""], ["", ""]),
    ).toBe(false);
  });

  it("two-field BP — one out-of-range → false", () => {
    expect(
      deriveCanSave(bp, ["120", "500"], ["mmHg", "mmHg"], ["", ""], ["", ""]),
    ).toBe(false);
  });

  it("height ft/in — valid 5ft 9in → true", () => {
    expect(
      deriveCanSave(height, [""], ["ft/in"], ["5"], ["9"]),
    ).toBe(true);
  });

  it("height ft/in — empty feet → false", () => {
    expect(
      deriveCanSave(height, [""], ["ft/in"], [""], ["9"]),
    ).toBe(false);
  });

  it("height ft/in — inches=12 → false", () => {
    expect(
      deriveCanSave(height, [""], ["ft/in"], ["5"], ["12"]),
    ).toBe(false);
  });

  it("height cm — valid → true", () => {
    expect(
      deriveCanSave(height, ["170"], ["cm"], [""], [""]),
    ).toBe(true);
  });

  it("height cm — out of range → false", () => {
    expect(
      deriveCanSave(height, ["5"], ["cm"], [""], [""]),
    ).toBe(false);
  });

  it("bone-density — valid negative T-score → true", () => {
    expect(
      deriveCanSave(boneDensity, ["-2.5"], ["T-score"], [""], [""]),
    ).toBe(true);
  });

  it("bone-density — below floor → false", () => {
    expect(
      deriveCanSave(boneDensity, ["-6"], ["T-score"], [""], [""]),
    ).toBe(false);
  });
});

// ── rangeErrorMessage ──────────────────────────────────────────────────────────

describe("rangeErrorMessage", () => {
  it("cm unit for height → numeric cm range", () => {
    const msg = rangeErrorMessage(height.fields[0], "cm");
    expect(msg).toMatch(/50/);
    expect(msg).toMatch(/250/);
    expect(msg).toContain("cm");
  });

  it("ft/in unit for height → feet+inches range message", () => {
    const msg = rangeErrorMessage(height.fields[0], "ft/in");
    expect(msg).toMatch(/ft/);
    expect(msg).toMatch(/in/);
    // Should contain the approximate floor and ceiling in feet
    expect(msg).toMatch(/1 ft/);
    expect(msg).toMatch(/8 ft/);
  });

  it("kg unit for weight → kg range", () => {
    const msg = rangeErrorMessage(weight.fields[0], "kg");
    expect(msg).toContain("kg");
    expect(msg).toMatch(/20/);
    expect(msg).toMatch(/360/);
  });

  it("% unit for HbA1c → % range", () => {
    const msg = rangeErrorMessage(hba1c.fields[0], "%");
    expect(msg).toContain("%");
    expect(msg).toMatch(/3/);
    expect(msg).toMatch(/20/);
  });

  it("ft/in message never shows '12 in' — rounding carries into feet", () => {
    // Real height bounds (50–250 cm) → "1 ft 8 in" / "8 ft 2 in", no 12.
    expect(rangeErrorMessage(height.fields[0], "ft/in")).not.toContain("12 in");
    // Synthetic max ≈ 23.6 in: a naive floor+round prints "1 ft 12 in";
    // the carry must promote it to "2 ft 0 in".
    const synthetic = {
      loinc: "x",
      units: [
        { unit: "ft/in", feetInches: true, toCanonicalFactor: 0 },
        { unit: "cm", canonical: true, toCanonicalFactor: 1 },
      ],
      plausible: { min: 50, max: 59.944 },
    } satisfies (typeof height.fields)[0];
    const msg = rangeErrorMessage(synthetic, "ft/in");
    expect(msg).not.toContain("12 in");
    expect(msg).toContain("2 ft 0 in");
  });
});

// ── buildMarkerObservations ────────────────────────────────────────────────────

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

  it("height ft/in → screen pre-converts to cm, stored as canonical cm", () => {
    // The screen calls feetInchesToCm(5, 9) = 175.26 and passes { value: 175.26, unit: "cm" }
    const cmValue = feetInchesToCm(5, 9);
    const [obs] = buildMarkerObservations({
      marker: height,
      userId: "u1",
      effectiveAt: "2026-06-16T00:00:00.000Z",
      entries: [{ value: cmValue, unit: "cm" }],
    });
    expect(obs.unit).toBe("cm");
    expect(obs.value_num).toBeCloseTo(175.26, 2);
    expect(obs.code).toBe("8302-2");
    expect(obs.source).toBe("self_reported");
  });
});

// ── markersFor (sex_at_birth cohort gate) ─────────────────────────────────────

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

// ── expansion conversions + integrity ─────────────────────────────────────────

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

  it("height first unit is ft/in (the default for US audience)", () => {
    expect(height.fields[0].units[0].unit).toBe("ft/in");
    expect(height.fields[0].units[0].feetInches).toBe(true);
  });

  it("height canonical unit is still cm (stored representation)", () => {
    expect(canonicalUnit(height.fields[0]).unit).toBe("cm");
  });
});

// ── signed-number entry — bone-density T-score (LOINC 38264-8) ───────────────

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

  it("bone-density validateField — valid negative T-score", () => {
    expect(
      validateField(boneDensity.fields[0], "T-score", "-2.5"),
    ).toEqual({ ok: true });
  });

  it("bone-density deriveCanSave — valid negative → true", () => {
    expect(
      deriveCanSave(boneDensity, ["-2.5"], ["T-score"], [""], [""]),
    ).toBe(true);
  });

  it("bone-density deriveCanSave — empty → false", () => {
    expect(
      deriveCanSave(boneDensity, [""], ["T-score"], [""], [""]),
    ).toBe(false);
  });
});

// ── height marker (LOINC 8302-2) ──────────────────────────────────────────────

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

  it("default (first) unit is ft/in", () => {
    expect(height.fields[0].units[0].unit).toBe("ft/in");
  });

  it("has exactly two units: ft/in and cm", () => {
    const unitLabels = height.fields[0].units.map((u) => u.unit);
    expect(unitLabels).toEqual(["ft/in", "cm"]);
  });

  it("ft/in unit has feetInches flag = true", () => {
    const ftIn = height.fields[0].units.find((u) => u.unit === "ft/in");
    expect(ftIn?.feetInches).toBe(true);
  });

  it("cm unit has feetInches flag falsy", () => {
    const cm = height.fields[0].units.find((u) => u.unit === "cm");
    expect(cm?.feetInches).toBeFalsy();
  });
});

// ── blood-pressure two-field marker still validates correctly ──────────────────

describe("blood pressure — two-field marker validation", () => {
  it("both fields valid → canSave true", () => {
    expect(
      deriveCanSave(bp, ["120", "80"], ["mmHg", "mmHg"], ["", ""], ["", ""]),
    ).toBe(true);
  });

  it("systolic non-numeric → canSave false", () => {
    expect(
      deriveCanSave(bp, ["abc", "80"], ["mmHg", "mmHg"], ["", ""], ["", ""]),
    ).toBe(false);
  });

  it("systolic empty → canSave false", () => {
    expect(
      deriveCanSave(bp, ["", "80"], ["mmHg", "mmHg"], ["", ""], ["", ""]),
    ).toBe(false);
  });

  it("diastolic empty → canSave false", () => {
    expect(
      deriveCanSave(bp, ["120", ""], ["mmHg", "mmHg"], ["", ""], ["", ""]),
    ).toBe(false);
  });

  it("systolic out-of-range (10 mmHg) → canSave false", () => {
    expect(
      deriveCanSave(bp, ["10", "80"], ["mmHg", "mmHg"], ["", ""], ["", ""]),
    ).toBe(false);
  });

  it("diastolic out-of-range (500 mmHg) → canSave false", () => {
    expect(
      deriveCanSave(bp, ["120", "500"], ["mmHg", "mmHg"], ["", ""], ["", ""]),
    ).toBe(false);
  });

  it("validateField systolic valid", () => {
    expect(validateField(bp.fields[0], "mmHg", "120")).toEqual({ ok: true });
  });

  it("validateField diastolic out-of-range", () => {
    expect(validateField(bp.fields[1], "mmHg", "400")).toEqual({
      ok: false,
      reason: "out-of-range",
    });
  });
});

// ── trackedMarkers (behavioral 'you're tracking' surface) ─────────────────────

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

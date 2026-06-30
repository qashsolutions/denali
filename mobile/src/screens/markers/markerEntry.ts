/**
 * Manual marker-entry — pure logic (unit conversion, typo-guard validation,
 * and the observation builder). No UI, no DAL — unit-tested so the
 * conversion/validation is provable. The screen calls these and forwards the
 * built inserts to the DAL.
 *
 * Records a value the user already has, coded like an uploaded lab
 * (code_system "LOINC", source "self_reported"). No interpretation.
 *
 * Append-only invariant: this module never reads existing rows; it only
 * builds insert inputs. Supersede logic (corrections) lives in the DAL.
 */

import type { ObservationInsertInput } from "@/contracts";

import type { MarkerDef, MarkerField, MarkerUnit } from "./markerCatalog";

// ── Unit helpers ──────────────────────────────────────────────────────────────

/** The canonical (stored) unit for a field. */
export function canonicalUnit(field: MarkerField): MarkerUnit {
  return field.units.find((u) => u.canonical) ?? field.units[0];
}

/**
 * The unit a field should DEFAULT to in the entry UI: the feet/inches
 * composite when the field has one (height — US-preferred), otherwise the
 * canonical (stored) unit. So height defaults to ft/in while weight stays kg,
 * cholesterol mg/dL, etc. — the entry default never silently diverges from the
 * canonical unit for non-feet/inches fields.
 */
export function defaultUnitForField(field: MarkerField): string {
  const feetIn = field.units.find((u) => u.feetInches);
  return feetIn != null ? feetIn.unit : canonicalUnit(field).unit;
}

/**
 * Convert feet + inches to centimetres.
 * Formula: cm = (feet * 12 + inches) * 2.54
 * Invariant: 5 ft 9 in = (5*12 + 9) * 2.54 = 69 * 2.54 = 175.26 cm.
 * Pure; no range check — that is `checkPlausible`'s job.
 */
export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * 2.54;
}

/**
 * Convert an entered value in `unitLabel` to the field's canonical unit.
 * For the `feetInches` composite unit, this function is NOT called from the
 * screen (the screen calls `feetInchesToCm` directly); for all other units
 * the standard factor multiplication applies.
 */
export function toCanonical(
  field: MarkerField,
  value: number,
  unitLabel: string,
): number {
  const u = field.units.find((x) => x.unit === unitLabel) ?? canonicalUnit(field);
  return value * u.toCanonicalFactor;
}

// ── Validation helpers (live — called on every keystroke) ─────────────────────

/**
 * Per-field live validation result.
 *   ok: true  → field is valid.
 *   ok: false, reason "empty"          → blank or whitespace only.
 *   ok: false, reason "not-a-number"   → contains non-numeric text.
 *   ok: false, reason "out-of-range"   → parses as a number but outside
 *                                        field.plausible (in the canonical unit).
 */
export type FieldValidationResult =
  | { ok: true }
  | { ok: false; reason: "empty" | "not-a-number" | "out-of-range" };

/**
 * Validate a single raw string entry for a field, in the context of the
 * currently-selected unit.
 *
 * For the `feetInches` composite unit the caller passes the TWO raw strings
 * as `rawFeet` and `rawInches` (both required). For every other unit pass
 * only `rawValue`.
 *
 * The function converts to the canonical unit internally; the `field.plausible`
 * bounds are always in the canonical unit.
 */
export function validateField(
  field: MarkerField,
  unitLabel: string,
  rawValue?: string,
  rawFeet?: string,
  rawInches?: string,
): FieldValidationResult {
  const activeUnit = field.units.find((u) => u.unit === unitLabel);
  const isFeetInches = activeUnit?.feetInches === true;

  if (isFeetInches) {
    const feetStr = (rawFeet ?? "").trim();
    const inchesStr = (rawInches ?? "").trim();

    if (feetStr === "" || inchesStr === "") {
      return { ok: false, reason: "empty" };
    }
    const feet = Number(feetStr);
    const inches = Number(inchesStr);
    if (!Number.isFinite(feet) || !Number.isFinite(inches)) {
      return { ok: false, reason: "not-a-number" };
    }
    // inches must be 0–11 (a 12th inch is a foot); feet must be non-negative
    if (inches < 0 || inches >= 12 || feet < 0) {
      return { ok: false, reason: "out-of-range" };
    }
    const cm = feetInchesToCm(feet, inches);
    if (!Number.isFinite(cm)) {
      return { ok: false, reason: "not-a-number" };
    }
    if (cm < field.plausible.min || cm > field.plausible.max) {
      return { ok: false, reason: "out-of-range" };
    }
    return { ok: true };
  }

  // Standard single-input path
  const raw = (rawValue ?? "").trim();
  if (raw === "") {
    return { ok: false, reason: "empty" };
  }
  const num = Number(raw);
  if (!Number.isFinite(num)) {
    return { ok: false, reason: "not-a-number" };
  }
  const canonical = toCanonical(field, num, unitLabel);
  if (!Number.isFinite(canonical)) {
    return { ok: false, reason: "not-a-number" };
  }
  if (canonical < field.plausible.min || canonical > field.plausible.max) {
    return { ok: false, reason: "out-of-range" };
  }
  return { ok: true };
}

/**
 * Return true iff every field of `marker` has a valid (non-empty, numeric,
 * in-range) entry. The screen gates the Save button on this value; it is
 * evaluated on every input change so the disabled state is live.
 *
 * `fieldValues[i]` — raw string for the standard input on field i.
 * `fieldUnits[i]`  — currently-selected unit label for field i.
 * `feetValues[i]`  — raw feet string when field i uses the ft/in unit.
 * `inchesValues[i]`— raw inches string when field i uses the ft/in unit.
 */
export function deriveCanSave(
  marker: MarkerDef,
  fieldValues: ReadonlyArray<string>,
  fieldUnits: ReadonlyArray<string>,
  feetValues: ReadonlyArray<string>,
  inchesValues: ReadonlyArray<string>,
): boolean {
  for (let i = 0; i < marker.fields.length; i += 1) {
    const field = marker.fields[i];
    const unit = fieldUnits[i] ?? "";
    const activeUnit = field.units.find((u) => u.unit === unit);
    const result =
      activeUnit?.feetInches === true
        ? validateField(field, unit, undefined, feetValues[i], inchesValues[i])
        : validateField(field, unit, fieldValues[i]);
    if (!result.ok) return false;
  }
  return true;
}

/**
 * Build the human-readable out-of-range error message for a field,
 * expressed in the user's ACTIVE display unit (not the canonical unit).
 *
 * For the ft/in unit, converts field.plausible back to feet+inches for
 * a natural message (e.g. "between 1 ft 8 in and 8 ft 2 in").
 * For all other units, converts plausible from canonical to display-unit
 * space by reversing the toCanonicalFactor.
 */
export function rangeErrorMessage(
  field: MarkerField,
  unitLabel: string,
): string {
  const activeUnit = field.units.find((u) => u.unit === unitLabel);

  if (activeUnit?.feetInches === true) {
    // Convert canonical cm bounds → ft+in for a natural message. Carry a
    // rounded-up 12 in into the next foot so the message can never read
    // "X ft 12 in" (12 in = 1 ft) for any current or future bound.
    const cmToFtIn = (cm: number): { ft: number; in: number } => {
      const totalIn = Math.round(cm / 2.54);
      return { ft: Math.floor(totalIn / 12), in: totalIn % 12 };
    };
    const lo = cmToFtIn(field.plausible.min);
    const hi = cmToFtIn(field.plausible.max);
    return `Enter a value between ${lo.ft} ft ${lo.in} in and ${hi.ft} ft ${hi.in} in.`;
  }

  const factor = activeUnit?.toCanonicalFactor ?? 1;
  // Invert: display = canonical / factor (guard against zero factor)
  const minDisplay =
    factor !== 0 ? field.plausible.min / factor : field.plausible.min;
  const maxDisplay =
    factor !== 0 ? field.plausible.max / factor : field.plausible.max;

  // Round to at most 2 decimal places for readability
  const fmt = (n: number): string =>
    Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, "");

  return `Enter a value between ${fmt(minDisplay)} and ${fmt(maxDisplay)} ${unitLabel}.`;
}

// ── Legacy plausibility check (used by onSave fallback path) ─────────────────

export type PlausibleResult =
  | { ok: true }
  | { ok: false; reason: "not-a-number" | "out-of-range" };

/**
 * Typo guard: the value (already in the canonical unit) must be finite and
 * within the field's physical-plausibility bounds. This is data quality —
 * NOT a clinical normal/abnormal claim.
 *
 * This is the original guard, kept for the onSave final-check path.
 * For live UI validation use `validateField` instead.
 */
export function checkPlausible(
  field: MarkerField,
  canonicalValue: number,
): PlausibleResult {
  if (!Number.isFinite(canonicalValue)) {
    return { ok: false, reason: "not-a-number" };
  }
  if (
    canonicalValue < field.plausible.min ||
    canonicalValue > field.plausible.max
  ) {
    return { ok: false, reason: "out-of-range" };
  }
  return { ok: true };
}

// ── Observation builder ───────────────────────────────────────────────────────

export interface MarkerFieldEntry {
  /** Raw numeric value as entered. For ft/in, use the pre-converted cm value. */
  value: number;
  /** Selected unit label for this field. */
  unit: string;
}

/**
 * Build the observation insert(s) for a manual marker entry — one row per
 * field (blood pressure → systolic + diastolic), value stored in the
 * canonical unit. `source: "self_reported"`; no interpretation; no
 * supersedes (manual entries are appended time-series, like uploads).
 *
 * For ft/in entries the CALLER is responsible for converting feet+inches
 * to cm (via `feetInchesToCm`) and passing `{ value: cmValue, unit: "cm" }`
 * so the stored row is always in the canonical unit.
 */
export function buildMarkerObservations(args: {
  marker: MarkerDef;
  userId: string;
  effectiveAt: string;
  entries: ReadonlyArray<MarkerFieldEntry>;
}): ObservationInsertInput[] {
  const { marker, userId, effectiveAt, entries } = args;
  return marker.fields.map((field, i) => {
    const entry = entries[i];
    const canonical = canonicalUnit(field);
    const display =
      field.label != null
        ? `${marker.display} — ${field.label}`
        : marker.display;
    return {
      user_id: userId,
      category: marker.category,
      code_system: "LOINC",
      code: field.loinc,
      display,
      value_num: toCanonical(field, entry.value, entry.unit),
      value_text: null,
      unit: canonical.unit,
      source: "self_reported",
      effective_at: effectiveAt,
      report_id: null,
      supersedes_id: null,
      metadata_json: null,
    };
  });
}

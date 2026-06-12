/**
 * Manual marker-entry — pure logic (unit conversion, typo-guard validation,
 * and the observation builder). No UI, no DAL — unit-tested so the
 * conversion/validation is provable. The screen calls these and forwards the
 * built inserts to the DAL.
 *
 * Records a value the user already has, coded like an uploaded lab
 * (code_system "LOINC", source "self_reported"). No interpretation.
 */

import type { ObservationInsertInput } from "@/contracts";

import type { MarkerDef, MarkerField, MarkerUnit } from "./markerCatalog";

/** The canonical (stored) unit for a field. */
export function canonicalUnit(field: MarkerField): MarkerUnit {
  return field.units.find((u) => u.canonical) ?? field.units[0];
}

/** Convert an entered value in `unitLabel` to the field's canonical unit. */
export function toCanonical(
  field: MarkerField,
  value: number,
  unitLabel: string,
): number {
  const u = field.units.find((x) => x.unit === unitLabel) ?? canonicalUnit(field);
  return value * u.toCanonicalFactor;
}

export type PlausibleResult =
  | { ok: true }
  | { ok: false; reason: "not-a-number" | "out-of-range" };

/**
 * Typo guard: the value (already in the canonical unit) must be finite and
 * within the field's physical-plausibility bounds. This is data quality —
 * NOT a clinical normal/abnormal claim.
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

export interface MarkerFieldEntry {
  /** Raw numeric value as entered. */
  value: number;
  /** Selected unit label for this field. */
  unit: string;
}

/**
 * Build the observation insert(s) for a manual marker entry — one row per
 * field (blood pressure → systolic + diastolic), value stored in the
 * canonical unit. `source: "self_reported"`; no interpretation; no
 * supersedes (manual entries are appended time-series, like uploads).
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

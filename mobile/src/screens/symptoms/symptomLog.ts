/**
 * Symptom logging — pure helpers (extracted for node-testable coverage; the
 * render layer is SymptomLogScreen). Mirrors markers/markerEntry.ts
 * `buildMarkerObservations`.
 *
 * A logged symptom commits as ONE append-only observation — same model as a
 * manually-entered marker or an uploaded value. NO score, NO interpretation.
 */

import type { ObservationInsertInput } from "@/contracts";

import {
  SEVERITY_MAX,
  SEVERITY_MIN,
  severityLabel,
  symptomCode,
  type SymptomDef,
} from "./symptomCatalog";

/** Is `v` a valid 0–3 integer severity? (The Save gate.) */
export function isValidSeverity(v: number): boolean {
  return Number.isInteger(v) && v >= SEVERITY_MIN && v <= SEVERITY_MAX;
}

/**
 * Build the ObservationInsertInput for a logged symptom severity.
 *
 * Notes:
 *   - `value_num` carries the 0–3 severity (the trend charts this, band-less).
 *   - `value_text` carries the plain severity label ("Moderate").
 *   - `recorded_at` is omitted so the DAL stamps now() at write time.
 *   - `supersedes_id` is null on first log; a correction would carry the prior
 *     row's id (append-only — never an UPDATE).
 *
 * The caller MUST pass a valid severity (guard with `isValidSeverity`); this
 * throws on an out-of-range value rather than storing a bad reading.
 */
export function buildSymptomObservation(args: {
  symptom: SymptomDef;
  severity: number;
  userId: string;
  effectiveAt: string;
}): ObservationInsertInput {
  const { symptom, severity, userId, effectiveAt } = args;
  if (!isValidSeverity(severity)) {
    throw new Error(`Invalid symptom severity: ${severity} (expected 0–3)`);
  }
  const label = severityLabel(severity);
  return {
    user_id: userId,
    category: "symptom",
    code_system: "internal",
    code: symptomCode(symptom),
    display: symptom.display,
    value_num: severity,
    value_text: label,
    unit: null,
    source: "self_reported",
    effective_at: effectiveAt,
    report_id: null,
    supersedes_id: null,
    metadata_json: JSON.stringify({
      symptomKey: symptom.key,
      domain: symptom.domain,
      severityLabel: label,
      provisional: symptom.provisional,
    }),
  };
}

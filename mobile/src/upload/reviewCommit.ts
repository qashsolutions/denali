/**
 * Phase 1 mobile — review-screen commit helpers (Wave 2).
 *
 * Pure functions extracted from `UploadReviewScreen.tsx` for vitest
 * coverage. The render/interaction layer is exercised separately by the
 * privacy-invariant guard at the wave boundary.
 *
 * Responsibilities:
 *   - Map an accepted `ReviewRowState` to an `ObservationInsertInput` shaped
 *     for `LocalDataDAL.insertObservation`. Auto-fills `source =
 *     "uploaded_report"` and ties the row to its source `report_id`.
 *   - Compute the report's `parse_status` from how many rows the user kept
 *     vs. rejected: confirmed (all accepted) | partial (mixed) |
 *     rejected (none).
 */

import type {
  ObservationInsertInput,
  ReportParseStatus,
} from "@/contracts";

import type { ReviewRowState } from "./types";

/**
 * Build an ObservationInsertInput for a single accepted review row.
 *
 * Notes:
 *   - `recorded_at` is left undefined so the DAL stamps now() at write time.
 *   - `supersedes_id` is always null on first-commit; corrections happen
 *     on a later edit and would carry the prior row's id.
 *   - `metadata_json` carries the unedited parse + confidence so the audit
 *     trail can compare "what Claude said" vs "what the user kept".
 */
export function buildObservationInsert(
  row: ReviewRowState,
  userId: string,
  reportId: string,
): ObservationInsertInput {
  const obs = row.edited;
  const metadata = {
    confidence: obs.confidence,
    unedited: row.original,
  };

  return {
    user_id: userId,
    category: obs.category,
    code_system: obs.code_system,
    code: obs.code,
    display: obs.display,
    value_num: obs.value_num,
    value_text: obs.value_text,
    unit: obs.unit,
    source: "uploaded_report",
    effective_at: obs.effective_at,
    report_id: reportId,
    supersedes_id: null,
    metadata_json: JSON.stringify(metadata),
  };
}

/**
 * Compute the report's `parse_status` from the user's accept/reject pattern.
 *
 *   all rows accepted   → "confirmed"
 *   some accepted       → "partial"
 *   none accepted (or
 *     zero rows at all) → "rejected"
 */
export function computeParseStatus(rows: ReviewRowState[]): ReportParseStatus {
  if (rows.length === 0) return "rejected";
  const acceptedCount = rows.filter((r) => r.accepted).length;
  if (acceptedCount === 0) return "rejected";
  if (acceptedCount === rows.length) return "confirmed";
  return "partial";
}

/**
 * Project all accepted rows into the DAL insert inputs. Order is preserved
 * so the review-UI top-down ordering matches insert order (and therefore
 * the timeline ordering, for ties on effective_at).
 */
export function buildInsertsForReport(
  rows: ReviewRowState[],
  userId: string,
  reportId: string,
): ObservationInsertInput[] {
  return rows
    .filter((r) => r.accepted)
    .map((r) => buildObservationInsert(r, userId, reportId));
}

/**
 * removeReport — the single point that fully removes a report (UPL-2).
 *
 * Deletes BOTH the report row (via the DAL) and its encrypted on-device blob
 * (`deleteBlob`). Before this existed, `deleteBlob` had ZERO callers, so every
 * no-keep report (skip / abandon / unreadable / parse-failure) leaked its row
 * AND its encrypted `.bin` forever. Route every such cleanup — and the explicit
 * "delete document" affordance — through here so the row and blob can never
 * drift out of sync.
 *
 * Does NOT delete observations linked by `report_id`: committed values are
 * append-only and independent of the source document (invariant 4), so deleting
 * a confirmed report's document keeps its readings. Best-effort + non-throwing:
 * a failed blob delete must not block navigation or strand the user.
 */
import type { LocalDataDAL, ReportParseStatus, ReportRow } from "@/contracts";

import { deleteBlob } from "./blobStore";

export async function removeReport(
  dal: LocalDataDAL,
  reportId: string,
): Promise<void> {
  try {
    await dal.deleteReport(reportId);
  } catch (err) {
    console.warn("[removeReport] row delete failed", err);
  }
  try {
    deleteBlob(reportId);
  } catch (err) {
    console.warn("[removeReport] blob delete failed", err);
  }
}

/**
 * When this module first loads (~app boot / first upload-screen mount). A report
 * is created ONLY by UploadScreen, which imports this module, so this instant is
 * <= any report this session could exist — making "uploaded_at < SESSION_STARTED_AT"
 * a sound "from a DEAD prior process" test (Phase 3 / NAV-adjacent). Date.now is
 * fine here — this is app runtime, not a replay-sensitive workflow script.
 */
export const SESSION_STARTED_AT = new Date().toISOString();

let didOrphanSweep = false;
/**
 * Gate the orphan sweep to ONCE per app launch (this module's lifetime). Returns
 * true on the first call, false after; a cold launch re-imports the module and
 * resets it. Prevents a later same-session Upload focus from re-sweeping (and
 * never racing a report being created/parsed THIS session).
 */
export function claimOrphanSweep(): boolean {
  if (didOrphanSweep) return false;
  didOrphanSweep = true;
  return true;
}

/** In-flight (non-terminal) statuses — the only ones a dead process can strand. */
const IN_FLIGHT: ReadonlySet<ReportParseStatus> = new Set(["pending", "parsing"]);

/**
 * Reconcile orphaned in-flight uploads left by a DEAD prior process (a hard kill
 * during review: the `beforeRemove` abandon guard never fires, so a 'parsing'
 * row + its encrypted blob linger). Removes the row AND blob for each report
 * that is:
 *   - in a non-terminal status (pending/parsing), AND
 *   - uploaded BEFORE this session (`uploaded_at < sessionStartedAt`) — so a
 *     report being uploaded/parsed THIS session is never touched, regardless of
 *     parse/navigation timing, AND
 *   - has NO committed observation (re-checked immediately before delete).
 *
 * NEVER deletes a report with committed values (append-only invariant 4): those
 * survive removal of their source document. Best-effort + non-throwing.
 */
export async function reconcileOrphanedReports(
  dal: LocalDataDAL,
  userId: string,
  sessionStartedAt: string,
): Promise<{ removed: number }> {
  let removed = 0;
  let reports: ReportRow[];
  try {
    reports = await dal.listReports(userId);
  } catch (err) {
    console.warn("[reconcileOrphanedReports] listReports failed", err);
    return { removed };
  }
  for (const r of reports) {
    if (!IN_FLIGHT.has(r.parse_status)) continue; // terminal -> never an orphan
    if (r.uploaded_at >= sessionStartedAt) continue; // this session -> leave it
    // Re-check committed observations IMMEDIATELY before deleting (guard the
    // check->delete window): a report with any committed value is not an orphan.
    let obsCount: number;
    try {
      obsCount = (await dal.listObservations({ report_id: r.id })).length;
    } catch {
      continue; // can't verify ownership of values -> do not delete (safe)
    }
    if (obsCount > 0) continue; // has committed readings -> never touch
    await removeReport(dal, r.id);
    removed += 1;
  }
  return { removed };
}

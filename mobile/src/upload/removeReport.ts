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
import type { LocalDataDAL } from "@/contracts";

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

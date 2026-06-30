/**
 * reports DAL — owned by mobile-local-data-modeler (Wave 1).
 *
 * A `report` is a pointer + metadata to an encrypted on-device blob
 * (PDF/JPG/etc.) the user uploaded. The blob itself lives outside the DB
 * at `file_blob_ref`; the DAL never opens it.
 *
 * Mutations:
 *   - insertReport: write the pointer + initial 'pending' status.
 *   - updateReportParseStatus: the parse pipeline transitions a row
 *     through pending → parsing → confirmed/partial/rejected. This is the
 *     ONE documented exception to append-only on the mobile DB: the row's
 *     status reflects ongoing pipeline state, not a corrected health value.
 *     The pipeline writes the extracted observations (which ARE append-
 *     only) into the observations table linked by `report_id`.
 *   - renameReport: update `original_filename` when the user names the report
 *     on the review screen. Metadata only — same surface as the status update,
 *     never a health value.
 *
 * Contract: mobile/src/contracts/LocalDataDAL.ts (frozen).
 */

import type {
  ReportInsertInput,
  ReportParseStatus,
  ReportRow,
} from "@/contracts/LocalDataDAL";
import type { SqliteAdapter, SqliteParam } from "../types";
import { uuidv4 } from "../uuid";

const COLUMNS =
  "id, user_id, type, file_blob_ref, original_filename, uploaded_at, parsed_at, parse_status, summary_text";

export async function insertReport(
  db: SqliteAdapter,
  input: ReportInsertInput,
): Promise<{ id: string }> {
  const id = input.id ?? uuidv4();
  const uploaded_at = input.uploaded_at ?? new Date().toISOString();
  const parse_status = input.parse_status ?? "pending";
  const summary_text = input.summary_text ?? null;

  const params: ReadonlyArray<SqliteParam> = [
    id,
    input.user_id,
    input.type,
    input.file_blob_ref,
    input.original_filename,
    uploaded_at,
    null, // parsed_at — set when status becomes confirmed/partial/rejected
    parse_status,
    summary_text,
  ];
  await db.runAsync(
    `INSERT INTO reports (${COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    params,
  );
  return { id };
}

export async function getReport(
  db: SqliteAdapter,
  id: string,
): Promise<ReportRow | null> {
  const row = await db.getFirstAsync<ReportRow>(
    `SELECT ${COLUMNS} FROM reports WHERE id = ?`,
    [id],
  );
  return row ?? null;
}

export async function listReports(
  db: SqliteAdapter,
  userId: string,
): Promise<ReportRow[]> {
  return db.getAllAsync<ReportRow>(
    `SELECT ${COLUMNS} FROM reports WHERE user_id = ?
     ORDER BY uploaded_at DESC`,
    [userId],
  );
}

export async function updateReportParseStatus(
  db: SqliteAdapter,
  id: string,
  status: ReportParseStatus,
  summary?: string,
): Promise<void> {
  // parsed_at is stamped when the pipeline reaches a terminal state.
  const parsedAt =
    status === "confirmed" || status === "partial" || status === "rejected"
      ? new Date().toISOString()
      : null;

  if (summary !== undefined) {
    await db.runAsync(
      `UPDATE reports
       SET parse_status = ?, parsed_at = COALESCE(?, parsed_at), summary_text = ?
       WHERE id = ?`,
      [status, parsedAt, summary, id],
    );
  } else {
    await db.runAsync(
      `UPDATE reports
       SET parse_status = ?, parsed_at = COALESCE(?, parsed_at)
       WHERE id = ?`,
      [status, parsedAt, id],
    );
  }
}

/**
 * Rename a report (its `original_filename`). Metadata only — never a health
 * value. Used when the user names the report on the review screen.
 */
export async function renameReport(
  db: SqliteAdapter,
  id: string,
  name: string,
): Promise<void> {
  await db.runAsync(`UPDATE reports SET original_filename = ? WHERE id = ?`, [
    name,
    id,
  ]);
}

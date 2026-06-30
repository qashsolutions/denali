/**
 * analyses DAL — owned by mobile-local-data-modeler (Wave 1).
 *
 * On-device record of a transient Bedrock inference. Phase-1 invariant 5
 * keeps the analysis OFF the server (no logs, no cache). The user's own
 * device keeps the audit/recall trail.
 *
 * Append-only: insertAnalysis only. There is no UPDATE on a recorded
 * inference — re-running the analysis writes a new row.
 *
 * Contract: mobile/src/contracts/LocalDataDAL.ts (frozen).
 */

import type {
  AnalysisInsertInput,
  AnalysisRow,
} from "@/contracts/LocalDataDAL";
import type { SqliteAdapter, SqliteParam } from "../types";
import { uuidv4 } from "../uuid";

const COLUMNS =
  "id, user_id, requested_at, input_observation_ids_json, model_used, result_text, result_structured_json";

export async function insertAnalysis(
  db: SqliteAdapter,
  input: AnalysisInsertInput,
): Promise<{ id: string }> {
  const id = input.id ?? uuidv4();
  const requested_at = input.requested_at ?? new Date().toISOString();
  const params: ReadonlyArray<SqliteParam> = [
    id,
    input.user_id,
    requested_at,
    input.input_observation_ids_json,
    input.model_used,
    input.result_text,
    input.result_structured_json,
  ];
  await db.runAsync(
    `INSERT INTO analyses (${COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    params,
  );
  return { id };
}

export async function listAnalyses(
  db: SqliteAdapter,
  userId: string,
  limit?: number,
): Promise<AnalysisRow[]> {
  const limitSql =
    limit && Number.isFinite(limit) && limit > 0
      ? ` LIMIT ${Math.floor(limit)}`
      : "";
  return db.getAllAsync<AnalysisRow>(
    `SELECT ${COLUMNS} FROM analyses
     WHERE user_id = ?
     ORDER BY requested_at DESC${limitSql}`,
    [userId],
  );
}

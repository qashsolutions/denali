/**
 * conditions DAL — owned by mobile-local-data-modeler (Wave 1).
 *
 * Local mirror of the server's `user_conditions` table
 * (scripts/migrate-user-prerequisites.sql). Mobile extends the `source`
 * enum with `uploaded_report` (server has claims | self_reported | ehr).
 *
 * Append-only at the value level: there is no UPDATE on a condition's
 * category/source/started_at. Closing a condition is a one-shot mutation
 * to `ended_at`, which is the documented exception (mirrors the server)
 * and is NOT exposed by this DAL in Wave 1 — Phase 1 onboarding only
 * INSERTs conditions; closure semantics will land with the timeline view.
 *
 * Contract: mobile/src/contracts/LocalDataDAL.ts (frozen).
 */

import type {
  ConditionInsertInput,
  ConditionRow,
  ConditionsFilter,
} from "@/contracts/LocalDataDAL";
import type { SqliteAdapter, SqliteParam } from "../types";
import { uuidv4 } from "../uuid";

const COLUMNS =
  "id, user_id, condition_code, condition_category, source, started_at, ended_at, confidence";

export async function insertCondition(
  db: SqliteAdapter,
  input: ConditionInsertInput,
): Promise<{ inserted: boolean; id: string }> {
  const id = input.id ?? uuidv4();
  const params: ReadonlyArray<SqliteParam> = [
    id,
    input.user_id,
    input.condition_code,
    input.condition_category,
    input.source,
    input.started_at,
    input.ended_at,
    input.confidence,
  ];
  const result = await db.runAsync(
    `INSERT INTO conditions (${COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    params,
  );
  return { inserted: result.changes > 0, id };
}

export async function listConditions(
  db: SqliteAdapter,
  userId: string,
  filter: ConditionsFilter = {},
): Promise<ConditionRow[]> {
  const where: string[] = ["user_id = ?"];
  const params: SqliteParam[] = [userId];

  if (filter.category) {
    where.push("condition_category = ?");
    params.push(filter.category);
  }
  if (filter.source) {
    where.push("source = ?");
    params.push(filter.source);
  }
  const activeOnly = filter.active_only ?? true;
  if (activeOnly) {
    where.push("ended_at IS NULL");
  }

  return db.getAllAsync<ConditionRow>(
    `SELECT ${COLUMNS} FROM conditions
     WHERE ${where.join(" AND ")}
     ORDER BY started_at DESC`,
    params,
  );
}

/**
 * observations DAL — owned by mobile-local-data-modeler (Wave 1).
 *
 * Implements the observations subset of `LocalDataDAL` against any
 * `SqliteAdapter` (production: SQLCipher via expo-sqlite; tests: an
 * in-memory better-sqlite3 adapter).
 *
 * APPEND-ONLY INVARIANT (mirror of server's diabetes_snapshots pattern):
 *   - insertObservation issues INSERT … ON CONFLICT DO NOTHING against the
 *     UNIQUE(user_id, code, effective_at) index. A duplicate is a no-op:
 *     the return value reports `inserted: false` and the original row is
 *     untouched.
 *   - Corrections insert a NEW row with `supersedes_id` pointing at the
 *     old row. This module exposes that via the input field — there is NO
 *     `updateObservation`, NO `deleteObservation`, and there will never be.
 *   - `listObservations({ latest_only: true })` walks the supersedes chain
 *     and returns only rows that no other row points at.
 *
 * Spec: docs/design/phase-1-45plus.md § Local data model
 * Contract: mobile/src/contracts/LocalDataDAL.ts (frozen — do not redefine).
 */

import type {
  ObservationInsertInput,
  ObservationRow,
  ObservationsFilter,
} from "@/contracts/LocalDataDAL";
import type { SqliteAdapter, SqliteParam } from "../types";
import { uuidv4 } from "../uuid";

const COLUMNS =
  "id, user_id, category, code_system, code, display, value_num, value_text, " +
  "unit, source, effective_at, recorded_at, report_id, supersedes_id, metadata_json";

export async function insertObservation(
  db: SqliteAdapter,
  input: ObservationInsertInput,
): Promise<{ inserted: boolean; id: string }> {
  const id = input.id ?? uuidv4();
  const recorded_at = input.recorded_at ?? new Date().toISOString();

  const params: ReadonlyArray<SqliteParam> = [
    id,
    input.user_id,
    input.category,
    input.code_system,
    input.code,
    input.display,
    input.value_num,
    input.value_text,
    input.unit,
    input.source,
    input.effective_at,
    recorded_at,
    input.report_id,
    input.supersedes_id,
    input.metadata_json,
  ];

  // ON CONFLICT DO NOTHING is the mobile spelling of the server's same
  // clause; SQLite has supported it since 3.24 (well below SQLCipher's
  // floor). Targeting the UNIQUE(user_id, code, effective_at) index keeps
  // the no-op semantics narrow — PK collisions still raise.
  const result = await db.runAsync(
    `INSERT INTO observations (${COLUMNS})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id, code, effective_at) DO NOTHING`,
    params,
  );

  return { inserted: result.changes > 0, id };
}

export async function getObservation(
  db: SqliteAdapter,
  id: string,
): Promise<ObservationRow | null> {
  const row = await db.getFirstAsync<ObservationRow>(
    `SELECT ${COLUMNS} FROM observations WHERE id = ?`,
    [id],
  );
  return row ?? null;
}

export async function getLatestObservation(
  db: SqliteAdapter,
  userId: string,
  code: string,
): Promise<ObservationRow | null> {
  // "Latest non-superseded" = newest effective_at among rows that no other
  // row points at via supersedes_id.
  const row = await db.getFirstAsync<ObservationRow>(
    `SELECT ${COLUMNS} FROM observations o
     WHERE o.user_id = ?
       AND o.code = ?
       AND NOT EXISTS (
         SELECT 1 FROM observations s WHERE s.supersedes_id = o.id
       )
     ORDER BY o.effective_at DESC
     LIMIT 1`,
    [userId, code],
  );
  return row ?? null;
}

export async function listObservations(
  db: SqliteAdapter,
  filter: ObservationsFilter = {},
): Promise<ObservationRow[]> {
  const where: string[] = [];
  const params: SqliteParam[] = [];

  if (filter.category) {
    where.push("o.category = ?");
    params.push(filter.category);
  }
  if (filter.code_system) {
    where.push("o.code_system = ?");
    params.push(filter.code_system);
  }
  if (filter.code) {
    where.push("o.code = ?");
    params.push(filter.code);
  }
  if (filter.report_id) {
    where.push("o.report_id = ?");
    params.push(filter.report_id);
  }
  if (filter.since) {
    where.push("o.effective_at >= ?");
    params.push(filter.since);
  }
  if (filter.until) {
    where.push("o.effective_at < ?");
    params.push(filter.until);
  }

  // Default = latest only. Callers who want the full history (e.g., an
  // audit view) pass `latest_only: false` explicitly.
  const latestOnly = filter.latest_only ?? true;
  if (latestOnly) {
    where.push(
      "NOT EXISTS (SELECT 1 FROM observations s WHERE s.supersedes_id = o.id)",
    );
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const limitSql =
    filter.limit && Number.isFinite(filter.limit) && filter.limit > 0
      ? ` LIMIT ${Math.floor(filter.limit)}`
      : "";

  return db.getAllAsync<ObservationRow>(
    `SELECT ${COLUMNS} FROM observations o ${whereSql}
     ORDER BY o.effective_at DESC${limitSql}`,
    params,
  );
}

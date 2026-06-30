/**
 * profile DAL — owned by mobile-local-data-modeler (Wave 1).
 *
 * The local `profile` table holds a mirror of the authenticated user's
 * cohort + plan fields. It is single-row in practice (one user per device
 * install); `getProfile()` returns the most recently updated row to be
 * resilient to multi-account testing.
 *
 * `upsertProfile` honors `id` as the natural key (Cognito sub). Re-upserting
 * the same id merges supplied fields onto the existing row and bumps
 * `updated_at`. The first upsert stamps `created_at`.
 *
 * Bool fields use SQLite's 0/1 INTEGER convention. We marshal to/from
 * JS booleans here so contract consumers always see `is_on_medicare:
 * boolean | null`, never a stray 0/1.
 *
 * Contract: mobile/src/contracts/LocalDataDAL.ts (frozen).
 */

import type {
  ProfileRow,
  ProfileUpsertInput,
} from "@/contracts/LocalDataDAL";
import type { SqliteAdapter, SqliteParam } from "../types";

/** Row shape as it sits in SQLite (boolean → 0/1). */
interface ProfileRowDb extends Omit<ProfileRow, "is_on_medicare"> {
  is_on_medicare: number | null;
}

function marshal(row: ProfileRowDb): ProfileRow {
  return {
    ...row,
    is_on_medicare:
      row.is_on_medicare === null ? null : row.is_on_medicare === 1,
  };
}

function boolToInt(b: boolean | null | undefined): number | null {
  if (b === null || b === undefined) return null;
  return b ? 1 : 0;
}

const COLUMNS =
  "id, email, plan, birth_year, is_on_medicare, sex_at_birth, gender_identity, created_at, updated_at";

export async function getProfile(
  db: SqliteAdapter,
): Promise<ProfileRow | null> {
  const row = await db.getFirstAsync<ProfileRowDb>(
    `SELECT ${COLUMNS} FROM profile ORDER BY updated_at DESC LIMIT 1`,
    [],
  );
  return row ? marshal(row) : null;
}

export async function upsertProfile(
  db: SqliteAdapter,
  input: ProfileUpsertInput,
): Promise<ProfileRow> {
  const now = new Date().toISOString();

  // Read existing row (if any) so we can preserve unsupplied fields without
  // depending on SQLite's optional ON CONFLICT DO UPDATE clause variants
  // across versions.
  const existing = await db.getFirstAsync<ProfileRowDb>(
    `SELECT ${COLUMNS} FROM profile WHERE id = ?`,
    [input.id],
  );

  const next: ProfileRowDb = {
    id: input.id,
    email: input.email,
    plan: input.plan ?? existing?.plan ?? "trial",
    birth_year:
      input.birth_year !== undefined ? input.birth_year : existing?.birth_year ?? null,
    is_on_medicare:
      input.is_on_medicare !== undefined
        ? boolToInt(input.is_on_medicare)
        : existing?.is_on_medicare ?? null,
    sex_at_birth:
      input.sex_at_birth !== undefined
        ? input.sex_at_birth
        : existing?.sex_at_birth ?? null,
    gender_identity:
      input.gender_identity !== undefined
        ? input.gender_identity
        : existing?.gender_identity ?? null,
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };

  const params: ReadonlyArray<SqliteParam> = [
    next.id,
    next.email,
    next.plan,
    next.birth_year,
    next.is_on_medicare,
    next.sex_at_birth,
    next.gender_identity,
    next.created_at,
    next.updated_at,
  ];

  if (existing) {
    await db.runAsync(
      `UPDATE profile SET
         email = ?, plan = ?, birth_year = ?, is_on_medicare = ?,
         sex_at_birth = ?, gender_identity = ?, updated_at = ?
       WHERE id = ?`,
      [
        next.email,
        next.plan,
        next.birth_year,
        next.is_on_medicare,
        next.sex_at_birth,
        next.gender_identity,
        next.updated_at,
        next.id,
      ],
    );
  } else {
    await db.runAsync(
      `INSERT INTO profile (${COLUMNS})
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      params,
    );
  }

  return marshal(next);
}

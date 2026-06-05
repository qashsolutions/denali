/**
 * Minimal database adapter shape — the seam between the DAL and whatever
 * SQLite client is in use. The production binding is `expo-sqlite`'s
 * `SQLiteDatabase` (Turbo Module, New Architecture, SDK 56). Unit tests
 * pass an in-memory adapter backed by `better-sqlite3` (Node-only, no
 * SQLCipher — tests exercise schema + DAL logic, not the encryption layer).
 *
 * This narrow shape is intentional: every method the DAL needs maps 1:1
 * onto `expo-sqlite`'s real API (execAsync / runAsync / getFirstAsync /
 * getAllAsync). Avoid widening it — if a DAL function needs a new
 * primitive, it almost certainly should compose the existing ones instead.
 */

export interface SqliteRunResult {
  /** SQLite's `changes()` after the last write. 0 means ON CONFLICT skipped. */
  changes: number;
  /** SQLite's `last_insert_rowid()`; not used by the DAL (we generate UUIDs). */
  lastInsertRowId?: number;
}

export type SqliteParam = string | number | null;

export interface SqliteAdapter {
  /** Execute one or more statements with no params and no result. */
  execAsync(sql: string): Promise<void>;
  /** Run a parameterized INSERT/UPDATE/DELETE, return changes/lastInsertRowId. */
  runAsync(sql: string, params: ReadonlyArray<SqliteParam>): Promise<SqliteRunResult>;
  /** SELECT first row, return null when empty. */
  getFirstAsync<T>(sql: string, params: ReadonlyArray<SqliteParam>): Promise<T | null>;
  /** SELECT all rows. */
  getAllAsync<T>(sql: string, params: ReadonlyArray<SqliteParam>): Promise<T[]>;
  /** Run `task` inside BEGIN/COMMIT (ROLLBACK on throw). */
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

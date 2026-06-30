/**
 * In-memory test adapter — wraps `better-sqlite3` in the `SqliteAdapter`
 * shape so unit tests exercise the same DAL code that ships against
 * SQLCipher in production.
 *
 * This adapter does NOT speak SQLCipher. The unit tests here validate
 * schema + DAL logic (append-only, supersede, enums, filters). The
 * encryption layer is the responsibility of `src/db/keystore.ts` + the
 * `useSQLCipher` plugin config in `app.config.ts`; both are validated by
 * the keystore tests and by the E2E build, not by these unit tests.
 *
 * Why not better-sqlite3-multiple-ciphers? It exists, but pulling another
 * native dependency just to test the PRAGMA-key dance adds cost without
 * coverage value — the dance is one line of code and the schema is
 * identical with or without cipher pages.
 */

import Database from "better-sqlite3";
import { MIGRATIONS } from "../migrations";
import type { SqliteAdapter, SqliteParam, SqliteRunResult } from "../types";

export interface TestAdapter extends SqliteAdapter {
  close(): void;
  /** Direct access for assertions that need raw rows. */
  raw: Database.Database;
}

export function createTestAdapter(): TestAdapter {
  const db = new Database(":memory:");
  // Match prod pragmas (excluding the SQLCipher key, which is a no-op here).
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const adapter: TestAdapter = {
    raw: db,
    close: () => db.close(),

    async execAsync(sql: string): Promise<void> {
      // better-sqlite3 `exec` runs multi-statement SQL with no params.
      db.exec(sql);
    },

    async runAsync(
      sql: string,
      params: ReadonlyArray<SqliteParam>,
    ): Promise<SqliteRunResult> {
      const stmt = db.prepare(sql);
      const info = stmt.run(...params);
      return {
        changes: info.changes,
        lastInsertRowId: Number(info.lastInsertRowid),
      };
    },

    async getFirstAsync<T>(
      sql: string,
      params: ReadonlyArray<SqliteParam>,
    ): Promise<T | null> {
      const stmt = db.prepare(sql);
      const row = stmt.get(...params) as T | undefined;
      return row ?? null;
    },

    async getAllAsync<T>(
      sql: string,
      params: ReadonlyArray<SqliteParam>,
    ): Promise<T[]> {
      const stmt = db.prepare(sql);
      return stmt.all(...params) as T[];
    },

    async withTransactionAsync(task: () => Promise<void>): Promise<void> {
      db.exec("BEGIN");
      try {
        await task();
        db.exec("COMMIT");
      } catch (e) {
        db.exec("ROLLBACK");
        throw e;
      }
    },
  };

  // Apply all migrations to make a ready-to-use adapter.
  for (const m of MIGRATIONS) {
    db.exec(m.sql);
  }

  return adapter;
}

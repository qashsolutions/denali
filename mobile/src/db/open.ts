/**
 * SQLCipher DB open + migration runner — owned by mobile-local-data-modeler.
 *
 * Responsibilities:
 *   1. Resolve the SQLCipher passphrase from the on-device keystore
 *      (src/db/keystore.ts — never the network, never the JWT).
 *   2. Open the SQLCipher database via expo-sqlite (`useSQLCipher: true`
 *      is set in app.config.ts so the native module compiles against
 *      SQLCipher).
 *   3. Issue `PRAGMA key = "x'<hex>'"` as the FIRST statement after open.
 *      Until this PRAGMA runs, the DB is unreadable; once it runs, reads
 *      and writes proceed transparently for the rest of the process.
 *   4. Run any pending migrations idempotently (read `schema_migrations`,
 *      apply newer entries in order, record success).
 *
 * Invariants:
 *   2. Encrypted at rest — useSQLCipher + PRAGMA key.
 *   3. Login ≠ encryption key — passphrase comes from keystore.ts only.
 *   4. Append-only schema — installed by 001-init.
 *
 * NOTE: This module imports `expo-sqlite`, which means it CANNOT run under
 * the Node-only vitest environment. Unit tests use `createTestAdapter()`
 * in `src/db/__tests__/_testAdapter.ts` to wire the DAL directly against
 * an in-memory `better-sqlite3` instance and skip this module entirely.
 */

import * as SQLite from "expo-sqlite";
import { getOrCreateDbKey } from "./keystore";
import { MIGRATIONS } from "./migrations";
import type { SqliteAdapter, SqliteParam, SqliteRunResult } from "./types";

const DB_FILENAME = "denali.sqlcipher.db";

/**
 * Wraps the expo-sqlite SQLiteDatabase in our narrow SqliteAdapter shape so
 * the DAL has a single interface to test against (the unit-test adapter
 * implements the same surface against `better-sqlite3`).
 */
function adaptExpoDatabase(db: SQLite.SQLiteDatabase): SqliteAdapter {
  return {
    execAsync: (sql) => db.execAsync(sql),
    runAsync: async (sql, params): Promise<SqliteRunResult> => {
      const r = await db.runAsync(sql, params as SqliteParam[]);
      return { changes: r.changes, lastInsertRowId: r.lastInsertRowId };
    },
    getFirstAsync: <T,>(sql: string, params: ReadonlyArray<SqliteParam>) =>
      db.getFirstAsync<T>(sql, params as SqliteParam[]),
    getAllAsync: <T,>(sql: string, params: ReadonlyArray<SqliteParam>) =>
      db.getAllAsync<T>(sql, params as SqliteParam[]),
    withTransactionAsync: (task) => db.withTransactionAsync(task),
  };
}

/**
 * Apply any migrations whose version > the latest recorded version.
 * Idempotent: re-running on a fresh DB applies everything; re-running on
 * a fully-migrated DB applies nothing.
 */
async function runMigrations(db: SqliteAdapter): Promise<void> {
  // Ensure schema_migrations exists before we read from it. Every shipping
  // migration declares it via CREATE TABLE IF NOT EXISTS too, so a fresh DB
  // is fine either way; this preflight just lets the SELECT below succeed
  // unconditionally on a brand-new DB.
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       version    INTEGER PRIMARY KEY,
       name       TEXT NOT NULL,
       applied_at TEXT NOT NULL
     );`,
  );

  const applied = await db.getAllAsync<{ version: number }>(
    "SELECT version FROM schema_migrations",
    [],
  );
  const appliedVersions = new Set(applied.map((r) => r.version));

  for (const m of MIGRATIONS) {
    if (appliedVersions.has(m.version)) continue;
    // NB: expo-sqlite's `execAsync` cannot run inside an explicit
    // transaction — wrapping this block in `withTransactionAsync` triggers
    // SQLite's "cannot start a transaction within a transaction" on iOS
    // (validated on iPhone 16 Pro simulator, 2026-06-05). All Phase 1
    // migrations use `CREATE TABLE IF NOT EXISTS` so re-running on partial
    // state is safe (idempotent). If a future migration needs atomicity
    // across multiple write statements, split them into individual
    // `runAsync` calls wrapped in `withTransactionAsync` — never
    // `execAsync` inside a transaction.
    await db.execAsync(m.sql);
    await db.runAsync(
      "INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)",
      [m.version, m.name, new Date().toISOString()],
    );
  }
}

/**
 * Quote a hex-encoded key for SQLCipher's `PRAGMA key = x'<hex>'` form.
 * Defensive: reject anything that isn't lowercase hex of the expected length
 * so a corrupted keystore entry can't slip past as a literal string key.
 */
function quoteHexKey(hex: string): string {
  if (!/^[0-9a-f]+$/.test(hex)) {
    throw new Error(
      "[db.open] Refusing to open SQLCipher DB: keystore returned a non-hex value.",
    );
  }
  if (hex.length !== 64) {
    throw new Error(
      `[db.open] Refusing to open SQLCipher DB: expected 32-byte key (64 hex chars), got ${hex.length}.`,
    );
  }
  return `x'${hex}'`;
}

/**
 * Cache the in-flight PROMISE, not the resolved adapter. If two callers race
 * to open the DB before the first resolution lands (DalProvider mount +
 * useEffect probe, two screens hydrating, etc.), the second caller must
 * `await` the same promise — otherwise both would call
 * `SQLite.openDatabaseAsync`, both would run the migration runner, and the
 * second migration's `INSERT INTO schema_migrations` would collide with the
 * first via the version PK UNIQUE constraint. Validated on Android emulator
 * 2026-06-08; iOS happened to win the race differently but had the same
 * exposure. Vitest missed it because the test adapter bypasses this module.
 */
let cachedDbPromise: Promise<SqliteAdapter> | null = null;

/**
 * Open the SQLCipher database (process-singleton). Subsequent calls return
 * the cached adapter without re-opening, re-keying, or re-migrating.
 *
 * Concurrent callers all `await` the same in-flight promise. If that promise
 * REJECTS (keystore unavailable, PRAGMA failure, etc.) we null the cache so
 * the next caller can retry rather than be poisoned forever by a stale
 * rejected promise.
 */
export async function openLocalDb(): Promise<SqliteAdapter> {
  if (cachedDbPromise) return cachedDbPromise;

  cachedDbPromise = (async () => {
    const key = await getOrCreateDbKey();
    const raw = await SQLite.openDatabaseAsync(DB_FILENAME);

    // CRITICAL: this PRAGMA must be the first statement on the connection,
    // before any read/write. Once issued, SQLCipher derives the page key
    // and the rest of the session is transparent.
    await raw.execAsync(`PRAGMA key = "${quoteHexKey(key)}"`);

    // Recommended defaults — WAL for concurrency, foreign_keys for safety.
    // (Foreign keys aren't declared in 001-init, but enabling the pragma is
    //  cheap and forward-compatible if a future migration adds them.)
    await raw.execAsync("PRAGMA journal_mode = WAL");
    await raw.execAsync("PRAGMA foreign_keys = ON");

    const adapter = adaptExpoDatabase(raw);
    await runMigrations(adapter);
    return adapter;
  })();

  // Never cache a rejected open — clear the slot so the next caller retries.
  // Attached as `.catch(noop)` rather than awaited, so this is a side-effect
  // observer on the same promise; we still return the original promise above.
  cachedDbPromise.catch(() => {
    cachedDbPromise = null;
  });

  return cachedDbPromise;
}

/** Test-only — clear the cached singleton so a test can re-open. */
export function __resetDbCacheForTests(): void {
  cachedDbPromise = null;
}

/** Exposed for tests so they can drive the migration runner directly. */
export const __migrationRunnerForTests = runMigrations;

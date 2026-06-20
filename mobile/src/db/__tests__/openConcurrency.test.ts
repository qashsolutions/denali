/**
 * open.ts concurrency + cache-on-rejection tests.
 *
 * Validated against the Android-emulator bug surfaced on 2026-06-08:
 *   • DalProvider mount and a devSelfTests probe both called openLocalDb()
 *     before either resolved. The original cache (`cachedDb: SqliteAdapter`)
 *     was set only AFTER the open + migrations completed, so both callers
 *     past the guard, both ran `runMigrations`, and the second
 *     `INSERT INTO schema_migrations` collided on the version PK
 *     (`UNIQUE constraint failed: schema_migrations.version`).
 *
 * The fix is to cache the in-flight PROMISE rather than the resolved
 * adapter, so a second concurrent caller awaits the same promise. These
 * tests prove the fix holds in two scenarios:
 *
 *   (a) Two parallel openLocalDb() calls → SQLite.openDatabaseAsync and
 *       the migration runner each execute exactly once.
 *   (b) An initial reject → cache cleared → next call retries
 *       (SQLite.openDatabaseAsync called twice total).
 *
 * Both tests mock expo-sqlite at the module boundary so we can control
 * resolution timing via a deferred promise (no real DB involved). The
 * keystore is mocked too so we don't touch SecureStore.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

import { MIGRATIONS } from "../migrations";

// ──────────────────────────────────────────────────────────────────────
// Module mocks
//
// The keystore returns a fixed 64-char hex key so quoteHexKey accepts it.
// ──────────────────────────────────────────────────────────────────────
const HEX_KEY_64 = "a".repeat(64);
vi.mock("../keystore", () => ({
  getOrCreateDbKey: vi.fn(async () => HEX_KEY_64),
}));

// Controllable deferred — created fresh per test in beforeEach.
type Deferred<T> = {
  promise: Promise<T>;
  resolve: (v: T) => void;
  reject: (e: unknown) => void;
};
function defer<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Per-test state captured by the mock factory via closure.
interface FakeDb {
  execAsync: ReturnType<typeof vi.fn>;
  runAsync: ReturnType<typeof vi.fn>;
  getFirstAsync: ReturnType<typeof vi.fn>;
  getAllAsync: ReturnType<typeof vi.fn>;
  withTransactionAsync: ReturnType<typeof vi.fn>;
}

interface MockSqliteState {
  openCalls: number;
  // Stack of deferreds: each call to openDatabaseAsync pops the next one.
  // Tests push deferreds before calling openLocalDb so they control timing.
  openDeferreds: Deferred<FakeDb>[];
}

// We share this between the mock factory and the test via the module
// namespace import below — vitest's `vi.mock` hoists, but the factory can
// reference variables that live in the closure if they're declared with
// `var` semantics (function-hoisted). To keep things simple, expose an
// initialiser the test calls per-`it` to (re-)wire the state.
const sqliteState: MockSqliteState = { openCalls: 0, openDeferreds: [] };

vi.mock("expo-sqlite", () => ({
  openDatabaseAsync: vi.fn(async (_filename: string) => {
    sqliteState.openCalls += 1;
    const next = sqliteState.openDeferreds.shift();
    if (!next) {
      throw new Error(
        "openConcurrency.test: no deferred enqueued for this openDatabaseAsync call",
      );
    }
    return next.promise;
  }),
}));

// ──────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────

function makeFakeDb(): FakeDb {
  // schema_migrations preflight returns no rows (fresh DB) — runner will
  // try to apply v1. execAsync + runAsync return arbitrary structures the
  // adapter wrapper consumes. We assert call counts, not return shape.
  return {
    execAsync: vi.fn(async () => undefined),
    runAsync: vi.fn(async () => ({ changes: 1, lastInsertRowId: 1 })),
    getFirstAsync: vi.fn(async () => null),
    getAllAsync: vi.fn(async () => [] as Array<{ version: number }>),
    withTransactionAsync: vi.fn(async (cb: () => Promise<void>) => {
      await cb();
    }),
  };
}

describe("openLocalDb — concurrency + cache-on-rejection", () => {
  beforeEach(async () => {
    sqliteState.openCalls = 0;
    sqliteState.openDeferreds = [];
    const { __resetDbCacheForTests } = await import("../open");
    __resetDbCacheForTests();
  });

  it("(a) two parallel callers share the SAME in-flight open — openDatabaseAsync + migrations run exactly once", async () => {
    // Arrange: enqueue ONE deferred for the single expected open. If the
    // implementation races, the second openDatabaseAsync call would throw
    // ("no deferred enqueued"), which itself is a failure signal.
    const d = defer<FakeDb>();
    sqliteState.openDeferreds.push(d);
    const fakeDb = makeFakeDb();

    const { openLocalDb } = await import("../open");

    // Fire two callers concurrently BEFORE the open resolves.
    const p1 = openLocalDb();
    const p2 = openLocalDb();

    // Now resolve the underlying open.
    d.resolve(fakeDb);

    const [a1, a2] = await Promise.all([p1, p2]);

    // Both callers got the SAME adapter (same identity through the same
    // factory call — assert via behavior since the adapter wraps the db).
    expect(a1).toBe(a2);

    // The native open ran exactly once.
    expect(sqliteState.openCalls).toBe(1);

    // The migration runner ran exactly once. Detect by counting INSERTs
    // into schema_migrations — the runner does one runAsync per pending
    // migration, so a single run inserts exactly MIGRATIONS.length rows. If
    // both runners executed (the race this test exists to prevent), we'd see
    // 2× that many (and the duplicate would have collided in real SQLite).
    const insertCalls = fakeDb.runAsync.mock.calls.filter((args) =>
      String(args[0]).includes("INSERT INTO schema_migrations"),
    );
    expect(insertCalls.length).toBe(MIGRATIONS.length);

    // The PRAGMA key statement ran exactly once too (proves the keying
    // step wasn't double-executed either).
    const pragmaKeyCalls = fakeDb.execAsync.mock.calls.filter((args) =>
      String(args[0]).startsWith("PRAGMA key"),
    );
    expect(pragmaKeyCalls.length).toBe(1);
  });

  it("(b) a rejected open clears the cache so the next call retries — openDatabaseAsync runs twice total", async () => {
    // Arrange: first deferred rejects, second resolves.
    const dFail = defer<FakeDb>();
    const dOk = defer<FakeDb>();
    sqliteState.openDeferreds.push(dFail, dOk);
    const fakeDbOk = makeFakeDb();

    const { openLocalDb } = await import("../open");

    // First attempt: reject.
    const p1 = openLocalDb();
    dFail.reject(new Error("simulated keystore unavailability"));
    await expect(p1).rejects.toThrow(/simulated keystore unavailability/);

    // The catch-handler on the cached promise schedules `cachedDbPromise = null`
    // as a microtask. Yield once so that microtask runs BEFORE we call
    // openLocalDb() again (otherwise the second call could observe the
    // still-set rejected cache and rethrow). One `await Promise.resolve()`
    // flushes pending microtasks.
    await Promise.resolve();

    // Second attempt: should re-open (cache cleared).
    const p2 = openLocalDb();
    dOk.resolve(fakeDbOk);
    const adapter = await p2;
    expect(adapter).toBeDefined();

    // Native open ran TWICE — the original failed attempt + the retry.
    expect(sqliteState.openCalls).toBe(2);
  });
});

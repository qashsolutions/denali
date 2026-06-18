/**
 * Unit coverage for the account-deletion local wipe (`wipeAllLocalData`).
 *
 * The full wipe can't be exercised on a device through the operator test
 * accounts (they are `is_admin` on staging, so the server returns 403 and the
 * wipe never runs). This pins the security-critical erase ORCHESTRATION:
 *   - secure_delete is enabled BEFORE the row deletes (zeroes freed pages),
 *   - every user table is DELETEd with a quoted identifier,
 *   - VACUUM runs AFTER the deletes (compacts + resets the WAL),
 *   - encrypted blobs, the in-memory blob key, and auth tokens are all cleared,
 *   - the function is fully best-effort: no single failure aborts the rest and
 *     it never rejects (the caller has already deleted the server account).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => {
  const execCalls: string[] = [];
  const state = {
    tables: [{ name: "observations" }, { name: "reports" }, { name: "profile" }],
    failTableDeleteContaining: null as string | null,
    failVacuum: false,
    failSecureDelete: false,
    openThrows: false,
  };
  const execAsync = vi.fn(async (sql: string) => {
    execCalls.push(sql);
    if (state.failSecureDelete && /secure_delete/i.test(sql)) {
      throw new Error("secure_delete failed");
    }
    if (state.failVacuum && /VACUUM/i.test(sql)) {
      throw new Error("vacuum failed");
    }
    if (
      state.failTableDeleteContaining &&
      sql.includes(state.failTableDeleteContaining)
    ) {
      throw new Error("delete failed");
    }
  });
  const getAllAsync = vi.fn(async (_q: string) => state.tables);
  const openLocalDb = vi.fn(async () => {
    if (state.openThrows) throw new Error("open failed");
    return { execAsync, getAllAsync };
  });
  const clearAllReportBlobs = vi.fn();
  const clearBlobKeyCache = vi.fn();
  const clearTokens = vi.fn(async () => {});
  return {
    execCalls,
    state,
    execAsync,
    getAllAsync,
    openLocalDb,
    clearAllReportBlobs,
    clearBlobKeyCache,
    clearTokens,
  };
});

vi.mock("../open", () => ({ openLocalDb: h.openLocalDb }));
vi.mock("@/upload/blobStore", () => ({
  clearAllReportBlobs: h.clearAllReportBlobs,
  clearBlobKeyCache: h.clearBlobKeyCache,
}));
vi.mock("@/auth/tokenStore", () => ({ clearTokens: h.clearTokens }));

import { wipeAllLocalData } from "../wipe";

const idx = (re: RegExp): number =>
  h.execCalls.findIndex((s) => re.test(s));

beforeEach(() => {
  vi.clearAllMocks();
  h.execCalls.length = 0;
  h.state.tables = [
    { name: "observations" },
    { name: "reports" },
    { name: "profile" },
  ];
  h.state.failTableDeleteContaining = null;
  h.state.failVacuum = false;
  h.state.failSecureDelete = false;
  h.state.openThrows = false;
});

describe("wipeAllLocalData — happy path", () => {
  it("enables secure_delete, deletes every table (quoted), then VACUUMs", async () => {
    await wipeAllLocalData();

    expect(h.openLocalDb).toHaveBeenCalledTimes(1);
    // secure_delete pragma issued.
    expect(idx(/PRAGMA secure_delete = ON/i)).toBeGreaterThanOrEqual(0);
    // Each table deleted with a double-quoted identifier.
    expect(h.execCalls).toContain('DELETE FROM "observations"');
    expect(h.execCalls).toContain('DELETE FROM "reports"');
    expect(h.execCalls).toContain('DELETE FROM "profile"');
    // VACUUM issued.
    expect(idx(/^VACUUM$/i)).toBeGreaterThanOrEqual(0);
  });

  it("orders secure_delete BEFORE deletes BEFORE vacuum", async () => {
    await wipeAllLocalData();
    const secure = idx(/secure_delete/i);
    const firstDelete = idx(/^DELETE FROM/i);
    const vacuum = idx(/^VACUUM$/i);
    expect(secure).toBeLessThan(firstDelete);
    expect(firstDelete).toBeLessThan(vacuum);
  });

  it("enumerates user tables excluding sqlite_% and schema_migrations", async () => {
    await wipeAllLocalData();
    const q = h.getAllAsync.mock.calls[0]?.[0] as string;
    expect(q).toMatch(/sqlite_%/);
    expect(q).toMatch(/schema_migrations/);
  });

  it("clears blobs, the in-memory blob key, and auth tokens", async () => {
    await wipeAllLocalData();
    expect(h.clearAllReportBlobs).toHaveBeenCalledTimes(1);
    expect(h.clearBlobKeyCache).toHaveBeenCalledTimes(1);
    expect(h.clearTokens).toHaveBeenCalledTimes(1);
  });

  it("escapes embedded quotes in table identifiers", async () => {
    h.state.tables = [{ name: 'weird"name' }];
    await wipeAllLocalData();
    expect(h.execCalls).toContain('DELETE FROM "weird""name"');
  });
});

describe("wipeAllLocalData — best-effort resilience (never rejects)", () => {
  it("keeps clearing remaining tables when one DELETE throws", async () => {
    h.state.failTableDeleteContaining = "observations";
    await expect(wipeAllLocalData()).resolves.toBeUndefined();
    // The other tables were still deleted.
    expect(h.execCalls).toContain('DELETE FROM "reports"');
    expect(h.execCalls).toContain('DELETE FROM "profile"');
    // VACUUM still attempted, and downstream cleanup still ran.
    expect(idx(/^VACUUM$/i)).toBeGreaterThanOrEqual(0);
    expect(h.clearTokens).toHaveBeenCalledTimes(1);
  });

  it("still clears blobs/key/tokens when the DB cannot be opened", async () => {
    h.state.openThrows = true;
    await expect(wipeAllLocalData()).resolves.toBeUndefined();
    expect(h.execAsync).not.toHaveBeenCalled();
    expect(h.clearAllReportBlobs).toHaveBeenCalledTimes(1);
    expect(h.clearBlobKeyCache).toHaveBeenCalledTimes(1);
    expect(h.clearTokens).toHaveBeenCalledTimes(1);
  });

  it("does not reject when VACUUM fails", async () => {
    h.state.failVacuum = true;
    await expect(wipeAllLocalData()).resolves.toBeUndefined();
    expect(h.clearTokens).toHaveBeenCalledTimes(1);
  });

  it("does not reject when the secure_delete pragma fails", async () => {
    h.state.failSecureDelete = true;
    await expect(wipeAllLocalData()).resolves.toBeUndefined();
    // Deletes still attempted after the pragma failure.
    expect(h.execCalls).toContain('DELETE FROM "observations"');
    expect(h.clearTokens).toHaveBeenCalledTimes(1);
  });
});

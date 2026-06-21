/**
 * tokenStore — unit tests.
 *
 * We mock expo-secure-store and assert:
 *   - The right SecureStore keys are used (matches the web's cookie names).
 *   - `setTokens` accepts both the full-bundle and access-only shapes.
 *   - `clearTokens` deletes all three keys and never throws.
 *
 * NEVER asserts on token VALUES via console output — the test reads back
 * via the mocked store directly, never through a log channel.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory mock store. Each test resets it via beforeEach.
const store = new Map<string, string>();

vi.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK: 1, // arbitrary numeric placeholder
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 2, // post-M1 device-bound class (matches keystore.ts)
  setItemAsync: vi.fn(async (key: string, value: string) => {
    store.set(key, value);
  }),
  getItemAsync: vi.fn(async (key: string) => store.get(key) ?? null),
  deleteItemAsync: vi.fn(async (key: string) => {
    store.delete(key);
  }),
}));

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  getSessionIssuedAt,
  getSessionUserId,
  setTokens,
} from "../tokenStore";

beforeEach(() => {
  store.clear();
  vi.clearAllMocks();
});

describe("tokenStore", () => {
  it("setTokens(full bundle) persists all keys (incl. session_user_id)", async () => {
    await setTokens({
      access: "access-jwt",
      refresh: "refresh-jwt",
      sessionIssuedAt: 1_700_000_000_000,
      sessionUserId: "owner-1",
    });

    expect(store.get("access_token")).toBe("access-jwt");
    expect(store.get("refresh_token")).toBe("refresh-jwt");
    expect(store.get("session_issued_at")).toBe("1700000000000");
    expect(store.get("session_user_id")).toBe("owner-1");
  });

  it("setTokens({access}) leaves refresh + session_issued_at + session_user_id untouched", async () => {
    // Prime existing values.
    await setTokens({
      access: "old-access",
      refresh: "existing-refresh",
      sessionIssuedAt: 1234,
      sessionUserId: "owner-1",
    });

    // Refresh-flow update: only access token rotates. The owner anchor (and
    // refresh + cap) must survive — a token refresh does not change who owns it.
    await setTokens({ access: "new-access" });

    expect(store.get("access_token")).toBe("new-access");
    expect(store.get("refresh_token")).toBe("existing-refresh");
    expect(store.get("session_issued_at")).toBe("1234");
    expect(store.get("session_user_id")).toBe("owner-1");
  });

  it("getters return null when nothing has been stored", async () => {
    expect(await getAccessToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
    expect(await getSessionIssuedAt()).toBeNull();
    expect(await getSessionUserId()).toBeNull();
  });

  it("getters round-trip stored values", async () => {
    await setTokens({
      access: "a",
      refresh: "r",
      sessionIssuedAt: 99,
      sessionUserId: "owner-1",
    });
    expect(await getAccessToken()).toBe("a");
    expect(await getRefreshToken()).toBe("r");
    expect(await getSessionIssuedAt()).toBe("99");
    expect(await getSessionUserId()).toBe("owner-1");
  });

  it("clearTokens removes all keys (incl. session_user_id)", async () => {
    await setTokens({
      access: "a",
      refresh: "r",
      sessionIssuedAt: 99,
      sessionUserId: "owner-1",
    });
    await clearTokens();
    expect(store.size).toBe(0);
    expect(await getAccessToken()).toBeNull();
    expect(await getRefreshToken()).toBeNull();
    expect(await getSessionIssuedAt()).toBeNull();
    expect(await getSessionUserId()).toBeNull();
  });

  it("clearTokens swallows per-key delete errors (idempotent on absent keys)", async () => {
    // Simulate SecureStore raising when the key was never written.
    const SecureStore = await import("expo-secure-store");
    (SecureStore.deleteItemAsync as ReturnType<typeof vi.fn>).mockImplementationOnce(
      async () => {
        throw new Error("Key not found");
      },
    );

    // Must not throw.
    await expect(clearTokens()).resolves.toBeUndefined();
  });
});

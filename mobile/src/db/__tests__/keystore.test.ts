/**
 * keystore tests — invariant 3 ("login ≠ encryption key") + first-launch
 * generation semantics.
 *
 * What these tests actually prove:
 *   1. The keystore module's only side-effecting dependency is
 *      `expo-secure-store`. It does NOT call `fetch`, does NOT import a
 *      network module, does NOT read any auth/JWT/Cognito value.
 *   2. `getOrCreateDbKey` takes NO inputs — its signature is `(): Promise<string>`.
 *      It cannot, by API shape alone, accept a server-derived seed.
 *   3. On first launch (no entry in SecureStore), it generates a fresh
 *      64-hex-char key and persists it.
 *   4. On subsequent launches, it returns the SAME key (idempotent).
 *   5. A corrupted entry (wrong length / non-hex) is rejected by the
 *      DB-open module, not silently accepted (covered by length + regex
 *      assertions in `quoteHexKey`; see __tests__/open.quoteHexKey.test.ts).
 *
 * We also do a static-import grep — see the bottom of the file — to make
 * the negative assertion visible: keystore.ts must not transitively pull
 * in `@/auth`, `node:net`, `fetch`, etc.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// In-memory mock of expo-secure-store. The vi.mock factory must run before
// the module-under-test is imported, so we declare it up top.
const secureStoreMem: Record<string, string> = {};
const secureStoreSpies = {
  getItemAsync: vi.fn(
    async (key: string): Promise<string | null> => secureStoreMem[key] ?? null,
  ),
  setItemAsync: vi.fn(async (key: string, value: string): Promise<void> => {
    secureStoreMem[key] = value;
  }),
  deleteItemAsync: vi.fn(async (key: string): Promise<void> => {
    delete secureStoreMem[key];
  }),
  isAvailableAsync: vi.fn(async (): Promise<boolean> => true),
};

vi.mock("expo-secure-store", () => ({
  ...secureStoreSpies,
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: "AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY",
  AFTER_FIRST_UNLOCK: "AFTER_FIRST_UNLOCK",
}));

describe("keystore", () => {
  beforeEach(() => {
    for (const k of Object.keys(secureStoreMem)) delete secureStoreMem[k];
    for (const spy of Object.values(secureStoreSpies)) spy.mockClear();
    // Re-default the availability spy in case a test overrode it.
    secureStoreSpies.isAvailableAsync.mockImplementation(async () => true);
  });

  it("generates a fresh 64-hex key on first launch and persists it", async () => {
    const { getOrCreateDbKey, __KEYSTORE_LABEL_FOR_TESTS } = await import(
      "../keystore"
    );

    expect(secureStoreSpies.getItemAsync).not.toHaveBeenCalled();
    const key = await getOrCreateDbKey();
    expect(key).toMatch(/^[0-9a-f]{64}$/);

    // Spec: read once (probe), write once (persist).
    expect(secureStoreSpies.getItemAsync).toHaveBeenCalledTimes(1);
    expect(secureStoreSpies.getItemAsync).toHaveBeenCalledWith(
      __KEYSTORE_LABEL_FOR_TESTS,
      expect.any(Object),
    );
    expect(secureStoreSpies.setItemAsync).toHaveBeenCalledTimes(1);
    expect(secureStoreMem[__KEYSTORE_LABEL_FOR_TESTS]).toBe(key);
  });

  it("returns the SAME key on subsequent launches (no regeneration)", async () => {
    const { getOrCreateDbKey } = await import("../keystore");
    const first = await getOrCreateDbKey();
    const writesAfterFirst = secureStoreSpies.setItemAsync.mock.calls.length;

    const second = await getOrCreateDbKey();
    expect(second).toBe(first);
    // No additional writes — the key is reused as-is.
    expect(secureStoreSpies.setItemAsync.mock.calls.length).toBe(
      writesAfterFirst,
    );
  });

  it("fails closed when SecureStore is unavailable (no AsyncStorage fallback)", async () => {
    secureStoreSpies.isAvailableAsync.mockImplementationOnce(async () => false);
    const { getOrCreateDbKey } = await import("../keystore");
    await expect(getOrCreateDbKey()).rejects.toThrow(/not available/);
    expect(secureStoreSpies.setItemAsync).not.toHaveBeenCalled();
  });

  it("uses platform CSPRNG only — no fallback when crypto is missing", async () => {
    // Node 24+ exposes `globalThis.crypto` as a non-configurable getter, so
    // we shim `getRandomValues` to a thrower instead of nulling the whole
    // object. Same code path: keystore checks for a usable
    // `crypto.getRandomValues` and refuses to proceed without one.
    const cryptoObj = (globalThis as { crypto?: Crypto }).crypto as Crypto;
    const original = cryptoObj.getRandomValues;
    Object.defineProperty(cryptoObj, "getRandomValues", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    try {
      const { getOrCreateDbKey } = await import("../keystore");
      await expect(getOrCreateDbKey()).rejects.toThrow(/CSPRNG/);
    } finally {
      Object.defineProperty(cryptoObj, "getRandomValues", {
        value: original,
        configurable: true,
        writable: true,
      });
    }
  });

  it("getOrCreateDbKey's public signature accepts zero arguments (no derivation API)", async () => {
    const { getOrCreateDbKey } = await import("../keystore");
    // Function.length reports declared parameters before defaults/rest.
    expect(getOrCreateDbKey.length).toBe(0);
  });

  it("the keystore module's source does not import any auth/network surface", async () => {
    // Static-source check: read the file off disk and assert the negative
    // dependency set. Cheaper and more reliable than reflective module-graph
    // introspection.
    //
    // Strip comments before matching so the docstring (which legitimately
    // names the forbidden surfaces in order to say "we don't use them") can
    // coexist with the code-level negative assertions.
    const path = resolve(__dirname, "../keystore.ts");
    const raw = readFileSync(path, "utf8");
    const src = raw
      .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
      .replace(/^\s*\/\/.*$/gm, "");    // line comments

    // Allowed imports.
    expect(src).toMatch(/from "expo-secure-store"/);

    // Forbidden imports / surfaces.
    expect(src).not.toMatch(/from "@\/auth/);
    expect(src).not.toMatch(/from "@\/contracts\/ApiClient/);
    expect(src).not.toMatch(/from "node:net"/);
    expect(src).not.toMatch(/from "node:http"/);
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/XMLHttpRequest/);
    // No derivation from server-issued tokens (code-level — comments stripped above).
    expect(src).not.toMatch(/\bjwt\b/i);
    expect(src).not.toMatch(/cognito/i);
    expect(src).not.toMatch(/refresh.?token/i);
    expect(src).not.toMatch(/access.?token/i);
  });
});

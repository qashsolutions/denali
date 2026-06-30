/**
 * ApiClientImpl — unit tests.
 *
 * Covers:
 *   - `createApiClient()` returns an object that statically satisfies
 *     the `ApiClient` contract AND every method is runtime-callable
 *     (loop through method names with `typeof === "function"`).
 *   - `getCurrentUser()` returns null on fresh client, becomes
 *     `{userId, email}` after `verifyOtp`, returns null after `signOut`.
 *   - `isAuthenticated()` reflects in-memory user-presence state.
 *   - `onSignInRequired(handler)` returns an unsubscribe function.
 *     Subscribe → fire → handler called. Unsubscribe → fire → handler
 *     NOT called.
 *   - Factory wiring smoke: `apiGet` ends up calling the central
 *     `httpClient.requestJson` layer (which is the one place where
 *     `X-Client-Type: mobile` is stamped — covered exhaustively by
 *     httpClient.test.ts).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ApiClient, VerifyOtpResult } from "@/contracts";

vi.mock("@/config/env", () => ({
  API_BASE_URL: "https://test.denali.health",
}));

vi.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  setItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

// Track verify/signout calls and the spy on requestJson — that's the
// central path where every REST method funnels through. If a refactor
// bypasses it, the factory-wiring test below will fail.
const requestJsonSpy = vi.fn<(req: unknown, hooks: unknown) => Promise<unknown>>();
const verifyOtpSpy = vi.fn<
  (email: string, otp: string, hooks: unknown) => Promise<VerifyOtpResult>
>();
const sendOtpSpy = vi.fn<(email: string, hooks: unknown) => Promise<void>>();
const signOutSpy = vi.fn<(hooks: unknown) => Promise<void>>();
const refreshSpy = vi.fn<(hooks: unknown) => Promise<void>>();

vi.mock("../httpClient", async () => ({
  rawRequest: vi.fn(),
  requestJson: (req: unknown, hooks: unknown) => requestJsonSpy(req, hooks),
  HttpError: class HttpError extends Error {
    constructor(
      public readonly status: number,
      public readonly body: unknown,
    ) {
      super(`HTTP ${status}`);
    }
  },
  SessionExpiredError: class SessionExpiredError extends Error {
    constructor() {
      super("Session expired");
    }
  },
  CHAT_TIMEOUT_MS: 330_000,
}));

vi.mock("../otpClient", () => ({
  sendOtp: (email: string, hooks: unknown) => sendOtpSpy(email, hooks),
  verifyOtp: (email: string, otp: string, hooks: unknown) =>
    verifyOtpSpy(email, otp, hooks),
  refresh: (hooks: unknown) => refreshSpy(hooks),
  signOut: (hooks: unknown) => signOutSpy(hooks),
}));

vi.mock("../chatStream", () => ({
  chatStream: vi.fn(),
  CHAT_TIMEOUT_MS: 330_000,
}));

// tokenStore — we only need `getAccessToken` for the `hasStoredAccessToken`
// extension and to keep the import resolvable.
const accessTokenRef = { current: null as string | null };
const sessionIssuedAtRef = { current: null as string | null };
vi.mock("../tokenStore", () => ({
  getAccessToken: vi.fn(async () => accessTokenRef.current),
  getRefreshToken: vi.fn(async () => null),
  getSessionIssuedAt: vi.fn(async () => sessionIssuedAtRef.current),
  setTokens: vi.fn(async () => undefined),
  clearTokens: vi.fn(async () => undefined),
}));

import { createApiClient } from "../ApiClientImpl";
import { clearTokens } from "../tokenStore";

beforeEach(() => {
  requestJsonSpy.mockReset();
  verifyOtpSpy.mockReset();
  sendOtpSpy.mockReset();
  signOutSpy.mockReset();
  refreshSpy.mockReset();
  accessTokenRef.current = null;
  sessionIssuedAtRef.current = null;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("createApiClient — ApiClient conformance", () => {
  it("returns an object that satisfies the ApiClient interface", () => {
    const client = createApiClient();

    // Static conformance — TypeScript will error at compile time if any
    // ApiClient method is missing.
    const conforms: ApiClient = client;
    expect(conforms).toBe(client);

    // Runtime conformance — every method on the interface must be a
    // function on the returned object. Listed verbatim from
    // mobile/src/contracts/ApiClient.ts.
    const methods: ReadonlyArray<keyof ApiClient> = [
      "sendOtp",
      "verifyOtp",
      "refresh",
      "signOut",
      "isAuthenticated",
      "getCurrentUser",
      "restoreSession",
      "onSignInRequired",
      "apiGet",
      "apiPost",
      "apiPatch",
      "apiDelete",
      "chat",
    ];
    for (const m of methods) {
      expect(typeof client[m]).toBe("function");
    }
  });

  it("honors initialUser constructor option", () => {
    const client = createApiClient({
      initialUser: { userId: "u-1", email: "ada@example.com" },
    });
    expect(client.isAuthenticated()).toBe(true);
    expect(client.getCurrentUser()).toEqual({
      userId: "u-1",
      email: "ada@example.com",
    });
  });
});

describe("ApiClientImpl — restoreSession (cold-launch, 30-day cap)", () => {
  const user = { userId: "u-1", email: "ada@example.com" };

  it("returns false + stays unauthenticated when no token is stored", async () => {
    const client = createApiClient();
    accessTokenRef.current = null;
    expect(await client.restoreSession(user)).toBe(false);
    expect(client.isAuthenticated()).toBe(false);
  });

  it("restores + hydrates currentUser for a token within the cap", async () => {
    const client = createApiClient();
    accessTokenRef.current = "stored.jwt.token";
    sessionIssuedAtRef.current = String(Date.now()); // issued just now
    expect(await client.restoreSession(user)).toBe(true);
    expect(client.isAuthenticated()).toBe(true);
    expect(client.getCurrentUser()).toEqual(user);
  });

  it("refuses + clears a stored token that has no session_issued_at", async () => {
    const client = createApiClient();
    accessTokenRef.current = "stored.jwt.token";
    sessionIssuedAtRef.current = null; // present token, no cap anchor → untrusted
    expect(await client.restoreSession(user)).toBe(false);
    expect(client.isAuthenticated()).toBe(false);
    expect(clearTokens).toHaveBeenCalled();
  });

  it("refuses + clears tokens once the 30-day cap has elapsed", async () => {
    const client = createApiClient();
    accessTokenRef.current = "stored.jwt.token";
    sessionIssuedAtRef.current = String(Date.now() - 31 * 24 * 60 * 60 * 1000);
    expect(await client.restoreSession(user)).toBe(false);
    expect(client.isAuthenticated()).toBe(false);
    expect(clearTokens).toHaveBeenCalled();
  });
});

describe("ApiClientImpl — auth lifecycle", () => {
  it("getCurrentUser: null → set by verifyOtp → null after signOut", async () => {
    const client = createApiClient();
    expect(client.getCurrentUser()).toBeNull();
    expect(client.isAuthenticated()).toBe(false);

    verifyOtpSpy.mockResolvedValueOnce({
      userId: "u-1",
      email: "ada@example.com",
      mfaRequired: false,
    });

    const result = await client.verifyOtp("ada@example.com", "123456");
    expect(result).toEqual({
      userId: "u-1",
      email: "ada@example.com",
      mfaRequired: false,
    });
    expect(client.getCurrentUser()).toEqual({
      userId: "u-1",
      email: "ada@example.com",
    });
    expect(client.isAuthenticated()).toBe(true);

    signOutSpy.mockResolvedValueOnce(undefined);
    await client.signOut();
    expect(client.getCurrentUser()).toBeNull();
    expect(client.isAuthenticated()).toBe(false);
  });
});

describe("ApiClientImpl — onSignInRequired subscription", () => {
  it("subscribe → trigger → handler fires; unsubscribe → trigger → handler does NOT fire", async () => {
    const client = createApiClient({
      initialUser: { userId: "u-1", email: "ada@example.com" },
    });

    let count = 0;
    const unsubscribe = client.onSignInRequired(() => {
      count += 1;
    });
    expect(typeof unsubscribe).toBe("function");

    // Trigger #1 — by having a mocked requestJson throw / drive the
    // internal hooks.onSignInRequired path. We don't have direct access
    // to the hooks here, so instead we trigger via the documented
    // behavior: a refresh failure clears tokens and fires the hook.
    // The otpClient is mocked too, so we manually trigger by re-calling
    // verifyOtp with a failure that the mock implements by invoking the
    // hooks argument.

    verifyOtpSpy.mockImplementationOnce(async (_email, _otp, hooks: unknown) => {
      (hooks as { onSignInRequired: () => void }).onSignInRequired();
      throw new Error("simulated 401");
    });
    await expect(client.verifyOtp("x@y", "000")).rejects.toThrow(
      "simulated 401",
    );
    expect(count).toBe(1);

    // Unsubscribe and trigger again — count must NOT advance.
    unsubscribe();
    verifyOtpSpy.mockImplementationOnce(async (_email, _otp, hooks: unknown) => {
      (hooks as { onSignInRequired: () => void }).onSignInRequired();
      throw new Error("simulated 401 again");
    });
    await expect(client.verifyOtp("x@y", "000")).rejects.toThrow(
      "simulated 401 again",
    );
    expect(count).toBe(1); // unchanged
  });

  it("clears currentUser when the sign-in-required hook fires", async () => {
    const client = createApiClient({
      initialUser: { userId: "u-1", email: "ada@example.com" },
    });
    expect(client.getCurrentUser()).not.toBeNull();

    // Force the hook to fire via the verifyOtp mock.
    verifyOtpSpy.mockImplementationOnce(async (_e, _o, hooks: unknown) => {
      (hooks as { onSignInRequired: () => void }).onSignInRequired();
      throw new Error("forced");
    });
    await expect(client.verifyOtp("x", "0")).rejects.toThrow();

    expect(client.getCurrentUser()).toBeNull();
  });
});

describe("ApiClientImpl — REST factory wiring", () => {
  // Smoke test that the factory wires apiGet/apiPost/apiPatch/apiDelete
  // through the central `requestJson` layer where `X-Client-Type: mobile`
  // is stamped (covered exhaustively in httpClient.test.ts). If a refactor
  // shortcuts past requestJson, this test fails.

  it("apiGet routes through requestJson with the right method/path", async () => {
    requestJsonSpy.mockResolvedValueOnce({ ok: true });
    const client = createApiClient();
    const result = await client.apiGet<{ ok: boolean }>("/api/profile");

    expect(result).toEqual({ ok: true });
    expect(requestJsonSpy).toHaveBeenCalledTimes(1);
    const req = requestJsonSpy.mock.calls[0][0] as {
      method: string;
      path: string;
      body?: string;
    };
    expect(req.method).toBe("GET");
    expect(req.path).toBe("/api/profile");
    expect(req.body).toBeUndefined();
  });

  it("apiPost serializes body via JSON.stringify and forwards", async () => {
    requestJsonSpy.mockResolvedValueOnce({ ok: true });
    const client = createApiClient();
    await client.apiPost("/api/x", { k: "v" });

    const req = requestJsonSpy.mock.calls[0][0] as {
      method: string;
      path: string;
      body?: string;
    };
    expect(req.method).toBe("POST");
    expect(req.body).toBe(JSON.stringify({ k: "v" }));
  });

  it("apiPatch routes through requestJson with PATCH", async () => {
    requestJsonSpy.mockResolvedValueOnce({ ok: true });
    const client = createApiClient();
    await client.apiPatch("/api/x", { k: "v" });

    const req = requestJsonSpy.mock.calls[0][0] as { method: string };
    expect(req.method).toBe("PATCH");
  });

  it("apiDelete routes through requestJson with DELETE and no body", async () => {
    requestJsonSpy.mockResolvedValueOnce({ ok: true });
    const client = createApiClient();
    await client.apiDelete("/api/x");

    const req = requestJsonSpy.mock.calls[0][0] as {
      method: string;
      body?: string;
    };
    expect(req.method).toBe("DELETE");
    expect(req.body).toBeUndefined();
  });

  it("propagates ApiRequestOptions through to requestJson (timeoutMs override)", async () => {
    requestJsonSpy.mockResolvedValueOnce({ ok: true });
    const client = createApiClient();
    await client.apiGet("/api/x", { timeoutMs: 5_000 });

    const req = requestJsonSpy.mock.calls[0][0] as {
      options?: { timeoutMs?: number };
    };
    expect(req.options?.timeoutMs).toBe(5_000);
  });
});

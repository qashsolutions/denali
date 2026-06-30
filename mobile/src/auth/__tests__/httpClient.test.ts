/**
 * httpClient — unit tests.
 *
 * Covers the load-bearing behavior described in
 * `mobile/src/auth/httpClient.ts`:
 *   - 401 → silent refresh → retry (success path).
 *   - 401 → refresh fails → tokens cleared + onSignInRequired fires +
 *     the original request's Promise still rejects via HttpError(401)
 *     so the caller has *something* to surface.
 *   - Single-flight refresh: two concurrent 401s share one /api/auth/refresh
 *     call; both retries use the new access token.
 *   - X-Client-Type: mobile header set on every method (apiGet / apiPost /
 *     apiPatch / apiDelete). A refactor that drops the header must fail
 *     this suite — it's the load-bearing signal that the backend's mobile
 *     branch (body-tokens, no Set-Cookie) is engaged.
 *   - 30-day session cap: when `isSessionExpired` returns true, the request
 *     short-circuits before `fetch` is called. Tokens cleared,
 *     onSignInRequired fires, SessionExpiredError thrown.
 *   - Timeouts: /api/chat uses CHAT_TIMEOUT_MS (330s); other paths use 30s;
 *     caller-provided `timeoutMs` wins.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Module-boundary mocks ──
// We mock at the module boundary rather than at expo-secure-store so the
// test stays focused on httpClient's behavior. The lower layers
// (tokenStore, sessionPolicy) have their own dedicated test files.
// We also mock `@/config/env` and `expo-secure-store` because Vite's SSR
// transformer evaluates those module trees up-front (expo-constants /
// expo-secure-store native modules can't parse under node).

vi.mock("@/config/env", () => ({
  API_BASE_URL: "https://test.denali.health",
}));

vi.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  setItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

const mockTokens = {
  access: null as string | null,
  refresh: null as string | null,
  sessionIssuedAt: null as string | null,
};

vi.mock("../tokenStore", () => ({
  getAccessToken: vi.fn(async () => mockTokens.access),
  getRefreshToken: vi.fn(async () => mockTokens.refresh),
  getSessionIssuedAt: vi.fn(async () => mockTokens.sessionIssuedAt),
  setTokens: vi.fn(async (b: { access: string; refresh?: string }) => {
    mockTokens.access = b.access;
    if (b.refresh !== undefined) mockTokens.refresh = b.refresh;
  }),
  clearTokens: vi.fn(async () => {
    mockTokens.access = null;
    mockTokens.refresh = null;
    mockTokens.sessionIssuedAt = null;
  }),
}));

// Default to "session is fresh." Individual tests override.
const isSessionExpiredMock = vi.fn((_v: string | null) => false);
vi.mock("../sessionPolicy", () => ({
  isSessionExpired: (v: string | null) => isSessionExpiredMock(v),
  SESSION_MAX_MS: 30 * 24 * 60 * 60 * 1000,
}));

import * as tokenStoreMod from "../tokenStore";
import {
  HttpError,
  SessionExpiredError,
  rawRequest,
  requestJson,
  CHAT_TIMEOUT_MS,
} from "../httpClient";

// ── Test helpers ──

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function unauthorized(): Response {
  return jsonResponse(401, { error: "unauthorized" });
}

let fetchSpy: ReturnType<typeof vi.fn>;
let signInRequiredFired: number;
const hooks = {
  onSignInRequired: () => {
    signInRequiredFired += 1;
  },
};

beforeEach(() => {
  mockTokens.access = "initial-access";
  mockTokens.refresh = "initial-refresh";
  mockTokens.sessionIssuedAt = String(Date.now());
  isSessionExpiredMock.mockReset();
  isSessionExpiredMock.mockReturnValue(false);
  signInRequiredFired = 0;
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("httpClient — silent refresh on 401", () => {
  it("401 → refresh succeeds → retry returns the second response", async () => {
    // 1st call: original GET → 401.
    // 2nd call: POST /api/auth/refresh → 200 with new access_token.
    // 3rd call: retry of the original GET → 200 with the new token in Authorization.
    fetchSpy
      .mockResolvedValueOnce(unauthorized())
      .mockResolvedValueOnce(
        jsonResponse(200, { access_token: "fresh-access", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    const result = await requestJson<{ ok: boolean }>(
      { method: "GET", path: "/api/profile" },
      hooks,
    );

    expect(result).toEqual({ ok: true });
    expect(fetchSpy).toHaveBeenCalledTimes(3);

    // Retry call carries the refreshed access token.
    const [, retryInit] = fetchSpy.mock.calls[2] as [string, RequestInit];
    expect(
      (retryInit.headers as Record<string, string>).Authorization,
    ).toBe("Bearer fresh-access");
    expect(signInRequiredFired).toBe(0);
  });

  it("401 → refresh fails → tokens cleared + onSignInRequired fires + original rejects", async () => {
    fetchSpy
      .mockResolvedValueOnce(unauthorized())
      // Refresh call returns 401 (revoked refresh token).
      .mockResolvedValueOnce(unauthorized());

    await expect(
      requestJson({ method: "GET", path: "/api/profile" }, hooks),
    ).rejects.toBeInstanceOf(HttpError);

    expect(tokenStoreMod.clearTokens).toHaveBeenCalled();
    expect(signInRequiredFired).toBe(1);
    // fetchSpy was called twice: original + refresh. No retry happened.
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("single-flight refresh: two concurrent 401s trigger ONE /api/auth/refresh", async () => {
    // Order of fetchSpy calls under concurrency:
    //   1) request A → 401
    //   2) request B → 401
    //   3) /api/auth/refresh (single-flight) → 200
    //   4) request A retry → 200
    //   5) request B retry → 200
    // The exact A/B interleave depends on the microtask schedule; the
    // load-bearing assertion is: refresh fired once, both retries succeeded.
    let refreshCalls = 0;
    fetchSpy.mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.endsWith("/api/auth/refresh")) {
        refreshCalls += 1;
        // Slow-roll the refresh so both 401s stack on the same promise.
        await new Promise((r) => setTimeout(r, 5));
        return jsonResponse(200, {
          access_token: "single-flight-access",
          expires_in: 3600,
        });
      }
      const auth =
        (init?.headers as Record<string, string>)?.Authorization ?? "";
      if (auth === "Bearer single-flight-access") {
        return jsonResponse(200, { ok: true });
      }
      return unauthorized();
    });

    const [a, b] = await Promise.all([
      requestJson<{ ok: boolean }>({ method: "GET", path: "/api/a" }, hooks),
      requestJson<{ ok: boolean }>({ method: "GET", path: "/api/b" }, hooks),
    ]);

    expect(a).toEqual({ ok: true });
    expect(b).toEqual({ ok: true });
    expect(refreshCalls).toBe(1);
    expect(signInRequiredFired).toBe(0);
  });
});

describe("httpClient — X-Client-Type header on every method", () => {
  // The mobile branch on the backend (verify-otp / refresh) keys off this
  // exact header. Dropping it silently sends mobile back into the cookie
  // path and breaks the body-token contract. This suite is the canary.

  it.each([
    ["GET", "/api/profile"],
    ["POST", "/api/profile"],
    ["PATCH", "/api/profile"],
    ["DELETE", "/api/profile"],
  ] as const)("%s sets X-Client-Type: mobile", async (method, path) => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, { ok: true }));

    if (method === "GET" || method === "DELETE") {
      await requestJson({ method, path }, hooks);
    } else {
      await requestJson(
        { method, path, body: JSON.stringify({ k: "v" }) },
        hooks,
      );
    }

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["X-Client-Type"]).toBe("mobile");
  });

  it("attaches Authorization: Bearer when a token is in store", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    await requestJson({ method: "GET", path: "/api/profile" }, hooks);

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer initial-access",
    );
  });

  it("omits Authorization when no token is in store (send-otp path)", async () => {
    mockTokens.access = null;
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    await requestJson(
      { method: "POST", path: "/api/auth/send-otp", body: "{}" },
      hooks,
    );

    const [, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(
      (init.headers as Record<string, string>).Authorization,
    ).toBeUndefined();
    expect((init.headers as Record<string, string>)["X-Client-Type"]).toBe(
      "mobile",
    );
  });
});

describe("httpClient — 30-day session cap", () => {
  it("short-circuits before fetch when isSessionExpired returns true", async () => {
    isSessionExpiredMock.mockReturnValue(true);
    mockTokens.sessionIssuedAt = String(
      Date.now() - 10 * 24 * 60 * 60 * 1000,
    );

    await expect(
      rawRequest({ method: "GET", path: "/api/profile" }, hooks),
    ).rejects.toBeInstanceOf(SessionExpiredError);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(tokenStoreMod.clearTokens).toHaveBeenCalled();
    expect(signInRequiredFired).toBe(1);
  });
});

describe("httpClient — per-request timeout", () => {
  // We assert via the value passed to setTimeout. We don't actually wait
  // 30s/330s — we intercept setTimeout and verify the delay value the
  // request layer chose.

  function captureTimeoutsDuring(
    work: () => Promise<unknown>,
  ): Promise<number[]> {
    const captured: number[] = [];
    const origSetTimeout = globalThis.setTimeout;
    const origClearTimeout = globalThis.clearTimeout;
    // Forward zero-delay setTimeout (used by the single-flight test's
    // microtask scheduler) but capture the actual numeric delay.
    globalThis.setTimeout = ((fn: () => void, ms?: number) => {
      captured.push(ms ?? 0);
      return origSetTimeout(fn, 0);
    }) as typeof setTimeout;
    globalThis.clearTimeout = ((handle: ReturnType<typeof setTimeout>) => {
      origClearTimeout(handle);
    }) as typeof clearTimeout;

    return work()
      .then(() => captured)
      .finally(() => {
        globalThis.setTimeout = origSetTimeout;
        globalThis.clearTimeout = origClearTimeout;
      });
  }

  it("/api/chat uses CHAT_TIMEOUT_MS (330s)", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const captured = await captureTimeoutsDuring(() =>
      requestJson({ method: "POST", path: "/api/chat", body: "{}" }, hooks),
    );
    expect(captured).toContain(CHAT_TIMEOUT_MS);
    expect(CHAT_TIMEOUT_MS).toBe(330_000);
  });

  it("non-chat paths use the 30s default", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const captured = await captureTimeoutsDuring(() =>
      requestJson({ method: "GET", path: "/api/profile" }, hooks),
    );
    expect(captured).toContain(30_000);
    expect(captured).not.toContain(CHAT_TIMEOUT_MS);
  });

  it("honors caller-provided ApiRequestOptions.timeoutMs override", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, { ok: true }));
    const captured = await captureTimeoutsDuring(() =>
      requestJson(
        {
          method: "GET",
          path: "/api/profile",
          options: { timeoutMs: 5_000 },
        },
        hooks,
      ),
    );
    expect(captured).toContain(5_000);
  });
});

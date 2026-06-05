/**
 * otpClient — unit tests.
 *
 * Covers:
 *   - `sendOtp` sends `X-Client-Type: mobile`.
 *   - `verifyOtp` happy path persists tokens via `setTokens`, returns
 *     `VerifyOtpResult`, and sets the header.
 *   - `verifyOtp` server response missing `access_token` (or
 *     `refresh_token`) → throws AND tokens are NOT persisted (zero
 *     `setTokens` calls).
 *   - `refresh` sends `{ refresh_token }` in body + `X-Client-Type: mobile`
 *     header, persists the new access token from the response body.
 *   - `signOut` clears tokens even when the server signout call fails.
 *
 * Mocks `expo-secure-store` and `@/config/env` so the auth/httpClient
 * tree resolves cleanly under node.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
  setTokens: vi.fn(async (b: {
    access: string;
    refresh?: string;
    sessionIssuedAt?: number;
  }) => {
    mockTokens.access = b.access;
    if (b.refresh !== undefined) mockTokens.refresh = b.refresh;
    if (b.sessionIssuedAt !== undefined) {
      mockTokens.sessionIssuedAt = String(b.sessionIssuedAt);
    }
  }),
  clearTokens: vi.fn(async () => {
    mockTokens.access = null;
    mockTokens.refresh = null;
    mockTokens.sessionIssuedAt = null;
  }),
}));

vi.mock("../sessionPolicy", () => ({
  isSessionExpired: vi.fn(() => false),
  SESSION_MAX_MS: 7 * 24 * 60 * 60 * 1000,
}));

import * as tokenStoreMod from "../tokenStore";
import { HttpError } from "../httpClient";
import { refresh, sendOtp, signOut, verifyOtp } from "../otpClient";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

let fetchSpy: ReturnType<typeof vi.fn>;
let signInRequiredFired: number;
const hooks = {
  onSignInRequired: () => {
    signInRequiredFired += 1;
  },
};

beforeEach(() => {
  mockTokens.access = null;
  mockTokens.refresh = null;
  mockTokens.sessionIssuedAt = null;
  signInRequiredFired = 0;
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("otpClient — sendOtp", () => {
  it("sends X-Client-Type: mobile and POSTs the email", async () => {
    fetchSpy.mockResolvedValueOnce(jsonResponse(200, { success: true }));

    await sendOtp("ada@example.com", hooks);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url.endsWith("/api/auth/send-otp")).toBe(true);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-Client-Type"]).toBe(
      "mobile",
    );
    expect(init.body).toBe(JSON.stringify({ email: "ada@example.com" }));
  });

  it("throws HttpError on non-2xx", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(400, { error: "invalid email" }),
    );
    await expect(sendOtp("bad", hooks)).rejects.toBeInstanceOf(HttpError);
  });
});

describe("otpClient — verifyOtp", () => {
  it("happy path persists tokens, returns VerifyOtpResult, sets X-Client-Type header", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        mfaRequired: false,
        user: { userId: "user-123", email: "ada@example.com" },
        access_token: "verified-access",
        refresh_token: "verified-refresh",
        expires_in: 3600,
      }),
    );

    const result = await verifyOtp("ada@example.com", "123456", hooks);

    expect(result).toEqual({
      userId: "user-123",
      email: "ada@example.com",
      mfaRequired: false,
    });

    // Verify the request shape.
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url.endsWith("/api/auth/verify-otp")).toBe(true);
    expect((init.headers as Record<string, string>)["X-Client-Type"]).toBe(
      "mobile",
    );

    // Tokens persisted via the mock.
    expect(tokenStoreMod.setTokens).toHaveBeenCalledTimes(1);
    const stored = (
      tokenStoreMod.setTokens as ReturnType<typeof vi.fn>
    ).mock.calls[0][0] as { access: string; refresh: string; sessionIssuedAt: number };
    expect(stored.access).toBe("verified-access");
    expect(stored.refresh).toBe("verified-refresh");
    expect(typeof stored.sessionIssuedAt).toBe("number");
  });

  it("server response missing access_token → throws + tokens NOT persisted", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        mfaRequired: false,
        user: { userId: "user-123", email: "ada@example.com" },
        // access_token intentionally absent — simulates a regression in
        // the backend's mobile branch.
        refresh_token: "verified-refresh",
        expires_in: 3600,
      }),
    );

    await expect(
      verifyOtp("ada@example.com", "123456", hooks),
    ).rejects.toBeInstanceOf(HttpError);

    expect(tokenStoreMod.setTokens).not.toHaveBeenCalled();
  });

  it("server response missing refresh_token → throws + tokens NOT persisted", async () => {
    fetchSpy.mockResolvedValueOnce(
      jsonResponse(200, {
        success: true,
        mfaRequired: false,
        user: { userId: "user-123", email: "ada@example.com" },
        access_token: "verified-access",
        // refresh_token missing — same contract break.
        expires_in: 3600,
      }),
    );

    await expect(
      verifyOtp("ada@example.com", "123456", hooks),
    ).rejects.toBeInstanceOf(HttpError);

    expect(tokenStoreMod.setTokens).not.toHaveBeenCalled();
  });
});

describe("otpClient — refresh", () => {
  it("sends body { refresh_token } + X-Client-Type header; persists new access token", async () => {
    mockTokens.refresh = "stored-refresh";
    mockTokens.sessionIssuedAt = String(Date.now());

    fetchSpy.mockResolvedValueOnce(
      jsonResponse(200, {
        access_token: "rotated-access",
        expires_in: 3600,
      }),
    );

    await refresh(hooks);

    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url.endsWith("/api/auth/refresh")).toBe(true);
    expect(init.method).toBe("POST");
    expect((init.headers as Record<string, string>)["X-Client-Type"]).toBe(
      "mobile",
    );
    expect(init.body).toBe(JSON.stringify({ refresh_token: "stored-refresh" }));

    // The new access token was persisted; refresh + sessionIssuedAt
    // remained on disk (the refresh-flow `setTokens({access})` overload).
    expect(tokenStoreMod.setTokens).toHaveBeenCalledTimes(1);
    const stored = (
      tokenStoreMod.setTokens as ReturnType<typeof vi.fn>
    ).mock.calls[0][0] as { access: string; refresh?: string };
    expect(stored.access).toBe("rotated-access");
    expect(stored.refresh).toBeUndefined();
  });

  it("missing local refresh_token → throws without calling fetch", async () => {
    mockTokens.refresh = null;
    await expect(refresh(hooks)).rejects.toBeInstanceOf(HttpError);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("otpClient — signOut", () => {
  it("clears tokens even when the server signout call returns 500", async () => {
    mockTokens.access = "to-clear";
    mockTokens.refresh = "to-clear";
    mockTokens.sessionIssuedAt = String(Date.now());

    fetchSpy.mockResolvedValueOnce(jsonResponse(500, { error: "boom" }));

    await signOut(hooks);

    expect(tokenStoreMod.clearTokens).toHaveBeenCalled();
  });

  it("clears tokens even when the server signout call REJECTS (network error)", async () => {
    mockTokens.access = "to-clear";
    mockTokens.refresh = "to-clear";
    mockTokens.sessionIssuedAt = String(Date.now());

    fetchSpy.mockRejectedValueOnce(new TypeError("network down"));

    await signOut(hooks);

    expect(tokenStoreMod.clearTokens).toHaveBeenCalled();
  });
});

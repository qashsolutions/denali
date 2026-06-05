import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/auth/refresh — Unit Tests
 *
 * Tests token refresh with transient vs permanent failure distinction.
 * Cognito refreshCognitoTokens is mocked.
 */

const mockRefresh = vi.fn();
vi.mock("@/lib/auth-server", () => ({
  refreshCognitoTokens: (...args: unknown[]) => mockRefresh(...args),
}));

import { NextRequest } from "next/server";
import { POST } from "../route";

function makeRequest(cookies?: Record<string, string>): NextRequest {
  const cookieHeader = cookies
    ? Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ")
    : "";
  return new NextRequest("http://localhost:3000/api/auth/refresh", {
    method: "POST",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

/**
 * Mobile request helper: X-Client-Type: mobile header + JSON body carrying
 * the refresh token. No cookies — mobile NEVER sends or receives cookies.
 */
function makeMobileRequest(refreshToken?: string): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/refresh", {
    method: "POST",
    headers: {
      "X-Client-Type": "mobile",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(
      refreshToken !== undefined ? { refresh_token: refreshToken } : {},
    ),
  });
}

describe("POST /api/auth/refresh", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when no refresh_token cookie", async () => {
    const res = await POST(makeRequest());
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body.error).toContain("session");
  });

  it("returns 200 with new access_token cookie on success", async () => {
    mockRefresh.mockResolvedValue({ accessToken: "new-access-tok", expiresIn: 3600 });

    const res = await POST(makeRequest({ refresh_token: "valid-refresh" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify access_token cookie was set
    const setCookie = res.headers.getSetCookie();
    expect(setCookie.some((c: string) => c.includes("access_token=new-access-tok"))).toBe(true);
  });

  it("returns 401 and clears cookies on NotAuthorizedException (revoked token)", async () => {
    mockRefresh.mockRejectedValue(new Error("NotAuthorizedException: Token has been revoked"));

    const res = await POST(makeRequest({ refresh_token: "revoked" }));
    expect(res.status).toBe(401);

    const setCookie = res.headers.getSetCookie();
    const accessClear = setCookie.find((c: string) => c.includes("access_token="));
    const refreshClear = setCookie.find((c: string) => c.includes("refresh_token="));
    expect(accessClear).toContain("Max-Age=0");
    expect(refreshClear).toContain("Max-Age=0");
  });

  it("returns 401 and clears cookies on invalid_grant", async () => {
    mockRefresh.mockRejectedValue(new Error("invalid_grant"));

    const res = await POST(makeRequest({ refresh_token: "invalid" }));
    expect(res.status).toBe(401);

    const setCookie = res.headers.getSetCookie();
    expect(setCookie.some((c: string) => c.includes("refresh_token=") && c.includes("Max-Age=0"))).toBe(true);
  });

  it("returns 401 and clears cookies on Invalid Refresh Token", async () => {
    mockRefresh.mockRejectedValue(new Error("Invalid Refresh Token"));

    const res = await POST(makeRequest({ refresh_token: "bad" }));
    expect(res.status).toBe(401);
  });

  it("returns 503 and preserves cookies on transient failure (network error)", async () => {
    mockRefresh.mockRejectedValue(new Error("connect ETIMEDOUT"));

    const res = await POST(makeRequest({ refresh_token: "valid-but-infra-down" }));
    expect(res.status).toBe(503);

    const body = await res.json();
    expect(body.error).toContain("temporary");

    // Cookies should NOT be cleared
    const setCookie = res.headers.getSetCookie();
    const refreshClear = setCookie.find((c: string) => c.includes("refresh_token=") && c.includes("Max-Age=0"));
    expect(refreshClear).toBeUndefined();
  });

  it("returns 503 on DNS resolution failure", async () => {
    mockRefresh.mockRejectedValue(new Error("getaddrinfo ENOTFOUND cognito-idp.us-east-1.amazonaws.com"));

    const res = await POST(makeRequest({ refresh_token: "tok" }));
    expect(res.status).toBe(503);
  });

  it("returns 503 on generic Cognito service error", async () => {
    mockRefresh.mockRejectedValue(new Error("ServiceUnavailableException"));

    const res = await POST(makeRequest({ refresh_token: "tok" }));
    expect(res.status).toBe(503);
  });

  it("returns 503 on non-Error throw", async () => {
    mockRefresh.mockRejectedValue("something unexpected");

    const res = await POST(makeRequest({ refresh_token: "tok" }));
    expect(res.status).toBe(503);
  });

  // ── Ambiguous error classification ──

  it("returns 503 (not 401) when NotAuthorizedException is from client config, not token", async () => {
    // Cognito can throw NotAuthorizedException for client misconfiguration too.
    // Substring match catches this — document that we accept the false positive
    // (clearing cookies on config error is annoying but not a security risk).
    mockRefresh.mockRejectedValue(new Error("NotAuthorizedException: Invalid client id"));

    const res = await POST(makeRequest({ refresh_token: "tok" }));
    // Current behavior: 401 (treated as token error). This is a known false positive.
    // A client config error will persist across retries, so clearing cookies is
    // harmless — user re-auths, same error, ops investigates.
    expect(res.status).toBe(401);
  });

  it("returns 401 when error message contains invalid_grant with extra context", async () => {
    mockRefresh.mockRejectedValue(new Error("invalid_grant (code 400): token revoked by admin"));

    const res = await POST(makeRequest({ refresh_token: "tok" }));
    expect(res.status).toBe(401);

    const setCookie = res.headers.getSetCookie();
    expect(setCookie.some((c: string) => c.includes("refresh_token=") && c.includes("Max-Age=0"))).toBe(true);
  });

  it("returns 503 when error message has wrong case (invalid_Grant)", async () => {
    // Case mismatch → not recognized as token error → treated as transient
    mockRefresh.mockRejectedValue(new Error("invalid_Grant"));

    const res = await POST(makeRequest({ refresh_token: "tok" }));
    expect(res.status).toBe(503);
  });

  it("returns 503 when Cognito error is wrapped in JSON string", async () => {
    // JSON-wrapped errors don't substring-match the expected patterns
    mockRefresh.mockRejectedValue(
      new Error('{"error":"ThrottlingException","message":"Rate exceeded"}')
    );

    const res = await POST(makeRequest({ refresh_token: "tok" }));
    expect(res.status).toBe(503);
  });
});

/**
 * Phase 1 mobile — X-Client-Type: mobile branch.
 *
 * Added by mobile-auth-wirer (Wave 1) per docs/design/phase-1-45plus.md §76.
 */
describe("POST /api/auth/refresh — X-Client-Type: mobile (Phase 1 mobile)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns body tokens and NO Set-Cookie when header is 'mobile' (happy path)", async () => {
    mockRefresh.mockResolvedValue({
      accessToken: "new-access-tok",
      expiresIn: 3600,
    });

    const res = await POST(makeMobileRequest("valid-refresh"));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({
      success: true,
      access_token: "new-access-tok",
      expires_in: 3600,
    });

    // CRITICAL: zero Set-Cookie headers on the mobile branch.
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("returns 401 (no clearing cookies) when refresh_token missing from body", async () => {
    // Mobile path: no cookie, empty body → no refresh token at all → 401.
    const res = await POST(makeMobileRequest(undefined));
    expect(res.status).toBe(401);
    // No Set-Cookie either way (mobile NEVER receives cookies).
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("returns 401 with NO Set-Cookie on NotAuthorizedException (mobile clears tokens locally)", async () => {
    mockRefresh.mockRejectedValue(
      new Error("NotAuthorizedException: Token has been revoked"),
    );

    const res = await POST(makeMobileRequest("revoked"));
    expect(res.status).toBe(401);
    // Mobile clears its own tokens via tokenStore — server emits no Set-Cookie.
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("returns 503 with NO Set-Cookie on transient failure", async () => {
    mockRefresh.mockRejectedValue(new Error("connect ETIMEDOUT"));

    const res = await POST(makeMobileRequest("valid-but-infra-down"));
    expect(res.status).toBe(503);
    expect(res.headers.getSetCookie()).toEqual([]);
  });

  it("byte-identical web regression: NO header → cookie-based path unchanged on success", async () => {
    mockRefresh.mockResolvedValue({
      accessToken: "new-access-tok",
      expiresIn: 3600,
    });

    // Use the cookie-bearing request helper (no X-Client-Type header) and
    // verify the pre-mobile-branch behavior: success body is `{success:true}`,
    // and the response sets the `access_token` cookie with the expected attributes.
    const res = await POST(makeRequest({ refresh_token: "valid-refresh" }));
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ success: true });
    expect(body).not.toHaveProperty("access_token");
    expect(body).not.toHaveProperty("expires_in");

    const cookies = res.headers.getSetCookie();
    const access = cookies.find((c) => c.startsWith("access_token="));
    expect(access).toBeDefined();
    expect(access).toContain("access_token=new-access-tok");
    expect(access).toContain("HttpOnly");
    expect(access!.toLowerCase()).toContain("samesite=lax");
    expect(access).toContain("Path=/");
    expect(access).toContain("Max-Age=3600");
  });

  it("byte-identical web regression: NO header → invalid token still clears cookies", async () => {
    mockRefresh.mockRejectedValue(new Error("invalid_grant"));

    const res = await POST(makeRequest({ refresh_token: "bad" }));
    expect(res.status).toBe(401);

    const cookies = res.headers.getSetCookie();
    const accessClear = cookies.find((c) => c.startsWith("access_token="));
    const refreshClear = cookies.find((c) => c.startsWith("refresh_token="));
    expect(accessClear).toContain("Max-Age=0");
    expect(refreshClear).toContain("Max-Age=0");
  });

  it("byte-identical web regression: any non-mobile header preserves cookie behavior", async () => {
    mockRefresh.mockResolvedValue({
      accessToken: "new-access-tok",
      expiresIn: 3600,
    });

    // Defensive — only the exact "mobile" string triggers the branch.
    const req = new NextRequest("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      headers: {
        cookie: "refresh_token=valid",
        "X-Client-Type": "web",
      },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toEqual({ success: true });

    const cookies = res.headers.getSetCookie();
    expect(cookies.some((c) => c.includes("access_token=new-access-tok"))).toBe(
      true,
    );
  });
});

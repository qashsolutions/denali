import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * middleware.ts — Unit Tests
 *
 * Tests session lifetime enforcement, silent token refresh,
 * transient failure resilience, and auth redirects.
 *
 * Uses real NextRequest/NextResponse from next/server.
 * The internal fetch() for /api/auth/refresh is mocked globally.
 */

import { NextRequest, NextResponse } from "next/server";

// Spy on global fetch before importing middleware
// Using globalThis ensures the middleware's fetch() calls are intercepted
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

// Dynamic import so the module picks up our patched fetch
const { middleware } = await import("../middleware");

function makeRequest(
  path: string,
  cookies?: Record<string, string>
): NextRequest {
  const url = `http://localhost:3000${path}`;
  const cookieHeader = cookies
    ? Object.entries(cookies)
        .map(([k, v]) => `${k}=${v}`)
        .join("; ")
    : "";
  return new NextRequest(url, {
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

function makeMockRefreshResponse(status: number, cookies?: string[]): Response {
  const headers = new Headers();
  for (const c of cookies ?? []) {
    headers.append("set-cookie", c);
  }
  return new Response(JSON.stringify({ success: status === 200 }), {
    status,
    headers,
  });
}

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // ── API routes: early passthrough ──

  it("passes through API routes without any processing", async () => {
    const res = await middleware(
      makeRequest("/api/chat", { access_token: "tok" })
    );
    expect(res.headers.get("x-middleware-next")).toBe("1"); // NextResponse.next()
  });

  it("passes through API routes even without cookies", async () => {
    const res = await middleware(makeRequest("/api/profile"));
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  // ── 7-day session lifetime ──

  it("clears cookies and redirects when session exceeds 7 days", async () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const res = await middleware(
      makeRequest("/app/chat", {
        access_token: "tok",
        refresh_token: "ref",
        session_issued_at: String(eightDaysAgo),
      })
    );

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe(
      "/app/session-expired"
    );

    const setCookies = res.headers.getSetCookie();
    expect(
      setCookies.some(
        (c: string) => c.includes("access_token=") && c.includes("Max-Age=0")
      )
    ).toBe(true);
    expect(
      setCookies.some(
        (c: string) => c.includes("refresh_token=") && c.includes("Max-Age=0")
      )
    ).toBe(true);
  });

  it("does not redirect when session is within 7 days", async () => {
    const oneDayAgo = Date.now() - 1 * 24 * 60 * 60 * 1000;
    const res = await middleware(
      makeRequest("/app/chat", {
        access_token: "tok",
        session_issued_at: String(oneDayAgo),
      })
    );

    // Should just pass through (has access_token, on /app/chat — no redirect)
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("clears cookies without redirect loop on /app/session-expired", async () => {
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const res = await middleware(
      makeRequest("/app/session-expired", {
        access_token: "tok",
        session_issued_at: String(eightDaysAgo),
      })
    );

    // Should NOT redirect — just pass through and clear cookies
    expect(res.headers.get("x-middleware-next")).toBe("1");
    const setCookies = res.headers.getSetCookie();
    expect(
      setCookies.some(
        (c: string) => c.includes("access_token=") && c.includes("Max-Age=0")
      )
    ).toBe(true);
  });

  // ── Silent token refresh ──

  it("refreshes token when access_token missing but refresh_token exists", async () => {
    mockFetch.mockResolvedValue(
      makeMockRefreshResponse(200, [
        "access_token=new-tok; HttpOnly; Path=/; Max-Age=3600",
      ])
    );

    const res = await middleware(
      makeRequest("/app/chat", { refresh_token: "valid-ref" })
    );

    expect(mockFetch).toHaveBeenCalledOnce();
    const fetchUrl = mockFetch.mock.calls[0][0];
    expect(fetchUrl.toString()).toContain("/api/auth/refresh");

    // Should forward the set-cookie header from refresh response
    const setCookies = res.headers.getSetCookie();
    expect(
      setCookies.some((c: string) => c.includes("access_token=new-tok"))
    ).toBe(true);
  });

  it("does not attempt refresh when both tokens are present", async () => {
    const res = await middleware(
      makeRequest("/app/chat", {
        access_token: "valid",
        refresh_token: "ref",
      })
    );

    expect(mockFetch).not.toHaveBeenCalled();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not attempt refresh when neither token is present", async () => {
    const res = await middleware(makeRequest("/app"));

    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ── Transient failure resilience ──

  it("returns NextResponse.next() on 503 from refresh (Cognito down)", async () => {
    mockFetch.mockResolvedValue(makeMockRefreshResponse(503));

    const res = await middleware(
      makeRequest("/app/chat", { refresh_token: "ref" })
    );

    // Should NOT redirect to landing — user stays on page
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.status).not.toBe(307);
  });

  it("returns NextResponse.next() on network error (fetch throws)", async () => {
    mockFetch.mockRejectedValue(new Error("connect ECONNREFUSED"));

    const res = await middleware(
      makeRequest("/app/chat", { refresh_token: "ref" })
    );

    // Should NOT redirect — transient failure
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("treats user as anonymous on 401 from refresh (token revoked)", async () => {
    mockFetch.mockResolvedValue(makeMockRefreshResponse(401));

    const res = await middleware(
      makeRequest("/app", { refresh_token: "revoked" })
    );

    // /app + anonymous → redirect to /
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
  });

  // ── Auth redirects ──

  it("redirects signed-in users from / to /app", async () => {
    const res = await middleware(makeRequest("/", { access_token: "tok" }));

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/app");
  });

  it("redirects anonymous users from /app to /", async () => {
    const res = await middleware(makeRequest("/app"));

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
  });

  it("does not redirect anonymous users on non-/app pages", async () => {
    const res = await middleware(makeRequest("/faq"));

    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not redirect signed-in users on /app sub-pages", async () => {
    const res = await middleware(
      makeRequest("/app/chat", { access_token: "tok" })
    );

    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not redirect signed-in users on non-/ pages", async () => {
    const res = await middleware(
      makeRequest("/faq", { access_token: "tok" })
    );

    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  // ── Malformed session_issued_at cookie ──

  it("skips session check when session_issued_at is non-numeric (NaN)", async () => {
    // parseInt("invalid") → NaN → isNaN check → skips entire block
    // User keeps access — session enforcement does NOT kick in
    const res = await middleware(
      makeRequest("/app/chat", {
        access_token: "tok",
        session_issued_at: "invalid",
      })
    );

    // Should pass through (not redirect to session-expired)
    expect(res.headers.get("x-middleware-next")).toBe("1");
    expect(res.status).not.toBe(307);
  });

  it("treats session_issued_at=0 as expired (epoch 1970)", async () => {
    const res = await middleware(
      makeRequest("/app/chat", {
        access_token: "tok",
        session_issued_at: "0",
      })
    );

    // Epoch 0 is >7 days ago → redirect to session-expired
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe(
      "/app/session-expired"
    );
  });

  it("treats negative session_issued_at as expired", async () => {
    const res = await middleware(
      makeRequest("/app/chat", {
        access_token: "tok",
        session_issued_at: "-99999999999",
      })
    );

    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe(
      "/app/session-expired"
    );
  });

  // ── Session lifetime boundary + refresh interaction ──

  it("does not refresh when session is near 7-day boundary (6.9 days) and access_token present", async () => {
    const nearExpiry = Date.now() - 6.9 * 24 * 60 * 60 * 1000;
    const res = await middleware(
      makeRequest("/app/chat", {
        access_token: "tok",
        refresh_token: "ref",
        session_issued_at: String(nearExpiry),
      })
    );

    // access_token present → no refresh attempted, session still within 7 days → pass through
    expect(mockFetch).not.toHaveBeenCalled();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("enforces 7-day limit even after successful refresh", async () => {
    // Session is 8 days old, access_token missing, refresh_token present
    // Session lifetime check runs BEFORE refresh → caught and redirected
    const eightDaysAgo = Date.now() - 8 * 24 * 60 * 60 * 1000;
    const res = await middleware(
      makeRequest("/app/chat", {
        refresh_token: "ref",
        session_issued_at: String(eightDaysAgo),
      })
    );

    // 7-day check fires first (has refresh_token → hasRefreshToken is true),
    // redirects to session-expired. Refresh never attempted.
    expect(mockFetch).not.toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe(
      "/app/session-expired"
    );
  });

  // ── Refresh returns 200 but no Set-Cookie ──

  it("treats user as anonymous when refresh returns 200 but no Set-Cookie headers", async () => {
    // Refresh endpoint returns success but doesn't actually set the cookie
    // (edge case: Cognito returns tokens but response header is malformed)
    mockFetch.mockResolvedValue(makeMockRefreshResponse(200, []));

    const res = await middleware(
      makeRequest("/app", { refresh_token: "ref" })
    );

    // No Set-Cookie → hasAccessToken stays false → /app + anon → redirect to /
    expect(res.status).toBe(307);
    expect(new URL(res.headers.get("location")!).pathname).toBe("/");
  });

  it("passes through on non-redirect page when refresh returns 200 but no Set-Cookie", async () => {
    mockFetch.mockResolvedValue(makeMockRefreshResponse(200, []));

    const res = await middleware(
      makeRequest("/app/chat", { refresh_token: "ref" })
    );

    // /app/chat + anon → no redirect rule for sub-pages → pass through
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });
});

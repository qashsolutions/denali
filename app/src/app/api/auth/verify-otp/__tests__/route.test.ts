import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * POST /api/auth/verify-otp — Unit Tests (T10)
 *
 * Focused on the medicare_status cookie that the route sets after
 * successful OTP verification:
 *   - is_on_medicare=true  → Set-Cookie: medicare_status=yes
 *   - is_on_medicare=false → Set-Cookie: medicare_status=no
 *   - is_on_medicare=null  → NO medicare_status cookie (ask via onboarding)
 *   - NODE_ENV=production  → cookie includes Secure attribute
 *   - NODE_ENV!=production → cookie omits Secure
 */

// --- Mocks ---

const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

const mockInitiateCognitoAuth = vi.fn();
const mockIsEmailAllowed = vi.fn();
vi.mock("@/lib/auth-server", () => ({
  initiateCognitoAuth: (...args: unknown[]) => mockInitiateCognitoAuth(...args),
  isEmailAllowed: (...args: unknown[]) => mockIsEmailAllowed(...args),
  getAuthUser: vi.fn(),
  getAuthUserFromServerContext: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/metrics", () => ({
  withMetrics: (handler: unknown) => handler,
  logRequestMetric: vi.fn(),
  recordMetric: vi.fn(),
}));

vi.mock("@/lib/normalize-email", () => ({
  normalizeEmail: (email: string) => email,
}));

import { POST } from "../route";

// ── Shared fixtures ──

const FUTURE_EXPIRY = new Date(Date.now() + 5 * 60 * 1000).toISOString();

const BASE_VERIFY_ROW = {
  user_id: "user-abc",
  otp_code: "123456",
  otp_expires_at: FUTURE_EXPIRY,
  totp_enrolled_at: null,
};

const COGNITO_TOKENS = {
  accessToken: "access-tok",
  refreshToken: "refresh-tok",
  expiresIn: 3600,
};

// Each test uses a unique email to avoid triggering the module-level
// in-memory OTP rate limiter (max 5 per email per 10 min). The limiter
// is not reset between tests because it lives in the imported module's
// closure — using distinct emails sidesteps it cleanly.
let _emailCounter = 0;
function makeRequest(otp = "123456", extraHeaders?: Record<string, string>): Request {
  const email = `test${++_emailCounter}@example.com`;
  return new Request("http://localhost/api/auth/verify-otp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(extraHeaders ?? {}),
    },
    body: JSON.stringify({ email, otp }),
  });
}

/**
 * Set up the mockQuery to go through the full happy path.
 * `isOnMedicare` controls what the is_on_medicare lookup returns.
 * `sexAtBirth` and `genderIdentity` extend the same row (Chunk 3 — SELECT
 * now pulls all three demographics columns in one round-trip).
 */
function setupHappyPath(
  isOnMedicare: boolean | null,
  sexAtBirth: string | null = null,
  genderIdentity: string | null = null,
) {
  mockQuery.mockImplementation((sql: string) => {
    // 1. user_verification join
    if (sql.includes("FROM user_verification")) {
      return Promise.resolve({ rows: [BASE_VERIFY_ROW], rowCount: 1 });
    }
    // 2. Clear OTP
    if (sql.includes("UPDATE user_verification")) {
      return Promise.resolve({ rows: [], rowCount: 1 });
    }
    // 3. Usage upsert
    if (sql.includes("INSERT INTO usage")) {
      return Promise.resolve({ rows: [], rowCount: 1 });
    }
    // 4. Subscription check
    if (sql.includes("FROM subscriptions")) {
      return Promise.resolve({ rows: [{ trial_start: null }], rowCount: 1 });
    }
    // 5. Subscription insert
    if (sql.includes("INSERT INTO subscriptions")) {
      return Promise.resolve({ rows: [], rowCount: 1 });
    }
    // 6. Profile lookup (Chunk 2 + 3 — is_on_medicare, sex_at_birth, gender_identity)
    if (sql.includes("is_on_medicare")) {
      const hasAny =
        isOnMedicare !== null ||
        sexAtBirth !== null ||
        genderIdentity !== null;
      return Promise.resolve({
        rows: hasAny
          ? [
              {
                is_on_medicare: isOnMedicare,
                sex_at_birth: sexAtBirth,
                gender_identity: genderIdentity,
              },
            ]
          : [],
        rowCount: hasAny ? 1 : 0,
      });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockIsEmailAllowed.mockReturnValue(true);
  mockInitiateCognitoAuth.mockResolvedValue(COGNITO_TOKENS);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/auth/verify-otp — medicare_status cookie (T10)", () => {
  it("sets medicare_status=yes when is_on_medicare=true", async () => {
    setupHappyPath(true);

    const res = await POST(makeRequest() as import("next/server").NextRequest);
    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie();
    const medicareCookie = cookies.find((c) => c.startsWith("medicare_status="));
    expect(medicareCookie).toBeDefined();
    expect(medicareCookie).toContain("medicare_status=yes");
  });

  it("sets medicare_status=no when is_on_medicare=false", async () => {
    setupHappyPath(false);

    const res = await POST(makeRequest() as import("next/server").NextRequest);
    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie();
    const medicareCookie = cookies.find((c) => c.startsWith("medicare_status="));
    expect(medicareCookie).toBeDefined();
    expect(medicareCookie).toContain("medicare_status=no");
  });

  it("does NOT set medicare_status cookie when is_on_medicare=null (user needs onboarding)", async () => {
    setupHappyPath(null);

    const res = await POST(makeRequest() as import("next/server").NextRequest);
    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie();
    const medicareCookie = cookies.find((c) => c.startsWith("medicare_status="));
    expect(medicareCookie).toBeUndefined();
  });

  it("medicare_status cookie includes HttpOnly, SameSite=Lax, Path=/, Max-Age attributes", async () => {
    setupHappyPath(true);

    const res = await POST(makeRequest() as import("next/server").NextRequest);
    const cookies = res.headers.getSetCookie();
    const medicareCookie = cookies.find((c) => c.startsWith("medicare_status="))!;

    expect(medicareCookie).toContain("HttpOnly");
    expect(medicareCookie.toLowerCase()).toContain("samesite=lax");
    expect(medicareCookie).toContain("Path=/");
    expect(medicareCookie).toContain("Max-Age=");
    // Max-Age should be 30 days in seconds
    expect(medicareCookie).toContain("Max-Age=2592000");
  });

  it("cookie includes Secure attribute when NODE_ENV=production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    setupHappyPath(true);

    const res = await POST(makeRequest() as import("next/server").NextRequest);
    const cookies = res.headers.getSetCookie();
    const medicareCookie = cookies.find((c) => c.startsWith("medicare_status="))!;

    expect(medicareCookie).toContain("Secure");
  });

  it("cookie omits Secure attribute in non-production environments", async () => {
    // vitest already runs with NODE_ENV=test; no stub needed.
    // Re-setup mocks explicitly since beforeEach only clears them.
    mockIsEmailAllowed.mockReturnValue(true);
    mockInitiateCognitoAuth.mockResolvedValue(COGNITO_TOKENS);
    setupHappyPath(true);

    const res = await POST(makeRequest() as import("next/server").NextRequest);
    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie();
    const medicareCookie = cookies.find((c) => c.startsWith("medicare_status="));
    // Cookie must be present (is_on_medicare=true)
    expect(medicareCookie).toBeDefined();
    // In non-prod, Secure should NOT appear
    expect(medicareCookie).not.toContain("Secure");
  });

  // ── Sanity: auth flow still produces access_token + refresh_token ──

  it("always sets access_token and refresh_token cookies on success", async () => {
    mockIsEmailAllowed.mockReturnValue(true);
    mockInitiateCognitoAuth.mockResolvedValue(COGNITO_TOKENS);
    setupHappyPath(true);

    const res = await POST(makeRequest() as import("next/server").NextRequest);
    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie();
    // Next.js serialises Set-Cookie as "name=value; ..." — check for name+value substring
    expect(cookies.some((c) => c.includes("access_token=") && c.includes("access-tok"))).toBe(true);
    expect(cookies.some((c) => c.includes("refresh_token=") && c.includes("refresh-tok"))).toBe(true);
  });

  // ── Chunk 3 — sex_at_birth_status cookie ──

  it("sets sex_at_birth_status cookie with the enum value when DB has sex_at_birth", async () => {
    setupHappyPath(true, "male");

    const res = await POST(makeRequest() as import("next/server").NextRequest);
    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie();
    const sabCookie = cookies.find((c) => c.startsWith("sex_at_birth_status="));
    expect(sabCookie).toBeDefined();
    expect(sabCookie).toContain("sex_at_birth_status=male");
    // Same security attributes as medicare_status
    expect(sabCookie).toContain("HttpOnly");
    expect(sabCookie!.toLowerCase()).toContain("samesite=lax");
    expect(sabCookie).toContain("Path=/");
    expect(sabCookie).toContain("Max-Age=2592000");
  });

  it("does NOT set sex_at_birth_status cookie when DB sex_at_birth is null (user needs onboarding)", async () => {
    // is_on_medicare=true so medicare_status cookie IS set, isolating the
    // sex_at_birth_status branch — proves the new cookie set is independent
    // of the medicare one.
    setupHappyPath(true, null);

    const res = await POST(makeRequest() as import("next/server").NextRequest);
    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie();
    const sabCookie = cookies.find((c) => c.startsWith("sex_at_birth_status="));
    expect(sabCookie).toBeUndefined();
    // medicare_status should still be set (independence check)
    const medicareCookie = cookies.find((c) => c.startsWith("medicare_status="));
    expect(medicareCookie).toBeDefined();
    expect(medicareCookie).toContain("medicare_status=yes");
  });
});

/**
 * Phase 1 mobile — X-Client-Type: mobile branch.
 *
 * Added by mobile-auth-wirer (Wave 1) per docs/design/phase-1-45plus.md §76.
 *
 * Tests prove:
 *   1. Mobile branch returns body tokens and NO Set-Cookie at all.
 *   2. Web path (no header) is byte-identical to its pre-mobile behavior —
 *      this is the LOAD-BEARING regression test. If anyone refactors the
 *      mobile branch and accidentally drops a cookie on the web path,
 *      these tests fire.
 *
 * Both tests use `setupHappyPath` so they exercise the same DB stub trail.
 */
describe("POST /api/auth/verify-otp — X-Client-Type: mobile (Phase 1 mobile)", () => {
  it("returns body tokens and NO Set-Cookie when header is 'mobile'", async () => {
    setupHappyPath(true, "male", "non_binary");

    const res = await POST(
      makeRequest("123456", { "X-Client-Type": "mobile" }) as
        import("next/server").NextRequest,
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    // Exact mobile response shape per the agent definition + spec §76.
    expect(body).toEqual({
      success: true,
      mfaRequired: false,
      user: { email: expect.any(String), userId: "user-abc" },
      access_token: "access-tok",
      refresh_token: "refresh-tok",
      expires_in: 3600,
    });

    // CRITICAL: zero Set-Cookie headers on the mobile branch.
    const cookies = res.headers.getSetCookie();
    expect(cookies).toEqual([]);
  });

  it("byte-identical web regression: NO header → existing response shape unchanged + all expected cookies present", async () => {
    setupHappyPath(true, "male", "non_binary");

    // Snapshot the pre-mobile-branch behavior: web path MUST still set every
    // cookie the route used to set. Any drift here means the mobile branch
    // accidentally tampered with the web path.
    const res = await POST(makeRequest() as import("next/server").NextRequest);
    expect(res.status).toBe(200);

    // Response body shape — web has NEVER returned tokens in the body, and
    // adding `access_token`/`refresh_token` to the web body would be a security
    // regression. Assert they remain absent.
    const body = await res.json();
    expect(body).toEqual({
      success: true,
      mfaRequired: false,
      user: { email: expect.any(String), userId: "user-abc" },
    });
    expect(body).not.toHaveProperty("access_token");
    expect(body).not.toHaveProperty("refresh_token");
    expect(body).not.toHaveProperty("expires_in");

    // Every Set-Cookie the route emitted before the mobile branch existed
    // must still be present:
    //   - access_token (Cognito JWT, HttpOnly)
    //   - refresh_token (Cognito refresh, HttpOnly, 30 days)
    //   - session_issued_at (NIST 800-63B 7-day cap timestamp)
    //   - mfa_verified (cleared / Max-Age=0 on fresh login)
    //   - medicare_status (yes, because is_on_medicare=true)
    //   - sex_at_birth_status (male, because sex_at_birth="male")
    const cookies = res.headers.getSetCookie();

    const access = cookies.find((c) => c.startsWith("access_token="));
    expect(access).toBeDefined();
    expect(access).toContain("access_token=access-tok");
    expect(access).toContain("HttpOnly");
    expect(access!.toLowerCase()).toContain("samesite=lax");
    expect(access).toContain("Path=/");
    expect(access).toContain("Max-Age=3600");

    const refresh = cookies.find((c) => c.startsWith("refresh_token="));
    expect(refresh).toBeDefined();
    expect(refresh).toContain("refresh_token=refresh-tok");
    expect(refresh).toContain("HttpOnly");
    expect(refresh!.toLowerCase()).toContain("samesite=lax");
    expect(refresh).toContain("Path=/");
    // 30 days in seconds — must match the existing route line ("30 * 24 * 60 * 60").
    expect(refresh).toContain("Max-Age=2592000");

    const sessionIssuedAt = cookies.find((c) =>
      c.startsWith("session_issued_at="),
    );
    expect(sessionIssuedAt).toBeDefined();
    expect(sessionIssuedAt).toContain("HttpOnly");
    expect(sessionIssuedAt!.toLowerCase()).toContain("samesite=lax");
    expect(sessionIssuedAt).toContain("Path=/");
    expect(sessionIssuedAt).toContain("Max-Age=2592000");

    const mfaCleared = cookies.find((c) => c.startsWith("mfa_verified="));
    expect(mfaCleared).toBeDefined();
    expect(mfaCleared).toContain("Max-Age=0");

    const medicare = cookies.find((c) => c.startsWith("medicare_status="));
    expect(medicare).toBeDefined();
    expect(medicare).toContain("medicare_status=yes");
    expect(medicare).toContain("Max-Age=2592000");

    const sab = cookies.find((c) => c.startsWith("sex_at_birth_status="));
    expect(sab).toBeDefined();
    expect(sab).toContain("sex_at_birth_status=male");
    expect(sab).toContain("Max-Age=2592000");
  });

  it("byte-identical web regression: any non-mobile header value preserves cookies", async () => {
    // Defensive — only the exact string "mobile" triggers the branch.
    // Anything else (other clients, typos) must use the web path.
    setupHappyPath(true, "female");

    const res = await POST(
      makeRequest("123456", { "X-Client-Type": "web" }) as
        import("next/server").NextRequest,
    );
    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie();
    // Sample two cookies that prove we took the web path.
    expect(cookies.some((c) => c.includes("access_token=access-tok"))).toBe(true);
    expect(cookies.some((c) => c.startsWith("refresh_token="))).toBe(true);
    expect(cookies.some((c) => c.startsWith("session_issued_at="))).toBe(true);

    // And the body shape stays "web" (no tokens).
    const body = await res.json();
    expect(body).not.toHaveProperty("access_token");
  });

  it("mobile branch sets mfaRequired:true when totp_enrolled_at is set", async () => {
    // Mirror the web's mfaRequired calculation — present on both branches.
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM user_verification")) {
        return Promise.resolve({
          rows: [{ ...BASE_VERIFY_ROW, totp_enrolled_at: "2026-01-01T00:00:00Z" }],
          rowCount: 1,
        });
      }
      if (sql.includes("UPDATE user_verification")) return Promise.resolve({ rows: [], rowCount: 1 });
      if (sql.includes("INSERT INTO usage")) return Promise.resolve({ rows: [], rowCount: 1 });
      if (sql.includes("FROM subscriptions"))
        return Promise.resolve({ rows: [{ trial_start: null }], rowCount: 1 });
      if (sql.includes("INSERT INTO subscriptions"))
        return Promise.resolve({ rows: [], rowCount: 1 });
      if (sql.includes("is_on_medicare"))
        return Promise.resolve({ rows: [], rowCount: 0 });
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await POST(
      makeRequest("123456", { "X-Client-Type": "mobile" }) as
        import("next/server").NextRequest,
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.mfaRequired).toBe(true);
    expect(body.access_token).toBe("access-tok");

    // Still zero cookies on mobile.
    expect(res.headers.getSetCookie()).toEqual([]);
  });
});

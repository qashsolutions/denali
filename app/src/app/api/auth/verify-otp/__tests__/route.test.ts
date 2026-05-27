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
function makeRequest(otp = "123456"): Request {
  const email = `test${++_emailCounter}@example.com`;
  return new Request("http://localhost/api/auth/verify-otp", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, otp }),
  });
}

/**
 * Set up the mockQuery to go through the full happy path.
 * `isOnMedicare` controls what the is_on_medicare lookup returns.
 */
function setupHappyPath(isOnMedicare: boolean | null) {
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
    // 6. is_on_medicare lookup
    if (sql.includes("is_on_medicare")) {
      return Promise.resolve({
        rows: isOnMedicare !== null ? [{ is_on_medicare: isOnMedicare }] : [],
        rowCount: isOnMedicare !== null ? 1 : 0,
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
});

import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET + PATCH /api/profile — Unit Tests (T11 + T12)
 *
 * T11 — PATCH /api/profile medicare_status cookie sync:
 *   PATCH {is_on_medicare:true}  → Set-Cookie: medicare_status=yes
 *   PATCH {is_on_medicare:false} → Set-Cookie: medicare_status=no
 *   PATCH {birth_year:1955}      → NO medicare_status cookie
 *   PATCH {birth_year, is_on_medicare:true} → BOTH effects
 *
 * T12 — GET /api/profile medicare_status cookie heal:
 *   No request cookie + DB true  → Set-Cookie: medicare_status=yes
 *   No request cookie + DB false → Set-Cookie: medicare_status=no
 *   No request cookie + DB null  → NO Set-Cookie
 *   Request has medicare_status=yes + DB true → NO Set-Cookie (no churn)
 */

// --- Mocks ---

const mockGetAuthUser = vi.fn();
vi.mock("@/lib/auth-server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/metrics", () => ({
  withMetrics: (handler: unknown) => handler,
  logRequestMetric: vi.fn(),
  recordMetric: vi.fn(),
}));

import { NextRequest } from "next/server";
import { PATCH, GET } from "../route";

const MOCK_USER = { userId: "user-123", email: "test@example.com" };

// ── Request builders ──
// Both PATCH and GET use NextRequest so that request.cookies.has() works
// (NextRequest parses Cookie headers into the .cookies ReadonlyRequestCookies API).

function makePatchRequest(body: unknown, cookies?: Record<string, string>): NextRequest {
  const cookieHeader = cookies
    ? Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ")
    : "";
  return new NextRequest("http://localhost/api/profile", {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
    },
    body: JSON.stringify(body),
  });
}

function makeGetRequest(cookies?: Record<string, string>): NextRequest {
  const cookieHeader = cookies
    ? Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ")
    : "";
  return new NextRequest("http://localhost/api/profile", {
    method: "GET",
    headers: cookieHeader ? { cookie: cookieHeader } : {},
  });
}

// ── Full GET profile mock (4 parallel queries) ──
function setupGetProfileQueries(
  isOnMedicare: boolean | null,
  sexAtBirth: string | null = null,
  genderIdentity: string | null = null,
) {
  mockQuery.mockImplementation((sql: string) => {
    if (sql.includes("birth_year_modal")) {
      // Main profile query (Chunk 3 — also returns sex_at_birth, gender_identity)
      return Promise.resolve({
        rows: [
          {
            plan: "trial",
            role: "patient",
            is_admin: false,
            birth_year: null,
            is_on_medicare: isOnMedicare,
            sex_at_birth: sexAtBirth,
            gender_identity: genderIdentity,
            birth_year_modal_dismissed_at: null,
            birth_year_modal_disabled: false,
          },
        ],
        rowCount: 1,
      });
    }
    if (sql.includes("appeal_count")) {
      return Promise.resolve({ rows: [{ appeal_count: 0, appeal_credits: 0 }], rowCount: 1 });
    }
    if (sql.includes("idme_verified")) {
      return Promise.resolve({
        rows: [{ idme_verified: false, idme_first_name: null, idme_gender: null }],
        rowCount: 1,
      });
    }
    if (sql.includes("has_stripe_customer")) {
      return Promise.resolve({ rows: [{ has_stripe_customer: false }], rowCount: 1 });
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetAuthUser.mockResolvedValue(MOCK_USER);
});

// =============================================================================
// T11 — PATCH /api/profile cookie sync
// =============================================================================

describe("PATCH /api/profile — medicare_status cookie sync (T11)", () => {
  it("sets medicare_status=yes when PATCH body contains is_on_medicare:true", async () => {
    mockQuery.mockResolvedValue({
      rows: [{ birth_year: null, is_on_medicare: true }],
      rowCount: 1,
    });

    const res = await PATCH(
      makePatchRequest({ is_on_medicare: true })    );
    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie();
    const medicareCookie = cookies.find((c) => c.startsWith("medicare_status="));
    expect(medicareCookie).toBeDefined();
    expect(medicareCookie).toContain("medicare_status=yes");
  });

  it("sets medicare_status=no when PATCH body contains is_on_medicare:false", async () => {
    mockQuery.mockResolvedValue({
      rows: [{ birth_year: null, is_on_medicare: false }],
      rowCount: 1,
    });

    const res = await PATCH(
      makePatchRequest({ is_on_medicare: false })    );
    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie();
    const medicareCookie = cookies.find((c) => c.startsWith("medicare_status="));
    expect(medicareCookie).toBeDefined();
    expect(medicareCookie).toContain("medicare_status=no");
  });

  it("does NOT set medicare_status cookie when PATCH contains only birth_year", async () => {
    mockQuery.mockResolvedValue({
      rows: [{ birth_year: 1955, is_on_medicare: false }],
      rowCount: 1,
    });

    const res = await PATCH(
      makePatchRequest({ birth_year: 1955 })    );
    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie();
    const medicareCookie = cookies.find((c) => c.startsWith("medicare_status="));
    expect(medicareCookie).toBeUndefined();
  });

  it("sets birth_year AND medicare_status=yes when PATCH contains both fields", async () => {
    mockQuery.mockResolvedValue({
      rows: [{ birth_year: 1960, is_on_medicare: true }],
      rowCount: 1,
    });

    const res = await PATCH(
      makePatchRequest({ birth_year: 1960, is_on_medicare: true })    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.birthYear).toBe(1960);
    expect(body.isOnMedicare).toBe(true);

    const cookies = res.headers.getSetCookie();
    const medicareCookie = cookies.find((c) => c.startsWith("medicare_status="));
    expect(medicareCookie).toBeDefined();
    expect(medicareCookie).toContain("medicare_status=yes");
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await PATCH(
      makePatchRequest({ is_on_medicare: true })    );
    expect(res.status).toBe(401);
  });
});

// =============================================================================
// Chunk 3 Step 5 — PATCH sex_at_birth + gender_identity
// =============================================================================

describe("PATCH /api/profile — sex_at_birth + gender_identity (Chunk 3)", () => {
  it("sets sex_at_birth_status cookie to 'male' when PATCH body has sex_at_birth='male'", async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          birth_year: null,
          is_on_medicare: false,
          sex_at_birth: "male",
          gender_identity: null,
        },
      ],
      rowCount: 1,
    });

    const res = await PATCH(makePatchRequest({ sex_at_birth: "male" }));
    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie();
    const sabCookie = cookies.find((c) => c.startsWith("sex_at_birth_status="));
    expect(sabCookie).toBeDefined();
    expect(sabCookie).toContain("sex_at_birth_status=male");
    expect(sabCookie).toContain("HttpOnly");
    expect(sabCookie!.toLowerCase()).toContain("samesite=lax");
    expect(sabCookie).toContain("Path=/");
    expect(sabCookie).toContain("Max-Age=2592000");
  });

  it("sets sex_at_birth_status cookie to 'unknown' when PATCH body has sex_at_birth='unknown' (Prefer-not-to-say UI mapping)", async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          birth_year: null,
          is_on_medicare: false,
          sex_at_birth: "unknown",
          gender_identity: null,
        },
      ],
      rowCount: 1,
    });

    const res = await PATCH(makePatchRequest({ sex_at_birth: "unknown" }));
    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie();
    const sabCookie = cookies.find((c) => c.startsWith("sex_at_birth_status="));
    expect(sabCookie).toBeDefined();
    expect(sabCookie).toContain("sex_at_birth_status=unknown");
  });

  it("clears sex_at_birth_status cookie (Max-Age=0) when PATCH body has sex_at_birth=null", async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          birth_year: null,
          is_on_medicare: false,
          sex_at_birth: null,
          gender_identity: null,
        },
      ],
      rowCount: 1,
    });

    const res = await PATCH(makePatchRequest({ sex_at_birth: null }));
    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie();
    const sabCookie = cookies.find((c) => c.startsWith("sex_at_birth_status="));
    expect(sabCookie).toBeDefined();
    // Cleared via Max-Age=0 — matches the signout/route.ts pattern
    expect(sabCookie).toContain("Max-Age=0");
  });

  it("returns 400 when sex_at_birth is an invalid enum value (DB not touched, cookie not changed)", async () => {
    // mockQuery should not be called past validation; provide a guard
    mockQuery.mockImplementation(() => {
      throw new Error("DB should not be reached on validation failure");
    });

    const res = await PATCH(
      makePatchRequest({ sex_at_birth: "not_a_real_value" }),
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.field).toBe("sex_at_birth");

    // No sex_at_birth_status cookie should be set or cleared
    const cookies = res.headers.getSetCookie();
    const sabCookie = cookies.find((c) => c.startsWith("sex_at_birth_status="));
    expect(sabCookie).toBeUndefined();
  });

  it("persists gender_identity to DB but does NOT set/change sex_at_birth_status cookie", async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          birth_year: null,
          is_on_medicare: false,
          sex_at_birth: null,
          gender_identity: "non-binary",
        },
      ],
      rowCount: 1,
    });

    const res = await PATCH(
      makePatchRequest({ gender_identity: "non-binary" }),
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.genderIdentity).toBe("non-binary");

    // gender_identity does NOT drive any cookie
    const cookies = res.headers.getSetCookie();
    const sabCookie = cookies.find((c) => c.startsWith("sex_at_birth_status="));
    expect(sabCookie).toBeUndefined();
    const giCookie = cookies.find((c) => c.startsWith("gender_identity"));
    expect(giCookie).toBeUndefined();
  });

  it("returns 400 when gender_identity is an invalid enum value", async () => {
    mockQuery.mockImplementation(() => {
      throw new Error("DB should not be reached on validation failure");
    });

    const res = await PATCH(makePatchRequest({ gender_identity: "bogus" }));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.field).toBe("gender_identity");
  });

  it("accepts a full three-field PATCH (is_on_medicare + sex_at_birth + gender_identity) — onboarding form happy path", async () => {
    mockQuery.mockResolvedValue({
      rows: [
        {
          birth_year: null,
          is_on_medicare: true,
          sex_at_birth: "female",
          gender_identity: "female",
        },
      ],
      rowCount: 1,
    });

    const res = await PATCH(
      makePatchRequest({
        is_on_medicare: true,
        sex_at_birth: "female",
        gender_identity: "female",
      }),
    );
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.isOnMedicare).toBe(true);
    expect(body.sexAtBirth).toBe("female");
    expect(body.genderIdentity).toBe("female");

    const cookies = res.headers.getSetCookie();
    const medicareCookie = cookies.find((c) =>
      c.startsWith("medicare_status="),
    );
    expect(medicareCookie).toContain("medicare_status=yes");
    const sabCookie = cookies.find((c) => c.startsWith("sex_at_birth_status="));
    expect(sabCookie).toContain("sex_at_birth_status=female");
    // gender_identity still produces no cookie
    const giCookie = cookies.find((c) => c.startsWith("gender_identity"));
    expect(giCookie).toBeUndefined();
  });
});

// =============================================================================
// T12 — GET /api/profile cookie heal
// =============================================================================

describe("GET /api/profile — medicare_status cookie heal (T12)", () => {
  it("sets medicare_status=yes when no request cookie and DB is_on_medicare=true", async () => {
    setupGetProfileQueries(true);

    // No medicare_status in request cookies
    const res = await GET(makeGetRequest() as import("next/server").NextRequest);
    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie();
    const medicareCookie = cookies.find((c) => c.startsWith("medicare_status="));
    expect(medicareCookie).toBeDefined();
    expect(medicareCookie).toContain("medicare_status=yes");
  });

  it("sets medicare_status=no when no request cookie and DB is_on_medicare=false", async () => {
    setupGetProfileQueries(false);

    const res = await GET(makeGetRequest() as import("next/server").NextRequest);
    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie();
    const medicareCookie = cookies.find((c) => c.startsWith("medicare_status="));
    expect(medicareCookie).toBeDefined();
    expect(medicareCookie).toContain("medicare_status=no");
  });

  it("does NOT set medicare_status cookie when DB is_on_medicare=null (user hasn't answered)", async () => {
    setupGetProfileQueries(null);

    const res = await GET(makeGetRequest() as import("next/server").NextRequest);
    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie();
    const medicareCookie = cookies.find((c) => c.startsWith("medicare_status="));
    expect(medicareCookie).toBeUndefined();
  });

  it("does NOT set medicare_status cookie when request already has medicare_status=yes (no churn)", async () => {
    setupGetProfileQueries(true);

    // Cookie already present in the request
    const res = await GET(
      makeGetRequest({ medicare_status: "yes" })    );
    expect(res.status).toBe(200);

    const cookies = res.headers.getSetCookie();
    // heal should be skipped — no new Set-Cookie for medicare_status
    const medicareCookie = cookies.find((c) => c.startsWith("medicare_status="));
    expect(medicareCookie).toBeUndefined();
  });

  it("returns authenticated:false JSON (no cookie) when not signed in", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await GET(makeGetRequest() as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.authenticated).toBe(false);

    // No DB queries → no medicare_status cookie
    const cookies = res.headers.getSetCookie();
    const medicareCookie = cookies.find((c) => c.startsWith("medicare_status="));
    expect(medicareCookie).toBeUndefined();
  });
});

// =============================================================================
// Chunk 3 Step 6.5 — GET response includes sex_at_birth + gender_identity
// =============================================================================

describe("GET /api/profile — sex_at_birth + gender_identity in response (Chunk 3)", () => {
  it("returns sexAtBirth when DB has a recognised value", async () => {
    setupGetProfileQueries(true, "male", null);

    const res = await GET(makeGetRequest() as import("next/server").NextRequest);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.sexAtBirth).toBe("male");
    expect(body.genderIdentity).toBeNull();
  });

  it("returns genderIdentity when DB has a recognised value", async () => {
    setupGetProfileQueries(true, "female", "non-binary");

    const res = await GET(makeGetRequest() as import("next/server").NextRequest);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.sexAtBirth).toBe("female");
    expect(body.genderIdentity).toBe("non-binary");
  });

  it("returns nulls for both when DB has nulls (user hasn't answered yet)", async () => {
    setupGetProfileQueries(null, null, null);

    const res = await GET(makeGetRequest() as import("next/server").NextRequest);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.sexAtBirth).toBeNull();
    expect(body.genderIdentity).toBeNull();
  });

  it("coerces an invalid sex_at_birth DB value to null (value-set drift defense)", async () => {
    // Legacy/manual-edit value that's no longer in our enum.
    setupGetProfileQueries(true, "hermaphrodite", null);

    const res = await GET(makeGetRequest() as import("next/server").NextRequest);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.sexAtBirth).toBeNull();
  });

  it("coerces an invalid gender_identity DB value to null (value-set drift defense)", async () => {
    setupGetProfileQueries(true, "male", "genderqueer");

    const res = await GET(makeGetRequest() as import("next/server").NextRequest);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.genderIdentity).toBeNull();
    // sex_at_birth narrowing should be independent — male still passes through
    expect(body.sexAtBirth).toBe("male");
  });
});

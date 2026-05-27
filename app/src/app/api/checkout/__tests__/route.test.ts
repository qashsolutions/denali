import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/checkout — Unit Tests (T8)
 *
 * Stage 2 cohort gate: Starter plan is Medicare-only.
 * Non-Medicare (false or null) users requesting starter get 403 starter_requires_medicare.
 * Non-Medicare users requesting plus/unlimited go through normally.
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

// Mock the Stripe dynamic import. The checkout route does:
//   const StripeModule = await import("stripe");
//   const stripe = new StripeModule.default(stripeKey);
//   stripe.checkout.sessions.create(...)
const mockSessionCreate = vi.fn();
// Stripe is dynamically imported in the route: `new StripeModule.default(key)`.
// The mock must be a real constructor function (not an arrow vi.fn()) so that
// `new` works. We use a named function expression to satisfy this.
vi.mock("stripe", () => {
  return {
    default: function StripeConstructor() {
      return {
        checkout: {
          sessions: {
            create: mockSessionCreate,
          },
        },
      };
    },
  };
});

import { POST } from "../route";

const MOCK_USER = { userId: "user-123", email: "test@example.com" };

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Set Stripe key so the "key not configured" guard passes
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake_key_for_tests");
  // Default Stripe session response
  mockSessionCreate.mockResolvedValue({ url: "https://stripe.test/checkout/xyz" });
});

describe("POST /api/checkout — cohort gate (T8)", () => {
  // ── Medicare users ──

  it("returns 200 with Stripe URL when is_on_medicare=true and plan=starter", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("is_on_medicare")) {
        return Promise.resolve({ rows: [{ is_on_medicare: true }], rowCount: 1 });
      }
      // subscriptions lookup — no active sub
      if (sql.includes("FROM subscriptions")) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await POST(makeRequest({ plan: "starter" }) as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://stripe.test/checkout/xyz");
  });

  it("returns 200 with Stripe URL when is_on_medicare=true and plan=plus", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    // No medicare query for non-starter plan
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM subscriptions")) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await POST(makeRequest({ plan: "plus" }) as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://stripe.test/checkout/xyz");
  });

  // ── Non-Medicare users — starter blocked ──

  it("returns 403 starter_requires_medicare when is_on_medicare=false and plan=starter", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockResolvedValue({ rows: [{ is_on_medicare: false }], rowCount: 1 });

    const res = await POST(makeRequest({ plan: "starter" }) as import("next/server").NextRequest);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("starter_requires_medicare");
  });

  it("returns 403 starter_requires_medicare when is_on_medicare=null and plan=starter", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockResolvedValue({ rows: [{ is_on_medicare: null }], rowCount: 1 });

    const res = await POST(makeRequest({ plan: "starter" }) as import("next/server").NextRequest);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("starter_requires_medicare");
  });

  // ── Non-Medicare users — plus/unlimited allowed ──

  it("returns 200 when is_on_medicare=false and plan=plus (gate only fires for starter)", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM subscriptions")) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await POST(makeRequest({ plan: "plus" }) as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://stripe.test/checkout/xyz");
  });

  it("returns 200 when is_on_medicare=false and plan=unlimited", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("FROM subscriptions")) {
        return Promise.resolve({ rows: [], rowCount: 0 });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await POST(makeRequest({ plan: "unlimited" }) as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://stripe.test/checkout/xyz");
  });

  // ── Auth ──

  it("returns 401 when unauthenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await POST(makeRequest({ plan: "starter" }) as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  // ── Plan validation ──

  it("returns 400 for invalid plan value", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);

    const res = await POST(makeRequest({ plan: "enterprise" }) as import("next/server").NextRequest);
    expect(res.status).toBe(400);
  });

  // ── Stripe key guard ──

  it("returns 503 when STRIPE_SECRET_KEY is missing", async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    mockGetAuthUser.mockResolvedValue(MOCK_USER);

    const res = await POST(makeRequest({ plan: "plus" }) as import("next/server").NextRequest);
    expect(res.status).toBe(503);
  });
});

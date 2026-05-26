import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/profile/birth-year-reminder/dismiss — Unit Tests
 *
 * The dismiss endpoint sets users.birth_year_modal_dismissed_at = NOW()
 * and fires a BIRTH_YEAR_REMINDER_DISMISSED audit log entry.
 *
 * This endpoint is cohort-agnostic: it applies to any authenticated user
 * regardless of is_on_medicare. No cohort fixtures are used here.
 *
 * Mocking layer:
 *   - @/lib/auth-server → getAuthUser (controllable mock)
 *   - @/lib/db         → query (controllable mock)
 *   - @/lib/audit      → logAudit (spy — fire-and-forget in route)
 *   - @/lib/metrics    → withMetrics (pass-through — avoids CloudWatch side-effects)
 */

// ---------------------------------------------------------------------------
// Mocks — declared before any imports so vi.mock hoisting fires correctly
// ---------------------------------------------------------------------------

const mockGetAuthUser = vi.fn();
vi.mock("@/lib/auth-server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

const mockLogAudit = vi.fn();
vi.mock("@/lib/audit", () => ({
  logAudit: (...args: unknown[]) => mockLogAudit(...args),
}));

// withMetrics wraps the handler and records CloudWatch metrics.
// In tests we make it a transparent pass-through so:
//   (a) the real handler logic is exercised unchanged
//   (b) no CloudWatch/logger side-effects fire
vi.mock("@/lib/metrics", () => ({
  withMetrics: (handler: (req: unknown) => Promise<Response>, _route: string) => handler,
}));

// ---------------------------------------------------------------------------
// Imports — must come after vi.mock() calls
// ---------------------------------------------------------------------------

import { NextRequest } from "next/server";
import { POST } from "../route";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const MOCK_USER = { userId: "user-abc-123", email: "patient@example.com" };

/** Minimal valid POST request to the dismiss endpoint */
function makeRequest(): NextRequest {
  return new NextRequest(
    "http://localhost/api/profile/birth-year-reminder/dismiss",
    { method: "POST" },
  );
}

/** Minimal DB query result shape returned by query() on success */
function makeQueryResult() {
  return { rows: [], rowCount: 1, command: "UPDATE", oid: 0, fields: [] };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/profile/birth-year-reminder/dismiss", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: authenticated user, DB write succeeds, logAudit resolves
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockResolvedValue(makeQueryResult());
    mockLogAudit.mockReturnValue(Promise.resolve());
  });

  // ── Case 1: 401 Unauthorized ──────────────────────────────────────────────

  it("returns 401 when user is not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await POST(makeRequest());

    expect(res.status).toBe(401);
    const body = await res.json();
    // Route uses AUTH.SIGN_IN_REQUIRED from @/config/messages
    expect(body.error).toBe("Please sign in to continue.");
  });

  it("does not call query() when user is not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    await POST(makeRequest());

    expect(mockQuery).not.toHaveBeenCalled();
  });

  // ── Case 2: 200 Happy path ────────────────────────────────────────────────

  it("returns 200 with { success: true } on authenticated success", async () => {
    const res = await POST(makeRequest());

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  it("calls query() with the correct UPDATE SQL and user id", async () => {
    await POST(makeRequest());

    expect(mockQuery).toHaveBeenCalledOnce();
    const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]];

    // The SQL must touch birth_year_modal_dismissed_at and updated_at
    expect(sql).toContain("birth_year_modal_dismissed_at");
    expect(sql).toContain("updated_at");
    expect(sql.toLowerCase()).toContain("update users");

    // First (and only) parameter must be the authenticated user's id
    expect(params).toHaveLength(1);
    expect(params[0]).toBe(MOCK_USER.userId);
  });

  // ── Case 3: Audit log ─────────────────────────────────────────────────────

  it("fires logAudit with BIRTH_YEAR_REMINDER_DISMISSED action on success", async () => {
    await POST(makeRequest());

    // logAudit is fire-and-forget (.catch(() => {})) — it IS called, but its
    // rejection does not surface to the caller.
    expect(mockLogAudit).toHaveBeenCalledOnce();
    const [action, opts] = mockLogAudit.mock.calls[0] as [
      string,
      { userId: string; resourceType: string; metadata: Record<string, unknown> },
    ];
    expect(action).toBe("BIRTH_YEAR_REMINDER_DISMISSED");
    expect(opts.userId).toBe(MOCK_USER.userId);
    expect(opts.resourceType).toBe("account");
    expect(opts.metadata).toMatchObject({ source: "modal" });
  });

  it("still returns 200 when logAudit rejects (fire-and-forget)", async () => {
    // Audit failures must never surface to the caller — the route does
    // logAudit(...).catch(() => {}).
    mockLogAudit.mockReturnValue(Promise.reject(new Error("audit write failed")));

    const res = await POST(makeRequest());

    // Give the microtask queue a tick so the rejected promise is handled
    await new Promise((r) => setTimeout(r, 0));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ success: true });
  });

  // ── Case 4: 500 on DB failure ─────────────────────────────────────────────

  it("returns 500 when query() throws", async () => {
    mockQuery.mockRejectedValue(new Error("connection refused"));

    const res = await POST(makeRequest());

    expect(res.status).toBe(500);
  });

  it("does not leak raw error details in 500 response body", async () => {
    mockQuery.mockRejectedValue(new Error("pg: password authentication failed for user denali"));

    const res = await POST(makeRequest());
    const body = await res.json();

    // Body must contain a user-safe message, not the raw error
    expect(body.error).toBeTruthy();
    expect(body.error).not.toContain("pg:");
    expect(body.error).not.toContain("password authentication");
    // Route uses SYSTEM.SAVE_PREFERENCE — "We couldn't save that setting. Please try again."
    expect(body.error).toBe("We couldn't save that setting. Please try again.");
  });

  it("does not call logAudit when query() throws", async () => {
    mockQuery.mockRejectedValue(new Error("DB is down"));

    await POST(makeRequest());

    // The error is caught before logAudit is called
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  // ── Case 5: Method gate ───────────────────────────────────────────────────

  it("exports POST but not GET (route is POST-only)", async () => {
    // The route module exports only POST (via withMetrics).
    // A missing GET export means the Next.js runtime returns 405 automatically.
    // We cast to a loose record so TypeScript does not reject the GET access —
    // the point is to assert at runtime that GET was never added.
    const routeModule = (await import("../route")) as Record<string, unknown>;
    expect(typeof routeModule.POST).toBe("function");
    expect(routeModule.GET).toBeUndefined();
  });
});

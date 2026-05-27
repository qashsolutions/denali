import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * POST /api/appeal-outcome — Unit Tests
 *
 * Stage 2 gate: appeals are Medicare-only.
 * Auth check (401) fires before cohort check (403).
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

const mockRecordAppealOutcome = vi.fn();
const mockApplyOutcomeIncentive = vi.fn();
vi.mock("@/lib/learning", () => ({
  recordAppealOutcome: (...args: unknown[]) => mockRecordAppealOutcome(...args),
  applyOutcomeIncentive: (...args: unknown[]) => mockApplyOutcomeIncentive(...args),
  // other exports that may be referenced
  updateSymptomMapping: vi.fn(),
  updateProcedureMapping: vi.fn(),
  queueLearningJob: vi.fn().mockResolvedValue(undefined),
  recordCoveragePath: vi.fn(),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/metrics", () => ({
  withMetrics: (handler: unknown) => handler,
  logRequestMetric: vi.fn(),
  recordMetric: vi.fn(),
}));

import { POST } from "../route";

const MOCK_USER = {
  userId: "user-123",
  email: "test@example.com",
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/appeal-outcome", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  // Default: recordAppealOutcome returns success
  mockRecordAppealOutcome.mockResolvedValue(true);
  mockApplyOutcomeIncentive.mockResolvedValue(false);
});

describe("POST /api/appeal-outcome — cohort gate", () => {
  const validBody = { appealId: "appeal-123", outcome: "approved" };

  it("returns 401 when unauthenticated (auth check fires before cohort gate)", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await POST(makeRequest(validBody) as import("next/server").NextRequest);
    expect(res.status).toBe(401);

    const body = await res.json();
    // AUTH.SIGN_IN_REQUIRED = "Please sign in to continue."
    expect(body.error).toBeTruthy();
    // Cohort query should not have been called
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it("returns 403 appeals_require_medicare when is_on_medicare=false", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockResolvedValue({
      rows: [{ is_on_medicare: false }],
      rowCount: 1,
    });

    const res = await POST(makeRequest(validBody) as import("next/server").NextRequest);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toBe("appeals_require_medicare");
    expect(mockRecordAppealOutcome).not.toHaveBeenCalled();
  });

  it("returns 403 appeals_require_medicare when is_on_medicare=null", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockResolvedValue({
      rows: [{ is_on_medicare: null }],
      rowCount: 1,
    });

    const res = await POST(makeRequest(validBody) as import("next/server").NextRequest);
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toBe("appeals_require_medicare");
  });

  it("returns 200 with success=true when is_on_medicare=true and outcome is valid", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockResolvedValue({
      rows: [{ is_on_medicare: true }],
      rowCount: 1,
    });
    mockRecordAppealOutcome.mockResolvedValue(true);
    mockApplyOutcomeIncentive.mockResolvedValue(false);

    const res = await POST(makeRequest(validBody) as import("next/server").NextRequest);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockRecordAppealOutcome).toHaveBeenCalledOnce();
  });

  it("passes all three valid outcome values: approved, denied, partial", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockResolvedValue({ rows: [{ is_on_medicare: true }], rowCount: 1 });
    mockRecordAppealOutcome.mockResolvedValue(true);
    mockApplyOutcomeIncentive.mockResolvedValue(false);

    for (const outcome of ["approved", "denied", "partial"] as const) {
      vi.clearAllMocks();
      mockGetAuthUser.mockResolvedValue(MOCK_USER);
      mockQuery.mockResolvedValue({ rows: [{ is_on_medicare: true }], rowCount: 1 });
      mockRecordAppealOutcome.mockResolvedValue(true);
      mockApplyOutcomeIncentive.mockResolvedValue(false);

      const res = await POST(
        makeRequest({ appealId: "appeal-123", outcome }) as import("next/server").NextRequest
      );
      expect(res.status).toBe(200);
    }
  });
});

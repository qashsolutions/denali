import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * GET /api/appeals — Unit Tests
 *
 * Stage 2 gate: appeals are Medicare-only.
 * Tests the cohort guard (is_on_medicare check) before any DB access.
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

import { GET } from "../route";

const MOCK_USER = { userId: "user-123", email: "test@example.com" };

function makeRequest(conversationId?: string): Request {
  const url = conversationId
    ? `http://localhost/api/appeals?conversationId=${conversationId}`
    : "http://localhost/api/appeals";
  return new Request(url);
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/appeals — cohort gate", () => {
  it("returns 200 with appeals array when user is Medicare and has a conversation", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("is_on_medicare")) {
        return Promise.resolve({
          rows: [{ is_on_medicare: true }],
          rowCount: 1,
        });
      }
      if (sql.includes("FROM conversations")) {
        return Promise.resolve({
          rows: [{ user_id: MOCK_USER.userId }],
          rowCount: 1,
        });
      }
      if (sql.includes("FROM appeals")) {
        return Promise.resolve({
          rows: [
            {
              id: "appeal-1",
              appeal_letter: "Dear Medicare...",
              denial_reason: "Not medically necessary",
              denial_date: "2026-01-01",
              deadline: null,
              carc_codes: ["50"],
              cpt_codes: ["99213"],
              lcd_refs: ["L35936"],
              ncd_refs: [],
              status: "draft",
              appeal_level: 1,
              created_at: "2026-01-02T00:00:00Z",
            },
          ],
          rowCount: 1,
        });
      }
      return Promise.resolve({ rows: [], rowCount: 0 });
    });

    const res = await GET(makeRequest("conv-abc") as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.appeals)).toBe(true);
    expect(body.appeals).toHaveLength(1);
    expect(body.appeals[0].id).toBe("appeal-1");
  });

  it("returns 403 appeals_require_medicare when is_on_medicare=false", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockResolvedValue({
      rows: [{ is_on_medicare: false }],
      rowCount: 1,
    });

    const res = await GET(makeRequest("conv-abc") as import("next/server").NextRequest);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("appeals_require_medicare");
  });

  it("returns 403 appeals_require_medicare when is_on_medicare=null", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockResolvedValue({
      rows: [{ is_on_medicare: null }],
      rowCount: 1,
    });

    const res = await GET(makeRequest("conv-abc") as import("next/server").NextRequest);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("appeals_require_medicare");
  });

  it("returns 403 appeals_require_medicare when unauthenticated (new gate behavior)", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await GET(makeRequest("conv-abc") as import("next/server").NextRequest);
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe("appeals_require_medicare");
  });

  it("returns empty appeals array when conversationId is missing (no gate check needed)", async () => {
    // No auth or DB query — early return on missing conversationId
    mockGetAuthUser.mockResolvedValue(MOCK_USER);

    const res = await GET(makeRequest() as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.appeals).toEqual([]);
  });

  it("returns empty appeals array when DB errors after gate passes (graceful error)", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("is_on_medicare")) {
        return Promise.resolve({ rows: [{ is_on_medicare: true }], rowCount: 1 });
      }
      // Simulate a DB error on the conversation or appeals query
      return Promise.reject(new Error("connection refused"));
    });

    const res = await GET(makeRequest("conv-abc") as import("next/server").NextRequest);
    // Error is caught → returns { appeals: [] } fallback
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.appeals).toEqual([]);
  });
});

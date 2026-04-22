import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Diabetes Log API Route — Unit Tests
 *
 * Negative tests for validation logic in GET/POST/DELETE /api/diabetes/log.
 * Follows the same mocking pattern as consent/__tests__/route.test.ts.
 */

// Mock Cognito auth
const mockGetAuthUser = vi.fn();
vi.mock("@/lib/auth-server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

// Mock RDS query
const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockReturnValue(Promise.resolve()),
}));

import { NextRequest } from "next/server";
import { GET, POST, DELETE as DELETE_HANDLER } from "../route";

const MOCK_USER = { userId: "user-123", email: "test@example.com" };

function makeRequest(
  method: string,
  body?: unknown,
  params?: string
): NextRequest {
  const url = `http://localhost:3000/api/diabetes/log${params ? `?${params}` : ""}`;
  return new NextRequest(url, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

describe("GET /api/diabetes/log", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without auth", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("Please sign in to continue.");
  });

  it("returns empty entries when user has none", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await GET(makeRequest("GET"));
    expect(res.status).toBe(200);
    expect((await res.json()).entries).toEqual([]);
  });
});

describe("POST /api/diabetes/log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({
      rows: [{ id: "entry-1", logged_at: "2026-03-06T00:00:00Z", entry_type: "glucose" }],
    });
  });

  it("returns 401 without auth", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await POST(makeRequest("POST", { entry_type: "glucose" }));
    expect(res.status).toBe(401);
  });

  it("rejects missing entry_type", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const res = await POST(makeRequest("POST", {}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Please select a valid entry type.");
  });

  it("rejects invalid entry_type", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const res = await POST(makeRequest("POST", { entry_type: "blood_pressure" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Please select a valid entry type.");
  });

  it("rejects empty string entry_type", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const res = await POST(makeRequest("POST", { entry_type: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Please select a valid entry type.");
  });

  it("rejects invalid glucose_context", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const res = await POST(
      makeRequest("POST", { entry_type: "glucose", glucose_context: "random" })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Please select when this reading was taken.");
  });

  it("rejects activity_minutes = 0", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const res = await POST(
      makeRequest("POST", { entry_type: "activity", activity_minutes: 0 })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Activity time must be a positive number.");
  });

  it("rejects negative activity_minutes", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const res = await POST(
      makeRequest("POST", { entry_type: "activity", activity_minutes: -10 })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Activity time must be a positive number.");
  });

  it("rejects activity_minutes as string", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const res = await POST(
      makeRequest("POST", { entry_type: "activity", activity_minutes: "thirty" })
    );
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Activity time must be a positive number.");
  });

  it("accepts valid glucose entry", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const res = await POST(
      makeRequest("POST", {
        entry_type: "glucose",
        glucose_value: 120,
        glucose_context: "fasting",
      })
    );
    expect(res.status).toBe(201);
    expect(mockQuery).toHaveBeenCalledOnce();
  });

  it("accepts valid activity entry", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const res = await POST(
      makeRequest("POST", { entry_type: "activity", activity_minutes: 30 })
    );
    expect(res.status).toBe(201);
  });

  it("accepts valid meal entry", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const res = await POST(
      makeRequest("POST", { entry_type: "meal", note: "Salad and grilled chicken" })
    );
    expect(res.status).toBe(201);
  });

  it("accepts valid note entry", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const res = await POST(
      makeRequest("POST", { entry_type: "note", note: "Felt dizzy after lunch" })
    );
    expect(res.status).toBe(201);
  });

  it("returns 500 when database throws", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockRejectedValueOnce(new Error("DB error"));
    const res = await POST(makeRequest("POST", { entry_type: "glucose" }));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("Something went wrong. Please try again.");
  });
});

describe("DELETE /api/diabetes/log", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 401 without auth", async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await DELETE_HANDLER(makeRequest("DELETE", undefined, "id=entry-1"));
    expect(res.status).toBe(401);
  });

  it("rejects missing id parameter", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    const res = await DELETE_HANDLER(makeRequest("DELETE"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("We couldn't find that entry. Please try again.");
  });

  it("scopes delete to authenticated user", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockResolvedValue({ rows: [] });
    const res = await DELETE_HANDLER(makeRequest("DELETE", undefined, "id=entry-1"));
    expect(res.status).toBe(200);
    // Verify query includes user_id in WHERE clause
    const sql = mockQuery.mock.calls[0][0] as string;
    expect(sql).toContain("user_id = $2");
    const params = mockQuery.mock.calls[0][1] as string[];
    expect(params[0]).toBe("entry-1");
    expect(params[1]).toBe("user-123");
  });
});

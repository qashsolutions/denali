import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Consent API Route — Unit Tests
 *
 * Tests validation logic in GET/PUT /api/consent by mocking
 * the Cognito auth layer and RDS database layer.
 */

// Mock Cognito auth
const mockGetAuthUser = vi.fn();
vi.mock("@/lib/auth-server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
}));

// Mock RDS query — track calls for assertions
const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockReturnValue(Promise.resolve()),
}));

import { NextRequest } from "next/server";
import { GET, PUT, PATCH } from "../route";
import { AUTH, VALIDATION, SYSTEM } from "@/config/messages";

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/consent", {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

const MOCK_USER = { userId: "user-123", email: "test@example.com" };

describe("GET /api/consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: empty prefs
    mockQuery.mockResolvedValue({ rows: [] });
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await GET(makeRequest("GET"));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe(AUTH.SIGN_IN_REQUIRED);
  });

  it("returns all three consent types defaulting to false when no prefs exist", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockResolvedValue({ rows: [] });

    const res = await GET(makeRequest("GET"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.consent).toEqual({
      health_data_ai: false,
      health_data_storage: false,
      analytics: false,
    });
  });
});

describe("PUT /api/consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: successful upsert
    mockQuery.mockResolvedValue({ rows: [] });
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const req = makeRequest("PUT", { consentType: "analytics", granted: true });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe(AUTH.SIGN_IN_REQUIRED);
  });

  it("returns 400 for invalid consent type", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);

    const req = makeRequest("PUT", { consentType: "invalid_type", granted: true });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe(VALIDATION.INVALID_PREFERENCE);
  });

  it("returns 400 when consentType is missing", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);

    const req = makeRequest("PUT", { granted: true });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(VALIDATION.INVALID_PREFERENCE);
  });

  it("returns 400 when consentType is empty string", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);

    const req = makeRequest("PUT", { consentType: "", granted: true });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(VALIDATION.INVALID_PREFERENCE);
  });

  it("returns 400 when granted is not a boolean", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);

    const req = makeRequest("PUT", { consentType: "analytics", granted: "yes" });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe(VALIDATION.INVALID_PREFERENCE);
  });

  it("returns 400 when granted is null", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);

    const req = makeRequest("PUT", { consentType: "analytics", granted: null });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(VALIDATION.INVALID_PREFERENCE);
  });

  it("returns 400 when granted is number 1", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);

    const req = makeRequest("PUT", { consentType: "analytics", granted: 1 });
    const res = await PUT(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(VALIDATION.INVALID_PREFERENCE);
  });

  it("accepts health_data_ai with granted=true and calls query", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);

    const req = makeRequest("PUT", { consentType: "health_data_ai", granted: true });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, consentType: "health_data_ai", granted: true });
    expect(mockQuery).toHaveBeenCalledOnce();

    // Verify correct params passed to query: [userId, consentType, granted, granted_at, null, now]
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params[0]).toBe("user-123");
    expect(params[1]).toBe("health_data_ai");
    expect(params[2]).toBe(true);
    expect(params[3]).toBeTruthy(); // granted_at
    expect(params[4]).toBeNull();   // revoked_at
  });

  it("accepts health_data_storage with granted=false and sets revoked_at", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);

    const req = makeRequest("PUT", { consentType: "health_data_storage", granted: false });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, consentType: "health_data_storage", granted: false });

    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params[2]).toBe(false);
    expect(params[3]).toBeNull();   // granted_at
    expect(params[4]).toBeTruthy(); // revoked_at
  });

  it("accepts analytics consent type", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);

    const req = makeRequest("PUT", { consentType: "analytics", granted: true });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.consentType).toBe("analytics");
  });

  it("returns 500 when query throws", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockQuery.mockRejectedValueOnce(new Error("DB error"));

    const req = makeRequest("PUT", { consentType: "analytics", granted: true });
    const res = await PUT(req);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe(SYSTEM.SAVE_PREFERENCE);
  });
});

describe("PATCH /api/consent (mobile alias for PUT)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  it("is wired (the mobile ApiClient sends PATCH; was HTTP 405 before)", () => {
    expect(typeof PATCH).toBe("function");
  });

  it("upserts identically to PUT — same handler, auth + validation + audit", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);

    const req = makeRequest("PATCH", { consentType: "health_data_ai", granted: true });
    const res = await PATCH(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, consentType: "health_data_ai", granted: true });
    const params = mockQuery.mock.calls[0][1] as unknown[];
    expect(params[1]).toBe("health_data_ai");
    expect(params[2]).toBe(true);
  });

  it("still enforces auth (401 when unauthenticated)", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await PATCH(makeRequest("PATCH", { consentType: "analytics", granted: true }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe(AUTH.SIGN_IN_REQUIRED);
  });

  it("still rejects an invalid consent type (400)", async () => {
    mockGetAuthUser.mockResolvedValue(MOCK_USER);

    const res = await PATCH(makeRequest("PATCH", { consentType: "bogus", granted: true }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe(VALIDATION.INVALID_PREFERENCE);
  });
});

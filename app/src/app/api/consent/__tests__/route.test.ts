import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Consent API Route — Unit Tests
 *
 * Tests validation logic in GET/PUT /api/consent by mocking
 * the Supabase server client and calling route handlers directly.
 */

// Mock Supabase server client
const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockUpsert = vi.fn().mockReturnValue({ error: null });

vi.mock("@/lib/supabase-server", () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: { getUser: () => mockGetUser() },
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return { eq: (...eqArgs: unknown[]) => { mockEq(...eqArgs); return { data: [], error: null }; } };
      },
      upsert: (...args: unknown[]) => mockUpsert(...args),
    }),
  }),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockReturnValue(Promise.resolve()),
}));

import { GET, PUT } from "../route";

function mockRequest(body: unknown): Request {
  return new Request("http://localhost:3000/api/consent", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const MOCK_USER = { id: "user-123", email: "test@example.com" };

describe("GET /api/consent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "No session" } });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Not authenticated");
  });

  it("returns all three consent types defaulting to false when no prefs exist", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });

    const res = await GET();
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
  });

  it("returns 401 when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: { message: "No session" } });

    const req = mockRequest({ consentType: "analytics", granted: true });
    const res = await PUT(req as never);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe("Not authenticated");
  });

  it("returns 400 for invalid consent type", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });

    const req = mockRequest({ consentType: "invalid_type", granted: true });
    const res = await PUT(req as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("Invalid consent type");
  });

  it("returns 400 when granted is not a boolean", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });

    const req = mockRequest({ consentType: "analytics", granted: "yes" });
    const res = await PUT(req as never);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe("granted must be a boolean");
  });

  it("accepts health_data_ai with granted=true and calls upsert", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });

    const req = mockRequest({ consentType: "health_data_ai", granted: true });
    const res = await PUT(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, consentType: "health_data_ai", granted: true });
    expect(mockUpsert).toHaveBeenCalledOnce();

    const upsertArg = mockUpsert.mock.calls[0][0];
    expect(upsertArg.user_id).toBe("user-123");
    expect(upsertArg.consent_type).toBe("health_data_ai");
    expect(upsertArg.granted).toBe(true);
    expect(upsertArg.granted_at).toBeTruthy();
    expect(upsertArg.revoked_at).toBeNull();
  });

  it("accepts health_data_storage with granted=false and sets revoked_at", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });

    const req = mockRequest({ consentType: "health_data_storage", granted: false });
    const res = await PUT(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, consentType: "health_data_storage", granted: false });

    const upsertArg = mockUpsert.mock.calls[0][0];
    expect(upsertArg.granted).toBe(false);
    expect(upsertArg.granted_at).toBeNull();
    expect(upsertArg.revoked_at).toBeTruthy();
  });

  it("accepts analytics consent type", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });

    const req = mockRequest({ consentType: "analytics", granted: true });
    const res = await PUT(req as never);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.consentType).toBe("analytics");
  });

  it("returns 500 when upsert fails", async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER }, error: null });
    mockUpsert.mockReturnValueOnce({ error: { message: "DB error" } });

    const req = mockRequest({ consentType: "analytics", granted: true });
    const res = await PUT(req as never);
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Failed to update consent");
  });
});

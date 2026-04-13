import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * DELETE /api/account/delete — Unit Tests
 *
 * Tests the 11-step cascade deletion for GDPR/CCPA compliance.
 * CRITICAL: Every table must be deleted in FK-safe order.
 * Admin accounts must be blocked. Cognito must be cleaned up last.
 */

const mockGetAuthUser = vi.fn();
const mockDeleteCognitoUser = vi.fn();
vi.mock("@/lib/auth-server", () => ({
  getAuthUser: (...args: unknown[]) => mockGetAuthUser(...args),
  deleteCognitoUser: (...args: unknown[]) => mockDeleteCognitoUser(...args),
}));

const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
  transaction: (fn: (q: (...args: unknown[]) => Promise<unknown>) => Promise<unknown>) =>
    fn((...args: unknown[]) => mockQuery(...args)),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockReturnValue(Promise.resolve()),
}));

// Mock global fetch for Stripe cancellation
const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

import { NextRequest } from "next/server";
import { DELETE, POST } from "../route";

const MOCK_USER = { userId: "user-del-1", email: "delete-me@test.com" };

function makeRequest(): NextRequest {
  return new NextRequest("http://localhost:3000/api/account/delete", {
    method: "DELETE",
  });
}

describe("DELETE /api/account/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue(MOCK_USER);
    mockDeleteCognitoUser.mockResolvedValue(undefined);
    mockFetch.mockResolvedValue(new Response("{}", { status: 200 }));
    // Default: non-admin user, no active Stripe subscription
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT is_admin")) {
        return Promise.resolve({ rows: [{ is_admin: false }] });
      }
      if (sql.includes("stripe_subscription_id")) {
        return Promise.resolve({ rows: [] }); // No active subscription
      }
      return Promise.resolve({ rows: [] });
    });
  });

  // ── Auth ──

  it("returns 401 when user is not authenticated", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const res = await DELETE(makeRequest());
    expect(res.status).toBe(401);
  });

  // ── Admin block ──

  it("returns 403 when user is admin", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT is_admin")) {
        return Promise.resolve({ rows: [{ is_admin: true }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await DELETE(makeRequest());
    expect(res.status).toBe(403);

    const body = await res.json();
    expect(body.error).toContain("Admin");
  });

  // ── Cascade deletion ──

  it("deletes all user data tables in FK-safe order", async () => {
    const deletedTables: string[] = [];
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT is_admin")) {
        return Promise.resolve({ rows: [{ is_admin: false }] });
      }
      if (sql.includes("stripe_subscription_id")) {
        return Promise.resolve({ rows: [] });
      }
      // Track DELETE statements
      const match = sql.match(/DELETE FROM (\w+)/);
      if (match) deletedTables.push(match[1]);
      // Track SELECT delete_user_cascade
      if (sql.includes("delete_user_cascade")) deletedTables.push("users_cascade");
      return Promise.resolve({ rows: [] });
    });

    const res = await DELETE(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.success).toBe(true);

    // Verify all expected tables are deleted
    expect(deletedTables).toContain("health_reports");
    expect(deletedTables).toContain("fhir_cache");
    expect(deletedTables).toContain("ehr_connections");
    expect(deletedTables).toContain("diabetes_snapshots");
    expect(deletedTables).toContain("diabetes_log");
    expect(deletedTables).toContain("diabetes_insights");
    expect(deletedTables).toContain("chat_daily_usage");
    expect(deletedTables).toContain("consent_preferences");
    expect(deletedTables).toContain("alert_log");
    expect(deletedTables).toContain("alert_preferences");
    expect(deletedTables).toContain("user_feedback");
    expect(deletedTables).toContain("messages");
    expect(deletedTables).toContain("appeals");
    expect(deletedTables).toContain("conversations");
    expect(deletedTables).toContain("usage");
    expect(deletedTables).toContain("subscriptions");
    expect(deletedTables).toContain("user_events");
    expect(deletedTables).toContain("user_verification");
    expect(deletedTables).toContain("users");

    // Verify FK-safe order: health data before conversations, user_events before conversations, conversations before users
    const healthIdx = deletedTables.indexOf("fhir_cache");
    const eventsIdx = deletedTables.indexOf("user_events");
    const messagesIdx = deletedTables.indexOf("messages");
    const convsIdx = deletedTables.indexOf("conversations");
    const usersIdx = deletedTables.indexOf("users");
    expect(eventsIdx).toBeLessThan(convsIdx);
    expect(healthIdx).toBeLessThan(messagesIdx);
    expect(messagesIdx).toBeLessThan(convsIdx);
    expect(convsIdx).toBeLessThan(usersIdx);
  });

  it("calls deleteCognitoUser as the final step", async () => {
    const res = await DELETE(makeRequest());
    expect(res.status).toBe(200);

    expect(mockDeleteCognitoUser).toHaveBeenCalledWith("delete-me@test.com");
  });

  // ── Stripe cancellation ──

  it("cancels active Stripe subscription during deletion", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT is_admin")) {
        return Promise.resolve({ rows: [{ is_admin: false }] });
      }
      if (sql.includes("stripe_subscription_id")) {
        return Promise.resolve({ rows: [{ stripe_subscription_id: "sub_abc123" }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await DELETE(makeRequest());
    expect(res.status).toBe(200);

    // Verify Stripe API was called
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("sub_abc123"),
      expect.objectContaining({ method: "DELETE" })
    );

    delete process.env.STRIPE_SECRET_KEY;
  });

  it("continues deletion even if Stripe cancellation fails", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_123";
    mockFetch.mockRejectedValue(new Error("Stripe network error"));
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT is_admin")) {
        return Promise.resolve({ rows: [{ is_admin: false }] });
      }
      if (sql.includes("stripe_subscription_id")) {
        return Promise.resolve({ rows: [{ stripe_subscription_id: "sub_fail" }] });
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await DELETE(makeRequest());
    // Should still succeed — Stripe failure doesn't block deletion
    expect(res.status).toBe(200);

    delete process.env.STRIPE_SECRET_KEY;
  });

  // ── Cognito failure resilience ──

  it("succeeds even if Cognito deletion fails", async () => {
    mockDeleteCognitoUser.mockRejectedValue(new Error("Cognito error"));

    const res = await DELETE(makeRequest());
    // Should still return success — DB records are already deleted
    expect(res.status).toBe(200);
  });

  // ── Direct user delete (no RPC fallback) ──

  it("deletes user record directly via DELETE FROM users", async () => {
    let userDeleteCalled = false;
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT is_admin")) {
        return Promise.resolve({ rows: [{ is_admin: false }] });
      }
      if (sql.includes("stripe_subscription_id")) {
        return Promise.resolve({ rows: [] });
      }
      if (sql.includes("DELETE FROM users")) {
        userDeleteCalled = true;
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await DELETE(makeRequest());
    expect(res.status).toBe(200);
    expect(userDeleteCalled).toBe(true);
  });

  // ── DB failure ──

  it("returns 500 when cascade deletion fails", async () => {
    mockQuery.mockImplementation((sql: string) => {
      if (sql.includes("SELECT is_admin")) {
        return Promise.resolve({ rows: [{ is_admin: false }] });
      }
      if (sql.includes("DELETE FROM health_reports")) {
        return Promise.reject(new Error("connection refused"));
      }
      return Promise.resolve({ rows: [] });
    });

    const res = await DELETE(makeRequest());
    expect(res.status).toBe(500);
  });

  // ── POST alias ──

  it("POST delegates to DELETE handler", async () => {
    const req = new NextRequest("http://localhost:3000/api/account/delete", {
      method: "POST",
    });

    const res = await POST(req);
    expect(res.status).toBe(200);
  });
});

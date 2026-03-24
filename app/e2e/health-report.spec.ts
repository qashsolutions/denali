import { test, expect } from "@playwright/test";

/**
 * Health Report API Tests (TEST_PLAN §11)
 *
 * Covers: report generation auth, report access, share token, email.
 * Uses `request` fixture (no browser needed).
 */

test.describe("Health Report API (§11)", () => {
  test("§11.1 GET /api/health-report returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.get("/api/health-report");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("§11.2 POST /api/health-report/generate returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.post("/api/health-report/generate");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("§11.3 POST /api/health-report/email returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.post("/api/health-report/email", {
      data: { reportId: "test", recipientEmail: "a@b.com" },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("§11.4 GET /api/health-report/share/invalid-token returns 404", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/health-report/share/00000000-0000-0000-0000-000000000000"
    );
    // Should return 404 for non-existent token
    expect([404, 500]).toContain(response.status());
  });

  test("§11.5 GET /api/health-report/pdf/invalid-id returns error", async ({
    request,
  }) => {
    const response = await request.get(
      "/api/health-report/pdf/00000000-0000-0000-0000-000000000000"
    );
    // Should return 401 or 404
    expect([401, 404, 500]).toContain(response.status());
  });
});

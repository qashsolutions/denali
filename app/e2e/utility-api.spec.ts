import { test, expect } from "@playwright/test";

/**
 * Utility API Tests (TEST_PLAN §17)
 *
 * Public endpoints: health check, CMS metadata.
 * Uses `request` fixture (no browser needed).
 */

test.describe("Utility APIs (§17)", () => {
  test("§17.1 GET /api/health returns 200", async ({ request }) => {
    const response = await request.get("/api/health");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
  });

  test("§17.2 GET /api/cms-metadata returns app metadata", async ({
    request,
  }) => {
    const response = await request.get("/api/cms-metadata");
    expect(response.status()).toBe(200);
    const body = await response.json();
    // Should have the main metadata sections
    expect(body).toHaveProperty("app");
    expect(body).toHaveProperty("compliance");
  });

  test("§17.3 GET /api/cms-metadata requires no auth", async ({
    request,
  }) => {
    // Verify it works without any cookies/headers
    const response = await request.get("/api/cms-metadata");
    expect(response.status()).toBe(200);
    // Should NOT have any error field
    const body = await response.json();
    expect(body.error).toBeUndefined();
  });
});

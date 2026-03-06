import { test, expect } from "@playwright/test";

/**
 * Spoofing & Access Control Security Tests
 *
 * Verifies that API routes properly reject unauthenticated requests
 * and don't leak sensitive data to unauthenticated callers.
 */

test.describe("API access control without authentication", () => {
  test("GET /api/conversations returns unauthenticated with empty list", async ({
    request,
  }) => {
    const response = await request.get("/api/conversations");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.authenticated).toBe(false);
    expect(body.conversations).toEqual([]);
  });

  test("GET /api/profile returns unauthenticated with no user data", async ({
    request,
  }) => {
    const response = await request.get("/api/profile");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body.authenticated).toBe(false);

    // Must NOT leak plan, role, admin status, or appeal data
    expect(body.plan).toBeUndefined();
    expect(body.role).toBeUndefined();
    expect(body.is_admin).toBeUndefined();
    expect(body.appeal_count).toBeUndefined();
    expect(body.appeal_credits).toBeUndefined();
  });

  test("GET /api/consent returns 401 without auth", async ({ request }) => {
    const response = await request.get("/api/consent");
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("GET /api/diabetes/log returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.get("/api/diabetes/log");
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("POST /api/diabetes/log returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.post("/api/diabetes/log", {
      data: { entry_type: "glucose", glucose_value: 120 },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("DELETE /api/diabetes/log returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.delete("/api/diabetes/log?id=some-id");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("GET /api/trial returns 401 without auth", async ({ request }) => {
    const response = await request.get("/api/trial");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });
});

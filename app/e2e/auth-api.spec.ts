import { test, expect } from "@playwright/test";

/**
 * Auth API Access Control Tests (TEST_PLAN §2.2 + §2.4)
 *
 * Verifies every auth-required API route properly rejects unauthenticated requests.
 * All tests use the `request` fixture (no browser needed).
 */

test.describe("Auth-required routes return 401 without auth", () => {
  // §2.2.1 — already in spoofing-security.spec.ts as GET /api/trial
  // §2.2.2 — already in spoofing-security.spec.ts as POST /api/trial
  // §2.2.3 — already in spoofing-security.spec.ts as GET /api/consent
  // §2.2.4 — already in consent-toggles.spec.ts as PUT /api/consent
  // §2.2.5-7 — already in spoofing-security.spec.ts as diabetes/log

  test("§2.2.8 GET /api/audit-log returns 200 with authenticated:false", async ({
    request,
  }) => {
    // audit-log is unique — returns 200 with flag instead of 401
    const response = await request.get("/api/audit-log");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.authenticated).toBe(false);
    expect(body.logs).toEqual([]);
  });

  test("§2.2.9 GET /api/fhir/data returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.get("/api/fhir/data");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("§2.2.10 POST /api/fhir/disconnect returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.post("/api/fhir/disconnect");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("§2.2.11 GET /api/health-report returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.get("/api/health-report");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("§2.2.12 POST /api/health-report/generate returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.post("/api/health-report/generate");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("§2.2.13 POST /api/health-report/email returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.post("/api/health-report/email", {
      data: { reportId: "test", recipientEmail: "a@b.com" },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("§2.2.14 GET /api/diabetes/snapshots returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.get("/api/diabetes/snapshots");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("§2.2.15 GET /api/diabetes/insights returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.get("/api/diabetes/insights");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("§2.2.16 POST /api/appeal-outcome returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.post("/api/appeal-outcome", {
      data: { appealId: "test", outcome: "approved" },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Authentication required");
  });

  test("§2.2.17 DELETE /api/account/delete returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.delete("/api/account/delete");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Invalid or expired session");
  });

  test("§2.2.18 GET /api/preferences/topics returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.get("/api/preferences/topics");
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("§2.2.19 PUT /api/preferences/topics returns 401 without auth", async ({
    request,
  }) => {
    const response = await request.put("/api/preferences/topics", {
      data: { topics: ["diabetes"] },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });
});

test.describe("Profile endpoint data leakage (§2.4)", () => {
  test("§2.4.1 GET /api/profile without auth leaks no sensitive data", async ({
    request,
  }) => {
    const response = await request.get("/api/profile");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.authenticated).toBe(false);
    expect(body.plan).toBeUndefined();
    expect(body.role).toBeUndefined();
    expect(body.is_admin).toBeUndefined();
    expect(body.appeal_count).toBeUndefined();
    expect(body.appeal_credits).toBeUndefined();
    expect(body.firstName).toBeUndefined();
  });

  test("§2.4.2 GET /api/conversations without auth returns empty", async ({
    request,
  }) => {
    const response = await request.get("/api/conversations");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.authenticated).toBe(false);
    expect(body.conversations).toEqual([]);
  });
});

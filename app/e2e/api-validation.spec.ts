import { test, expect } from "@playwright/test";

/**
 * API Input Validation Tests (TEST_PLAN §16)
 *
 * Verifies that API routes reject malformed/invalid input correctly.
 * Uses `request` fixture (no browser needed).
 */

// ---------------------------------------------------------------------------
// §16.1 Consent validation
// ---------------------------------------------------------------------------

test.describe("Consent input validation (§16.1)", () => {
  test("§16.1.1 PUT /api/consent with invalid consentType → 401 (auth first)", async ({
    request,
  }) => {
    // Auth check fires before validation, so unauth + bad type → 401
    const response = await request.put("/api/consent", {
      data: { consentType: "nonexistent_toggle", granted: true },
    });
    expect(response.status()).toBe(401);
  });

  test("§16.1.2 PUT /api/consent with non-boolean granted → 401 (auth first)", async ({
    request,
  }) => {
    const response = await request.put("/api/consent", {
      data: { consentType: "analytics", granted: "yes" },
    });
    expect(response.status()).toBe(401);
  });

  test("§16.1.3 PUT /api/consent with missing fields → 401 (auth first)", async ({
    request,
  }) => {
    const response = await request.put("/api/consent", { data: {} });
    expect(response.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// §16.2 Checkout validation (extends payment-trial.spec.ts)
// ---------------------------------------------------------------------------

test.describe("Checkout input validation (§16.2)", () => {
  test("§16.2.1 POST /api/checkout with SQL injection in plan → 400", async ({
    request,
  }) => {
    const response = await request.post("/api/checkout", {
      data: { plan: "'; DROP TABLE users;--" },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid plan type");
  });

  test("§16.2.2 POST /api/checkout with XSS in plan → 400", async ({
    request,
  }) => {
    const response = await request.post("/api/checkout", {
      data: { plan: "<script>alert('xss')</script>" },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid plan type");
  });
});

// ---------------------------------------------------------------------------
// §16.3 Diabetes log validation
// ---------------------------------------------------------------------------

test.describe("Diabetes log input validation (§16.3)", () => {
  test("§16.3.1 POST /api/diabetes/log with invalid entry_type → 401 (auth first)", async ({
    request,
  }) => {
    const response = await request.post("/api/diabetes/log", {
      data: { entry_type: "invalid_type", notes: "test" },
    });
    expect(response.status()).toBe(401);
    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("§16.3.2 POST /api/diabetes/log with missing fields → 401 (auth first)", async ({
    request,
  }) => {
    const response = await request.post("/api/diabetes/log", { data: {} });
    expect(response.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// §16.4 Events validation
// ---------------------------------------------------------------------------

test.describe("Events input validation (§16.4)", () => {
  test("§16.4.1 POST /api/events without auth → 401", async ({
    request,
  }) => {
    const response = await request.post("/api/events", {
      data: { eventType: "nonexistent_event", conversationId: "test" },
    });
    expect(response.status()).toBe(401);
  });

  test("§16.4.2 POST /api/events with empty body without auth → 401", async ({
    request,
  }) => {
    const response = await request.post("/api/events", {
      data: {},
    });
    expect(response.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// §16.5 Feedback validation
// ---------------------------------------------------------------------------

test.describe("Feedback input validation (§16.5)", () => {
  test("§16.5.1 POST /api/feedback without auth → 401", async ({
    request,
  }) => {
    const response = await request.post("/api/feedback", {
      data: { rating: "up" },
    });
    expect(response.status()).toBe(401);
  });

  test("§16.5.2 POST /api/feedback without auth (with data) → 401", async ({
    request,
  }) => {
    const response = await request.post("/api/feedback", {
      data: { messageId: "msg-123" },
    });
    expect(response.status()).toBe(401);
  });

  test("§16.5.3 POST /api/feedback without auth (invalid rating) → 401", async ({
    request,
  }) => {
    const response = await request.post("/api/feedback", {
      data: { messageId: "msg-123", rating: "maybe" },
    });
    expect(response.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// §16.6 Appeal outcome validation
// ---------------------------------------------------------------------------

test.describe("Appeal outcome input validation", () => {
  test("POST /api/appeal-outcome with missing appealId → 401 (auth first)", async ({
    request,
  }) => {
    const response = await request.post("/api/appeal-outcome", {
      data: { outcome: "approved" },
    });
    expect(response.status()).toBe(401);
  });

  test("POST /api/appeal-outcome with invalid outcome → 401 (auth first)", async ({
    request,
  }) => {
    const response = await request.post("/api/appeal-outcome", {
      data: { appealId: "test", outcome: "maybe" },
    });
    expect(response.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// §16.7 Topic preferences validation
// ---------------------------------------------------------------------------

test.describe("Topic preferences input validation", () => {
  test("PUT /api/preferences/topics with invalid topic → 401 (auth first)", async ({
    request,
  }) => {
    const response = await request.put("/api/preferences/topics", {
      data: { topics: ["invalid_topic"] },
    });
    expect(response.status()).toBe(401);
  });

  test("PUT /api/preferences/topics with >2 topics → 401 (auth first)", async ({
    request,
  }) => {
    const response = await request.put("/api/preferences/topics", {
      data: { topics: ["diabetes", "obesity", "medicare-general"] },
    });
    expect(response.status()).toBe(401);
  });

  test("PUT /api/preferences/topics with non-array → 401 (auth first)", async ({
    request,
  }) => {
    const response = await request.put("/api/preferences/topics", {
      data: { topics: "diabetes" },
    });
    expect(response.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// §16.8 Health report email validation
// ---------------------------------------------------------------------------

test.describe("Health report email validation", () => {
  test("POST /api/health-report/email with missing fields → 401 (auth first)", async ({
    request,
  }) => {
    const response = await request.post("/api/health-report/email", {
      data: {},
    });
    expect(response.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// §14 Admin access control
// ---------------------------------------------------------------------------

test.describe("Admin route access control (§14)", () => {
  test("§14.1 GET /api/admin/cms without admin → 403", async ({
    request,
  }) => {
    // No auth at all → should get 403 (requireAdmin helper)
    const response = await request.get("/api/admin/cms");
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });

  test("PATCH /api/admin/cms without admin → 403", async ({ request }) => {
    const response = await request.patch("/api/admin/cms", {
      data: { table: "site_settings", id: "1", data: {} },
    });
    expect(response.status()).toBe(403);
    const body = await response.json();
    expect(body.error).toBe("Forbidden");
  });
});

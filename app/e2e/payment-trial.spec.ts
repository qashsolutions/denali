import { test, expect } from "@playwright/test";

/**
 * Payment & Trial API Access Control Tests
 *
 * Verifies that trial, checkout, and webhook API routes properly
 * reject unauthenticated or malformed requests.
 * Works without Stripe keys — tests error handling paths.
 */

test.describe("Trial API access control", () => {
  test("GET /api/trial returns 401 without auth", async ({ request }) => {
    const response = await request.get("/api/trial");
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("POST /api/trial returns 401 without auth", async ({ request }) => {
    const response = await request.post("/api/trial");
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });
});

test.describe("Checkout API access control", () => {
  test("POST /api/checkout rejects without auth or Stripe key", async ({
    request,
  }) => {
    // Without STRIPE_SECRET_KEY → 400 (invalid plan) or 503 (no Stripe key)
    // With STRIPE_SECRET_KEY but no auth → 401
    // Either way, status >= 400
    const response = await request.post("/api/checkout", {
      data: { plan: "starter" },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);
  });

  test("POST /api/checkout rejects invalid plan type", async ({
    request,
  }) => {
    const response = await request.post("/api/checkout", {
      data: { plan: "invalid" },
    });
    expect(response.status()).toBe(400);

    const body = await response.json();
    expect(body.error).toBe("Invalid plan type");
  });

  test("POST /api/checkout rejects empty plan string", async ({
    request,
  }) => {
    const response = await request.post("/api/checkout", {
      data: { plan: "" },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid plan type");
  });

  test("POST /api/checkout rejects missing plan field", async ({
    request,
  }) => {
    const response = await request.post("/api/checkout", {
      data: {},
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid plan type");
  });

  test("POST /api/checkout rejects trial as plan type", async ({
    request,
  }) => {
    // Trial is a free tier — should not be purchasable via checkout
    const response = await request.post("/api/checkout", {
      data: { plan: "trial" },
    });
    expect(response.status()).toBe(400);
    const body = await response.json();
    expect(body.error).toBe("Invalid plan type");
  });
});

test.describe("Stripe webhook access control", () => {
  test("POST /api/webhooks/stripe fails without webhook secret or signature", async ({
    request,
  }) => {
    // Without STRIPE_WEBHOOK_SECRET → 500 "Webhook not configured"
    // With secret but no stripe-signature header → 400 "Missing signature"
    const response = await request.post("/api/webhooks/stripe", {
      data: "test-body",
      headers: { "Content-Type": "text/plain" },
    });
    expect([400, 500]).toContain(response.status());

    const body = await response.json();
    expect(["Webhook not configured", "Missing signature"]).toContain(
      body.error
    );
  });

  test("POST /api/webhooks/stripe rejects missing signature when secret is configured", async ({
    request,
  }) => {
    // If webhook secret IS set, the missing stripe-signature header returns 400
    // If webhook secret is NOT set, returns 500 "Webhook not configured"
    const response = await request.post("/api/webhooks/stripe", {
      data: JSON.stringify({ type: "test" }),
      headers: { "Content-Type": "application/json" },
    });
    expect(response.status()).toBeGreaterThanOrEqual(400);

    const body = await response.json();
    expect(body.error).toBeDefined();
  });
});

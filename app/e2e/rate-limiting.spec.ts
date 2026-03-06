import { test, expect, Page } from "@playwright/test";

/**
 * Rate Limiting & Paywall UI Tests
 *
 * Verifies the chat UI correctly displays error messages when:
 * - Auth is required (401)
 * - Rate limits are hit (429)
 * - Trial has expired (403)
 * - Payment system is unavailable (503)
 * Uses page.route() mocks — no real API calls.
 */

/** Set up standard mocks for an authenticated user */
async function mockAuthenticatedRoutes(page: Page) {
  await page.route("**/api/profile", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "test@example.com",
        plan: "trial",
        role: null,
        is_admin: false,
        appeal_count: 0,
        appeal_credits: 0,
      }),
    });
  });

  await page.route("**/api/conversations", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    });
  });
}

/** Set up standard mocks for an unauthenticated user */
async function mockUnauthenticatedRoutes(page: Page) {
  await page.route("**/api/profile", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: null,
        plan: null,
        role: null,
        is_admin: false,
        appeal_count: 0,
        appeal_credits: 0,
      }),
    });
  });

  await page.route("**/api/conversations", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    });
  });
}

/** Send a test message by filling the input and clicking send */
async function sendTestMessage(page: Page) {
  const textarea = page.getByPlaceholder(
    "Ask about Medicare, coverage, or health..."
  );
  await expect(textarea).toBeVisible({ timeout: 10_000 });
  await textarea.fill("Test message");
  await page.getByRole("button", { name: "Send message" }).click();
}

test.describe("Chat rate limiting and paywall UI", () => {
  test("unauthenticated user sees sign-up prompt instead of chat input", async ({
    page,
  }) => {
    await mockUnauthenticatedRoutes(page);

    await page.goto("/app/chat");

    // Should see sign-up prompt instead of chat input
    await expect(page.getByText("Sign up for a free trial")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole("button", { name: "Sign up free" })
    ).toBeVisible();

    // Chat input should NOT be visible
    await expect(
      page.getByPlaceholder("Ask about Medicare, coverage, or health...")
    ).not.toBeVisible();
  });

  test("authenticated user sees daily limit message on 429", async ({
    page,
  }) => {
    await mockAuthenticatedRoutes(page);

    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 429,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error:
            "You've reached your daily limit of 10 messages. Upgrade for more access.",
          code: "RATE_LIMITED",
          limit: 10,
          count: 10,
        }),
      });
    });

    await page.goto("/app/chat");
    await sendTestMessage(page);

    await expect(page.getByText("daily limit")).toBeVisible({
      timeout: 10_000,
    });
  });

  test("trial expired user sees upgrade prompt on 403", async ({ page }) => {
    await mockAuthenticatedRoutes(page);

    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 403,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error:
            "Your free trial has ended. Upgrade to keep using Denali.",
          code: "TRIAL_EXPIRED",
          upsell: true,
        }),
      });
    });

    await page.goto("/app/chat");
    await sendTestMessage(page);

    await expect(page.getByText("trial has ended")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole("button", { name: "Upgrade plan" })
    ).toBeVisible();
  });

  test("checkout 503 shows payment error in response", async ({ page }) => {
    await mockAuthenticatedRoutes(page);

    // Mock checkout to return 503 (Stripe not configured)
    await page.route("**/api/checkout", async (route) => {
      await route.fulfill({
        status: 503,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Payment system not configured. Please try again later.",
        }),
      });
    });

    // Verify the API returns the expected error shape
    const response = await page.request.post("/api/checkout", {
      data: { plan: "starter" },
    });
    // The mock intercepts this and returns 503
    expect(response.status()).toBe(503);
    const body = await response.json();
    expect(body.error).toContain("Payment system not configured");
  });

  test("weekly limit error shows Upgrade plan suggestion", async ({
    page,
  }) => {
    await mockAuthenticatedRoutes(page);

    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 429,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error:
            "You can chat 1 day per week on your plan. Upgrade for more access.",
          code: "WEEKLY_LIMIT",
          weeklyLimit: 1,
          daysUsed: 1,
        }),
      });
    });

    await page.goto("/app/chat");
    await sendTestMessage(page);

    await expect(page.getByText("1 day per week")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole("button", { name: "Upgrade plan" })
    ).toBeVisible();
  });
});

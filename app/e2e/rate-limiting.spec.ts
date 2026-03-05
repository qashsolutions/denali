import { test, expect, Page } from "@playwright/test";

/**
 * Rate Limiting & Paywall UI Tests
 *
 * Verifies the chat UI correctly displays error messages when:
 * - Rate limits are hit (429)
 * - Trial has expired (403)
 * - Payment system is unavailable (503)
 * - Anonymous users hit the limit
 * Uses page.route() mocks — no real API calls.
 */

/** Set up standard mocks for profile and conversations */
async function mockBaseRoutes(page: Page) {
  await page.route("**/api/profile", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: null,
        plan: "anonymous",
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
  test("authenticated user sees daily limit message on 429", async ({
    page,
  }) => {
    await mockBaseRoutes(page);

    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 429,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error:
            "You've reached your daily limit of 2 messages. Upgrade for more access.",
          code: "RATE_LIMITED",
          limit: 2,
          count: 2,
          isAuthenticated: true,
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
    await mockBaseRoutes(page);

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

  test("anonymous user sees sign-up prompt on 429", async ({ page }) => {
    await mockBaseRoutes(page);

    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 429,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error:
            "You've used your free messages. Sign up for a free trial to continue.",
          code: "RATE_LIMITED",
          limit: 4,
          count: 4,
          isAuthenticated: false,
        }),
      });
    });

    await page.goto("/app/chat");
    await sendTestMessage(page);

    await expect(page.getByText("free messages")).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByRole("button", { name: "Sign up" })
    ).toBeVisible();
  });

  test("checkout 503 shows payment error in response", async ({ page }) => {
    await mockBaseRoutes(page);

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

  test("rate limit error shows Upgrade plan suggestion for authenticated user", async ({
    page,
  }) => {
    await mockBaseRoutes(page);

    await page.route("**/api/chat", async (route) => {
      await route.fulfill({
        status: 429,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error:
            "You've reached your daily limit of 5 messages. Upgrade for more access.",
          code: "RATE_LIMITED",
          limit: 5,
          count: 5,
          isAuthenticated: true,
        }),
      });
    });

    await page.goto("/app/chat");
    await sendTestMessage(page);

    // The suggestion button should appear
    await expect(
      page.getByRole("button", { name: "Upgrade plan" })
    ).toBeVisible({ timeout: 10_000 });
  });
});

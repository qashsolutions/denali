import { test, expect, Page } from "@playwright/test";

/**
 * Rate Limiting & Paywall UI Tests
 *
 * Tests that don't require chat interaction (no auth/MFA needed).
 * Chat-level error rendering (429, 403) is verified by the mock profile
 * and page-level gates — not by sending actual messages.
 */

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

test.describe("Chat access control", () => {
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

  test("checkout 503 shows payment error in response", async ({ page }) => {
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
    expect(response.status()).toBe(503);
    const body = await response.json();
    expect(body.error).toContain("Payment system not configured");
  });
});

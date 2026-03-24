import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockChatSSE,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  mockAuditLog,
  mockTopicPreferences,
} from "./helpers";

/**
 * Payment Flow Tests (pendingtests.md #4, #16, #17)
 *
 * Covers: PaywallModal plan selection, checkout POST body, processing state,
 * settings upgrade button.
 */

async function setupChatPage(page: import("@playwright/test").Page) {
  await mockAuthenticatedUser(page, { plan: "trial" });
  await mockChatSSE(page, "Here is your answer.");
  await mockFHIRData(page, false);
  await mockConsent(page);
  await mockDiabetesSnapshots(page);
  // Mock health report
  await page.route("**/api/health-report", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report: null }),
    })
  );
}

test.describe("PaywallModal — Plan Selection & Checkout (#4)", () => {
  test("typing 'upgrade' opens PaywallModal with 3 plans", async ({
    page,
  }) => {
    await setupChatPage(page);
    await page.goto("/app/chat");

    // Wait for chat page to load
    await expect(
      page.getByText(/Check Coverage|Ask Denali/i).first()
    ).toBeVisible({ timeout: 10_000 });

    // Type "upgrade" to trigger paywall
    const input = page.getByPlaceholder(/Ask about|Type a message/i);
    await input.fill("upgrade");
    await input.press("Enter");

    // PaywallModal should open with "Choose Your Plan"
    await expect(page.getByText("Choose Your Plan")).toBeVisible({
      timeout: 5_000,
    });

    // All 3 plans should be visible
    await expect(page.getByText("Starter").first()).toBeVisible();
    await expect(page.getByText("Plus").first()).toBeVisible();
    await expect(page.getByText("Unlimited").first()).toBeVisible();
  });

  test("selecting Starter plan posts correct plan to /api/checkout", async ({
    page,
  }) => {
    await setupChatPage(page);

    let checkoutBody: Record<string, unknown> | null = null;
    await page.route("**/api/checkout", (route) => {
      checkoutBody = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: "https://checkout.stripe.com/test" }),
      });
    });

    await page.goto("/app/chat");
    await expect(
      page.getByText(/Check Coverage|Ask Denali/i).first()
    ).toBeVisible({ timeout: 10_000 });

    // Open paywall
    const input = page.getByPlaceholder(/Ask about|Type a message/i);
    await input.fill("upgrade");
    await input.press("Enter");
    await expect(page.getByText("Choose Your Plan")).toBeVisible({
      timeout: 5_000,
    });

    // Default is Plus — click Starter to select it
    const starterCard = page
      .locator("button")
      .filter({ hasText: "Starter" })
      .filter({ hasText: "1 appeal credit" });
    await starterCard.click();

    // Click subscribe — button text should contain "Starter"
    const subscribeBtn = page.getByRole("button", {
      name: /Subscribe to Starter/i,
    });
    await expect(subscribeBtn).toBeVisible();
    await subscribeBtn.click();

    // Verify POST body
    await page.waitForTimeout(500);
    expect(checkoutBody).toBeTruthy();
    expect(checkoutBody!.plan).toBe("starter");
  });

  test("checkout error shows error message in modal", async ({ page }) => {
    await setupChatPage(page);

    await page.route("**/api/checkout", (route) =>
      route.fulfill({
        status: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error: "Payment system not configured",
        }),
      })
    );

    await page.goto("/app/chat");
    await expect(
      page.getByText(/Check Coverage|Ask Denali/i).first()
    ).toBeVisible({ timeout: 10_000 });

    // Open paywall and subscribe
    const input = page.getByPlaceholder(/Ask about|Type a message/i);
    await input.fill("upgrade");
    await input.press("Enter");
    await expect(page.getByText("Choose Your Plan")).toBeVisible({
      timeout: 5_000,
    });

    // Click subscribe (default Plus plan)
    await page
      .getByRole("button", { name: /Subscribe to Plus/i })
      .click();

    // Error should appear
    await expect(
      page.getByText("Payment system not configured")
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("PaywallModal — Processing State (#16)", () => {
  test("subscribe button shows 'Processing...' while checkout is pending", async ({
    page,
  }) => {
    await setupChatPage(page);

    // Delayed checkout response — never resolves during test
    await page.route("**/api/checkout", (route) => {
      // Don't fulfill — leave hanging to observe processing state
      // We'll check the button state before it completes
    });

    await page.goto("/app/chat");
    await expect(
      page.getByText(/Check Coverage|Ask Denali/i).first()
    ).toBeVisible({ timeout: 10_000 });

    // Open paywall
    const input = page.getByPlaceholder(/Ask about|Type a message/i);
    await input.fill("upgrade");
    await input.press("Enter");
    await expect(page.getByText("Choose Your Plan")).toBeVisible({
      timeout: 5_000,
    });

    // Click subscribe (default Plus plan)
    const subscribeBtn = page.getByRole("button", {
      name: /Subscribe to Plus/i,
    });
    await subscribeBtn.click();

    // Button should show "Processing..." and be disabled
    await expect(page.getByText("Processing...")).toBeVisible({
      timeout: 3_000,
    });
  });
});

test.describe("Settings — Upgrade Opens PaywallModal (#17)", () => {
  test("trial user clicking Upgrade in Settings opens PaywallModal inline", async ({
    page,
  }) => {
    await mockAuthenticatedUser(page, { plan: "trial" });
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);
    await mockAuditLog(page);
    await mockTopicPreferences(page);

    await page.goto("/app/settings");

    // Wait for settings to load
    await expect(page.getByText("Subscription")).toBeVisible({
      timeout: 10_000,
    });

    // Should show "Free Trial" plan label
    await expect(page.getByText("Free Trial")).toBeVisible();

    // Click Upgrade button (exact match to avoid matching "Upgrade to Plus" button)
    const upgradeBtn = page.getByRole("button", { name: "Upgrade", exact: true });
    await expect(upgradeBtn).toBeVisible();
    await upgradeBtn.click();

    // PaywallModal should open on the settings page (no navigation)
    await expect(page.getByText("Choose Your Plan")).toBeVisible({
      timeout: 5_000,
    });

    // Should still be on settings page
    expect(page.url()).toContain("/app/settings");
  });
});

import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  mockChatSSE,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  buildSSEResponse,
} from "./helpers";

/**
 * Chat Interaction Tests (pendingtests.md #7, #8, #18, #20)
 *
 * Covers: "Sign up free" button navigation, "Upgrade plan" suggestion chip,
 * payment cancelled toast, consent banner navigation.
 */

test.describe("Chat — Sign Up Free Button (#7)", () => {
  test("unauth 'Sign up free' button navigates to /app/settings", async ({
    page,
  }) => {
    await mockUnauthenticatedUser(page);
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);
    await page.route("**/api/health-report", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: null }),
      })
    );

    await page.goto("/app/chat");

    // Wait for the sign-up button to appear
    const signUpBtn = page.getByRole("button", { name: "Sign up free" });
    await expect(signUpBtn).toBeVisible({ timeout: 10_000 });

    // Click it
    await signUpBtn.click();

    // Should navigate to settings
    await page.waitForURL("**/app/settings**", { timeout: 5_000 });
    expect(page.url()).toContain("/app/settings");
  });
});

test.describe("Chat — Upgrade Suggestion Chip (#8)", () => {
  test("'Upgrade plan' suggestion chip opens PaywallModal", async ({
    page,
  }) => {
    await mockAuthenticatedUser(page, { plan: "trial" });
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);
    await page.route("**/api/health-report", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: null }),
      })
    );

    // Return response with "Upgrade plan" suggestion
    await page.route("**/api/chat", (route) =>
      route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body: buildSSEResponse(
          "You've reached your daily limit. Consider upgrading your plan.",
          { suggestions: ["Upgrade plan", "Check Coverage"] }
        ),
      })
    );

    await page.goto("/app/chat");

    // Send a message to get the response with suggestions
    const input = page.getByPlaceholder(/Ask about|Type a message/i);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("hello");
    await input.press("Enter");

    // Wait for the response
    await expect(
      page.getByText("You've reached your daily limit").first()
    ).toBeVisible({ timeout: 10_000 });

    // "Upgrade plan" suggestion chip should be visible
    const upgradeChip = page.getByRole("button", { name: "Upgrade plan" });
    await expect(upgradeChip).toBeVisible({ timeout: 5_000 });

    // Click the chip
    await upgradeChip.click();

    // PaywallModal should open (not send a chat message)
    await expect(page.getByText("Choose Your Plan")).toBeVisible({
      timeout: 5_000,
    });
  });
});

test.describe("Chat — Payment Cancelled Toast (#18)", () => {
  test("?payment=cancelled shows toast and cleans URL", async ({ page }) => {
    await mockAuthenticatedUser(page, { plan: "trial" });
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);
    await page.route("**/api/health-report", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: null }),
      })
    );

    await page.goto("/app/chat?payment=cancelled");

    // Toast should appear
    await expect(page.getByText("Payment was cancelled.")).toBeVisible({
      timeout: 10_000,
    });

    // URL should be cleaned (router.replace removes the param)
    await page.waitForURL((url) => !url.search.includes("payment=cancelled"), {
      timeout: 5_000,
    });
  });
});

test.describe("Chat — Consent Banner Navigate (#20)", () => {
  test("'Enable in Settings' link navigates to /app/settings", async ({
    page,
  }) => {
    await mockAuthenticatedUser(page, { plan: "trial" });
    // Connected FHIR but consent health_data_ai OFF
    await mockFHIRData(page, true);
    await mockConsent(page, { health_data_ai: false });
    await mockDiabetesSnapshots(page);
    await page.route("**/api/health-report", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: null }),
      })
    );

    await page.goto("/app/chat");

    // Consent banner should be visible
    await expect(
      page.getByText("Your Medicare data is connected but not shared with AI.")
    ).toBeVisible({ timeout: 10_000 });

    // Click "Enable in Settings"
    const enableLink = page.getByText("Enable in Settings");
    await expect(enableLink).toBeVisible();
    await enableLink.click();

    // Should navigate to settings
    await page.waitForURL("**/app/settings**", { timeout: 5_000 });
    expect(page.url()).toContain("/app/settings");
  });
});

import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockChatError,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
} from "./helpers";

/**
 * Trial & Rate Limit Enforcement Tests (pendingtests.md #27, #28)
 *
 * Covers: trial expired 403, weekly rate limit 429.
 */

async function setupChatPage(
  page: import("@playwright/test").Page,
  authOverrides: Parameters<typeof mockAuthenticatedUser>[1] = {}
) {
  await mockAuthenticatedUser(page, { plan: "trial", ...authOverrides });
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
}

test.describe("Trial Expired — 403 Lock (#27)", () => {
  test("expired trial user gets lock message with upgrade CTA", async ({
    page,
  }) => {
    await setupChatPage(page, { trialStatus: "expired" });
    await mockChatError(
      page,
      403,
      "Your free trial has ended. Upgrade to keep using Denali.",
      "TRIAL_EXPIRED"
    );

    await page.goto("/app/chat");

    const input = page.getByPlaceholder(/Ask about|Type a message/i);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("hello");
    await input.press("Enter");

    // Lock message should appear
    await expect(
      page.getByText("Your free trial has ended").first()
    ).toBeVisible({ timeout: 10_000 });

    // Upgrade suggestion button
    await expect(
      page.getByRole("button", { name: "Upgrade plan" })
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Weekly Rate Limit — 429 (#28)", () => {
  test("weekly limit returns rate limit message with upgrade CTA", async ({
    page,
  }) => {
    await setupChatPage(page);

    // Custom mock for WEEKLY_LIMIT (needs extra fields)
    await page.route("**/api/chat", (route) =>
      route.fulfill({
        status: 429,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          error:
            "You can chat 1 day per week on your plan. Upgrade for more access.",
          code: "WEEKLY_LIMIT",
          weeklyLimit: 1,
          daysUsed: 1,
        }),
      })
    );

    await page.goto("/app/chat");

    const input = page.getByPlaceholder(/Ask about|Type a message/i);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("hello");
    await input.press("Enter");

    // Weekly limit message
    await expect(
      page.getByText(/can chat 1 day.* per week/i).first()
    ).toBeVisible({ timeout: 10_000 });

    // Upgrade suggestion button
    await expect(
      page.getByRole("button", { name: "Upgrade plan" })
    ).toBeVisible({ timeout: 5_000 });
  });
});

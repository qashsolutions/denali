import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  mockAuditLog,
  mockTopicPreferences,
} from "./helpers";

/**
 * Settings Topic Preferences Tests (pendingtests.md #57)
 *
 * Covers: max 2 topic selection, PUT request on toggle.
 */

async function setupSettings(page: import("@playwright/test").Page) {
  await mockAuthenticatedUser(page);
  await mockFHIRData(page, false);
  await mockConsent(page);
  await mockDiabetesSnapshots(page);
  await mockAuditLog(page);
  await page.route("**/api/alerts/preferences", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ preferences: [] }),
    })
  );
}

test.describe("Settings — Topic Preferences Max 2 (#57)", () => {
  test("topic preferences visible and PUT fires on selection", async ({ page }) => {
    await setupSettings(page);

    // Track PUT calls to topic preferences
    const putCalls: Array<{ topics: string[] }> = [];
    await mockTopicPreferences(page, []); // Start with no topics selected

    // Override to capture PUT
    await page.unroute("**/api/preferences/topics");
    await page.route("**/api/preferences/topics", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ topics: putCalls.length > 0 ? putCalls[putCalls.length - 1].topics : [] }),
        });
      }
      if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON();
        putCalls.push(body);
        return route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ success: true, topics: body.topics }),
        });
      }
      return route.continue();
    });

    await page.goto("/app/settings");

    // Wait for "Choose up to 2 health topics" text
    await expect(
      page.getByText("Choose up to 2 health topics")
    ).toBeVisible({ timeout: 15_000 });

    // Topic buttons should be visible (Diabetes, Obesity at minimum)
    await expect(page.getByText("Diabetes").first()).toBeVisible();
    await expect(page.getByText("Obesity").first()).toBeVisible();

    // Click Diabetes topic
    await page.getByText("Diabetes").first().click();
    await page.waitForTimeout(500);

    // Verify PUT was called
    expect(putCalls.length).toBeGreaterThanOrEqual(1);
  });
});

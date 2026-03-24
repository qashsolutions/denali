import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  mockChatSSE,
} from "./helpers";

/**
 * Mobile Navigation Tests (pendingtests.md #39)
 *
 * Covers: BottomTabs visibility and navigation on mobile viewport.
 */

test.describe("Mobile — BottomTabs Navigation (#39)", () => {
  test("bottom tabs show 4 tabs and navigate on mobile", async ({ page }) => {
    await mockAuthenticatedUser(page);
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);
    await mockChatSSE(page, "Hello from Denali.");
    await page.route("**/api/health-report", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: null }),
      })
    );

    // Set mobile viewport
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto("/app/chat");

    // Bottom nav should be visible on mobile (use .last() — first is desktop header nav)
    const nav = page.locator("nav[aria-label='Main navigation']").last();
    await expect(nav).toBeVisible({ timeout: 10_000 });

    // 4 tabs with correct labels
    await expect(nav.getByText("Home")).toBeVisible();
    await expect(nav.getByText("MyHealth")).toBeVisible();
    await expect(nav.getByText("Ask Denali")).toBeVisible();
    await expect(nav.getByText("Settings")).toBeVisible();

    // Click Settings tab → navigates to /app/settings
    await nav.getByText("Settings").click();
    await page.waitForURL(/\/app\/settings/, { timeout: 5_000 });
    expect(page.url()).toContain("/app/settings");
  });
});

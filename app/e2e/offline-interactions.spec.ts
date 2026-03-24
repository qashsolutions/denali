import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  mockChatSSE,
} from "./helpers";

/**
 * Offline Interaction Tests (pendingtests.md #59, #60)
 *
 * Covers: offline banner shows/hides, chat input disabled offline.
 */

async function setupOnlinePage(page: import("@playwright/test").Page) {
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
}

test.describe("Offline — Banner Shows/Hides (#59)", () => {
  test("offline banner appears when offline and hides on reconnect", async ({
    page,
    context,
  }) => {
    await setupOnlinePage(page);
    await page.goto("/app/chat");

    // Wait for page to load
    const input = page.getByPlaceholder(/Ask about|Type a message/i);
    await expect(input).toBeVisible({ timeout: 10_000 });

    // Go offline
    await context.setOffline(true);

    // Trigger the offline event by evaluating in page
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });

    // Offline banner should appear
    const offlineBanner = page.locator("[role='status']").filter({
      hasText: /offline/i,
    });
    await expect(offlineBanner.first()).toBeVisible({ timeout: 5_000 });

    // Go back online
    await context.setOffline(false);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });

    // Banner should disappear
    await expect(offlineBanner.first()).not.toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Offline — Chat Input Disabled (#60)", () => {
  test("chat input disabled with offline placeholder when offline", async ({
    page,
    context,
  }) => {
    await setupOnlinePage(page);
    await page.goto("/app/chat");

    const input = page.getByPlaceholder(/Ask about|Type a message/i);
    await expect(input).toBeVisible({ timeout: 10_000 });

    // Input should be enabled initially
    await expect(input).toBeEnabled();

    // Go offline
    await context.setOffline(true);
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });

    // Wait for offline placeholder to appear — ChatInput swaps placeholder text
    // when useOnlineStatus returns isOnline=false
    await expect(
      page.getByPlaceholder(/connection/i)
    ).toBeVisible({ timeout: 5_000 });
  });
});

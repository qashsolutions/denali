import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  mockChatSSE,
} from "./helpers";

/**
 * Consent Enforcement Tests (pendingtests.md #44, #45)
 *
 * Covers: health_data_ai OFF strips health data, grey banner visible.
 */

async function setupConsentOff(page: import("@playwright/test").Page) {
  await mockAuthenticatedUser(page);
  await mockFHIRData(page, true); // Connected to Blue Button
  await mockConsent(page, { health_data_ai: false }); // AI consent OFF
  await mockDiabetesSnapshots(page);
  await page.route("**/api/health-report", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report: null }),
    })
  );
}

test.describe("Consent — health_data_ai OFF Strips Health (#44)", () => {
  test("chat POST has healthDataAvailable=false when consent OFF", async ({ page }) => {
    await setupConsentOff(page);

    // Intercept chat POST to inspect the body
    let chatRequestBody: string | null = null;
    await page.route("**/api/chat", (route) => {
      chatRequestBody = route.request().postData();
      return route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body: [
          `event: delta\ndata: ${JSON.stringify({ text: "Hello!" })}\n\n`,
          `event: done\ndata: ${JSON.stringify({
            content: "Hello!",
            conversationId: "test-consent",
            suggestions: [],
            sessionState: {},
            toolsUsed: [],
          })}\n\n`,
        ].join(""),
      });
    });

    await page.goto("/app/chat");

    const input = page.getByPlaceholder(/Ask about|Type a message/i);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("Tell me about my diabetes");
    await input.press("Enter");

    // Wait for response
    await expect(page.getByText("Hello!")).toBeVisible({ timeout: 10_000 });

    // Inspect the intercepted request body
    expect(chatRequestBody).not.toBeNull();
    const parsed = JSON.parse(chatRequestBody!);
    // sessionState should have healthDataAvailable=false
    expect(parsed.sessionState?.healthDataAvailable).toBe(false);
  });
});

test.describe("Consent — Grey Banner When AI OFF (#45)", () => {
  test("shows grey banner with 'Enable in Settings' when consent OFF", async ({ page }) => {
    await setupConsentOff(page);
    await mockChatSSE(page, "I can help with that.");

    await page.goto("/app/chat");

    // Grey consent banner should be visible
    await expect(
      page.getByText("Your Medicare data is connected but not shared with AI")
    ).toBeVisible({ timeout: 10_000 });

    // "Enable in Settings" link should be present
    await expect(page.getByText("Enable in Settings")).toBeVisible();
  });
});

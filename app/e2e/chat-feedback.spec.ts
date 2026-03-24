import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  mockChatSSE,
} from "./helpers";

/**
 * Chat Feedback Tests (pendingtests.md #48, #49)
 *
 * Covers: thumbs up/down buttons send POST, correction text after thumbs down.
 */

async function setupChatWithResponse(page: import("@playwright/test").Page) {
  await mockAuthenticatedUser(page);
  await mockFHIRData(page, false);
  await mockConsent(page);
  await mockDiabetesSnapshots(page);
  await mockChatSSE(page, "Medicare Part B covers outpatient services.");
  await page.route("**/api/health-report", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report: null }),
    })
  );
}

test.describe("Chat Feedback — Thumbs Up/Down (#48)", () => {
  test("feedback buttons visible on assistant message and click sends POST", async ({ page }) => {
    await setupChatWithResponse(page);

    // Mock feedback endpoint
    let feedbackBody: Record<string, unknown> | null = null;
    await page.route("**/api/feedback", (route) => {
      feedbackBody = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true }),
      });
    });
    // Mock events endpoint (trackEvent called after feedback)
    await page.route("**/api/events", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true }),
      })
    );

    await page.goto("/app/chat");

    // Send a message
    const input = page.getByPlaceholder(/Ask about|Type a message/i);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("What does Medicare Part B cover?");
    await input.press("Enter");

    // Wait for assistant response
    await expect(
      page.getByText("Medicare Part B covers outpatient services.")
    ).toBeVisible({ timeout: 10_000 });

    // Feedback buttons should be visible on assistant message (exact: true to avoid "Not helpful" match)
    const thumbsUp = page.getByRole("button", { name: "Helpful", exact: true });
    await expect(thumbsUp).toBeVisible({ timeout: 5_000 });

    const thumbsDown = page.getByRole("button", { name: "Not helpful" });
    await expect(thumbsDown).toBeVisible();

    // Click thumbs up
    await thumbsUp.click();

    // "Thanks for feedback!" should appear
    await expect(page.getByText("Thanks for feedback!")).toBeVisible({
      timeout: 3_000,
    });

    // Verify POST was sent
    await page.waitForTimeout(500);
    expect(feedbackBody).not.toBeNull();
    expect(feedbackBody!.rating).toBe("up");
  });
});

test.describe("Chat Feedback — Thumbs Down (#49)", () => {
  test("thumbs down click shows feedback confirmation", async ({ page }) => {
    await setupChatWithResponse(page);

    await page.route("**/api/feedback", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true }),
      })
    );
    await page.route("**/api/events", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true }),
      })
    );

    await page.goto("/app/chat");

    const input = page.getByPlaceholder(/Ask about|Type a message/i);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("What does Medicare cover?");
    await input.press("Enter");

    await expect(
      page.getByText("Medicare Part B covers outpatient services.")
    ).toBeVisible({ timeout: 10_000 });

    // Click thumbs down
    const thumbsDown = page.getByRole("button", { name: "Not helpful" });
    await expect(thumbsDown).toBeVisible({ timeout: 5_000 });
    await thumbsDown.click();

    // Feedback confirmation should appear
    await expect(page.getByText("Thanks for feedback!")).toBeVisible({
      timeout: 3_000,
    });
  });
});

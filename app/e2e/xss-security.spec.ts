import { test, expect } from "@playwright/test";

/**
 * XSS Security Tests
 *
 * Chat-level XSS escaping is now tested via unit tests (markdown.test.ts).
 * This E2E test verifies that URL parameter payloads don't execute as code
 * on the chat page — no auth required since we check the page HTML directly.
 */

test.describe("XSS: URL parameter safety", () => {
  test("script payload in ?message= param renders as text, not code", async ({
    page,
  }) => {
    // Set XSS detection flag before navigation
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).xssTriggered = false;
    });

    // Navigate to chat with XSS payload in URL param
    await page.goto(
      "/app/chat?message=%3Cscript%3Ewindow.xssTriggered%3Dtrue%3C%2Fscript%3E"
    );

    // Wait for page to fully render
    await page.waitForLoadState("networkidle");

    // Assert XSS did not execute
    const triggered = await page.evaluate(
      () => (window as unknown as Record<string, unknown>).xssTriggered
    );
    expect(triggered).toBe(false);
  });
});

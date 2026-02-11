import { test, expect, type Page } from "@playwright/test";

/**
 * XSS Security Tests
 *
 * Verifies that XSS payloads injected into assistant chat responses
 * (via mocked /api/chat SSE) are properly escaped and rendered as
 * visible text rather than executed as code.
 *
 * Detection: Each test sets window.xssTriggered = false before sending,
 * then asserts it's still false after the response renders.
 */

/** Build a minimal SSE response with the given content */
function buildXSSResponse(content: string): string {
  const lines: string[] = [];
  lines.push("event: delta");
  lines.push(`data: ${JSON.stringify({ text: content })}`);
  lines.push("");
  lines.push("event: done");
  lines.push(
    `data: ${JSON.stringify({
      content,
      suggestions: [],
      conversationId: "test-xss-001",
      sessionState: {},
      toolsUsed: [],
    })}`
  );
  lines.push("");
  // Trailing newline ensures the last event gets flushed by SSE parser
  lines.push("");
  return lines.join("\n");
}

/** Common mock setup for all XSS tests */
async function setupMocks(page: Page, xssContent: string) {
  await page.route("**/api/chat", async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
      body: buildXSSResponse(xssContent),
    });
  });

  await page.route("**/api/profile", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: null,
        plan: "anonymous",
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

/** Send a chat message and wait for the assistant response */
async function sendAndWaitForResponse(page: Page) {
  await page.goto("/app/chat");
  const textarea = page.getByPlaceholder(
    "Ask about Medicare, coverage, or health..."
  );
  await expect(textarea).toBeVisible({ timeout: 10_000 });

  // Set XSS detection flag
  await page.evaluate(() => {
    (window as unknown as Record<string, unknown>).xssTriggered = false;
  });

  await textarea.fill("test message");
  await page.getByRole("button", { name: "Send message" }).click();
}

/** Assert XSS did not execute */
async function assertNoXSS(page: Page) {
  const triggered = await page.evaluate(
    () => (window as unknown as Record<string, unknown>).xssTriggered
  );
  expect(triggered).toBe(false);
}

// ─────────────────────────────────────────────────────────────────────────────
// Paragraph Escaping (tests the existing defense at parseMarkdown lines 51-54)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("XSS: paragraph content escaping", () => {
  test("script tag in paragraph is escaped", async ({ page }) => {
    const payload =
      'Safe text <script>window.xssTriggered=true</script> more text';
    await setupMocks(page, payload);
    await sendAndWaitForResponse(page);

    // Wait for content to render
    await expect(page.getByText("Safe text")).toBeVisible({ timeout: 10_000 });
    await assertNoXSS(page);
  });

  test("img onerror in paragraph is escaped", async ({ page }) => {
    const payload =
      'Check this <img src=x onerror="window.xssTriggered=true"> image';
    await setupMocks(page, payload);
    await sendAndWaitForResponse(page);

    await expect(page.getByText("Check this")).toBeVisible({ timeout: 10_000 });
    await assertNoXSS(page);
  });

  test("event handler attribute in paragraph is escaped", async ({ page }) => {
    const payload =
      'Hover <div onmouseover="window.xssTriggered=true">here</div> please';
    await setupMocks(page, payload);
    await sendAndWaitForResponse(page);

    await expect(page.getByText("Hover")).toBeVisible({ timeout: 10_000 });
    await assertNoXSS(page);
  });

  test("javascript URI in paragraph is escaped", async ({ page }) => {
    const payload =
      'Click <a href="javascript:window.xssTriggered=true">this link</a> now';
    await setupMocks(page, payload);
    await sendAndWaitForResponse(page);

    await expect(page.getByText("Click")).toBeVisible({ timeout: 10_000 });
    await assertNoXSS(page);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Table Escaping (tests the fix applied to parseTable)
// ─────────────────────────────────────────────────────────────────────────────

test.describe("XSS: table content escaping", () => {
  test("script tag in table cell is escaped", async ({ page }) => {
    const payload = [
      "| Procedure | Status |",
      "|-----------|--------|",
      '| Normal | <script>window.xssTriggered=true</script> |',
    ].join("\n");
    await setupMocks(page, payload);
    await sendAndWaitForResponse(page);

    // Table should render with escaped content
    await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
    await assertNoXSS(page);
    // The script tag should appear as visible text in the cell
    await expect(page.locator("td").last()).toContainText("<script>");
  });

  test("img onerror in table header is escaped", async ({ page }) => {
    const payload = [
      '| <img src=x onerror="window.xssTriggered=true"> | Value |',
      "|-----------|--------|",
      "| Normal | OK |",
    ].join("\n");
    await setupMocks(page, payload);
    await sendAndWaitForResponse(page);

    await expect(page.locator("table")).toBeVisible({ timeout: 10_000 });
    await assertNoXSS(page);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// URL Parameter Safety
// ─────────────────────────────────────────────────────────────────────────────

test.describe("XSS: URL parameter safety", () => {
  test("script payload in ?message= param is not executed", async ({
    page,
  }) => {
    // Mock the API to return a safe response (the payload is in the URL, not the response)
    await setupMocks(page, "I can help with that question.");

    // Navigate directly to chat with XSS payload in message param
    await page.goto(
      "/app/chat?message=%3Cscript%3Ewindow.xssTriggered%3Dtrue%3C%2Fscript%3E"
    );

    // Set XSS detection flag after page load (before React processes the param)
    await page.evaluate(() => {
      (window as unknown as Record<string, unknown>).xssTriggered = false;
    });

    // Wait for the page to process the URL param and send the message
    await expect(
      page.getByText("I can help with that question.")
    ).toBeVisible({ timeout: 15_000 });

    // The URL param was sent as a chat message, not executed as code
    await assertNoXSS(page);

    // The user bubble should show the payload as plain text
    await expect(
      page.getByText("<script>window.xssTriggered=true</script>").first()
    ).toBeVisible();
  });
});

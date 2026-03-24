import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  mockChatSSE,
  mockChatError,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  buildSSEResponse,
} from "./helpers";

/**
 * Chat Flow Tests (TEST_PLAN §3)
 *
 * Covers: empty state, send/receive, suggestions, health context bridge,
 * consent banner, offline, rate limiting, auth gate.
 */

// ---------------------------------------------------------------------------
// §3.1 Chat UI — Authenticated (positive)
// ---------------------------------------------------------------------------

test.describe("Chat UI — Authenticated", () => {
  test("§3.1.1 empty state shows 6 suggestion cards", async ({ page }) => {
    await mockAuthenticatedUser(page);
    await mockChatSSE(page, "Hello");
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat");

    await expect(page.getByText("Check Coverage")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Appeal a Denial")).toBeVisible();
    await expect(page.getByText("Understand My Bill")).toBeVisible();
    await expect(page.getByText("Preventive Care")).toBeVisible();
    await expect(page.getByText("Diabetes Care")).toBeVisible();
    await expect(page.getByText("Weight Management")).toBeVisible();
  });

  test("§3.1.2 empty state shows personalized greeting", async ({ page }) => {
    await mockAuthenticatedUser(page, { email: "alice@example.com" });
    await mockChatSSE(page, "Hello");
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat");

    // Greeting should contain the name derived from email
    await expect(page.getByText("Alice")).toBeVisible({ timeout: 10_000 });
  });

  test("§3.1.3 chat input is visible and enabled for authenticated user", async ({
    page,
  }) => {
    await mockAuthenticatedUser(page);
    await mockChatSSE(page, "Hello");
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat");

    const input = page.getByPlaceholder("Ask about Medicare, coverage, or health...");
    await expect(input).toBeVisible({ timeout: 10_000 });
    await expect(input).toBeEnabled();
  });

  test("§3.1.5 send message → response renders", async ({ page }) => {
    await mockAuthenticatedUser(page);
    await mockChatSSE(page, "Medicare covers most preventive screenings at no cost to you.");
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat");

    const input = page.getByPlaceholder("Ask about Medicare, coverage, or health...");
    await expect(input).toBeVisible({ timeout: 10_000 });

    await input.fill("What does Medicare cover?");
    await input.press("Enter");

    // User message bubble should appear
    await expect(page.getByText("What does Medicare cover?")).toBeVisible({ timeout: 10_000 });
    // Assistant response should appear
    await expect(
      page.getByText("Medicare covers most preventive screenings")
    ).toBeVisible({ timeout: 10_000 });
  });

  test("§3.1.6 response includes suggestion buttons", async ({ page }) => {
    await mockAuthenticatedUser(page);
    await mockChatSSE(page, "I can help with that.", ["Check coverage", "Appeal a denial"]);
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat");

    const input = page.getByPlaceholder("Ask about Medicare, coverage, or health...");
    await expect(input).toBeVisible({ timeout: 10_000 });

    await input.fill("Help me");
    await input.press("Enter");

    // Wait for suggestions to appear
    await expect(page.getByText("Check coverage")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Appeal a denial")).toBeVisible();
  });

  test("§3.1.7 click suggestion card sends message", async ({ page }) => {
    await mockAuthenticatedUser(page);

    const chatRequests: string[] = [];
    await page.route("**/api/chat", async (route) => {
      const body = route.request().postDataJSON();
      if (body?.messages) {
        const lastMsg = body.messages[body.messages.length - 1];
        if (lastMsg?.content) chatRequests.push(lastMsg.content);
      }
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: buildSSEResponse("Here's coverage info."),
      });
    });
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat");
    await expect(page.getByText("Check Coverage")).toBeVisible({ timeout: 10_000 });

    // Click the "Check Coverage" card
    await page.getByText("Check Coverage").click();

    // Should have sent a message
    await expect.poll(() => chatRequests.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    expect(chatRequests[0]).toContain("Medicare covers a procedure");
  });

  test("§3.1.11 ?message= auto-sends on load", async ({ page }) => {
    await mockAuthenticatedUser(page);

    const chatRequests: string[] = [];
    await page.route("**/api/chat", async (route) => {
      const body = route.request().postDataJSON();
      if (body?.messages) {
        const lastMsg = body.messages[body.messages.length - 1];
        if (lastMsg?.content) chatRequests.push(lastMsg.content);
      }
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: buildSSEResponse("Here's info about diabetes."),
      });
    });
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat?message=Tell%20me%20about%20diabetes");

    // Should auto-send the message from URL param
    await expect.poll(() => chatRequests.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    expect(chatRequests[0]).toBe("Tell me about diabetes");
  });

  test("§3.1.12 ?topic=diabetes auto-sends diabetes question", async ({
    page,
  }) => {
    await mockAuthenticatedUser(page);

    const chatRequests: string[] = [];
    await page.route("**/api/chat", async (route) => {
      const body = route.request().postDataJSON();
      if (body?.messages) {
        const lastMsg = body.messages[body.messages.length - 1];
        if (lastMsg?.content) chatRequests.push(lastMsg.content);
      }
      await route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: buildSSEResponse("Diabetes and Medicare coverage info."),
      });
    });
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat?topic=diabetes");

    await expect.poll(() => chatRequests.length, { timeout: 10_000 }).toBeGreaterThanOrEqual(1);
    expect(chatRequests[0]).toContain("diabetes");
  });

  test("§3.1.13 payment success toast appears", async ({ page }) => {
    await mockAuthenticatedUser(page);
    await mockChatSSE(page, "Hello");
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat?payment=success");

    await expect(page.getByText("Payment successful")).toBeVisible({ timeout: 10_000 });
  });

  test("§3.1.14 'Upgrade' message opens paywall modal", async ({ page }) => {
    await mockAuthenticatedUser(page);
    await mockChatSSE(page, "Hello");
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat");

    const input = page.getByPlaceholder("Ask about Medicare, coverage, or health...");
    await expect(input).toBeVisible({ timeout: 10_000 });

    await input.fill("upgrade");
    await input.press("Enter");

    // PaywallModal should appear with plan options
    await expect(page.getByText("Starter")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("$10")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// §3.2 Chat UI — Unauthenticated (negative)
// ---------------------------------------------------------------------------

test.describe("Chat UI — Unauthenticated", () => {
  test("§3.2.1 unauthenticated user sees sign-up prompt", async ({ page }) => {
    await mockUnauthenticatedUser(page);
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat");

    await expect(page.getByText("Sign up for a free trial")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Sign up free" })).toBeVisible();
  });

  test("§3.2.2 chat input NOT visible for unauth user", async ({ page }) => {
    await mockUnauthenticatedUser(page);
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat");

    await expect(page.getByText("Sign up for a free trial")).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByPlaceholder("Ask about Medicare, coverage, or health...")
    ).not.toBeVisible();
  });

  test("§3.2.4 empty state cards still visible for unauth", async ({
    page,
  }) => {
    await mockUnauthenticatedUser(page);
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat");

    // Cards should still be browsable
    await expect(page.getByText("Check Coverage")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Appeal a Denial")).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// §3.3 Chat — Health context bridge
// ---------------------------------------------------------------------------

test.describe("Chat — Health context bridge", () => {
  test("§3.3.1 BB connected + consent ON → no consent banner", async ({
    page,
  }) => {
    await mockAuthenticatedUser(page);
    await mockChatSSE(page, "Hello");
    await mockFHIRData(page, true);
    await mockConsent(page, { health_data_ai: true });
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat");

    await expect(page.getByPlaceholder("Ask about Medicare")).toBeVisible({ timeout: 10_000 });
    // Consent banner should NOT be visible
    await expect(
      page.getByText("Your Medicare data is connected but not shared with AI")
    ).not.toBeVisible();
  });

  test("§3.3.2 BB connected + consent OFF → consent banner visible", async ({
    page,
  }) => {
    await mockAuthenticatedUser(page);
    await mockChatSSE(page, "Hello");
    await mockFHIRData(page, true);
    await mockConsent(page, { health_data_ai: false });
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat");

    await expect(
      page.getByText("Your Medicare data is connected but not shared with AI")
    ).toBeVisible({ timeout: 10_000 });
  });

  test("§3.3.3 consent banner links to Settings", async ({ page }) => {
    await mockAuthenticatedUser(page);
    await mockChatSSE(page, "Hello");
    await mockFHIRData(page, true);
    await mockConsent(page, { health_data_ai: false });
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat");

    const link = page.getByText("Enable in Settings");
    await expect(link).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// §3.5 Chat — Rate limiting & errors (negative)
// ---------------------------------------------------------------------------

test.describe("Chat — Rate limiting & errors", () => {
  test("§3.5.1 chat API returns 429 → error shown", async ({ page }) => {
    await mockAuthenticatedUser(page);
    await mockChatError(page, 429, "Daily message limit reached. Try again tomorrow.", "RATE_LIMITED");
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat");

    const input = page.getByPlaceholder("Ask about Medicare, coverage, or health...");
    await expect(input).toBeVisible({ timeout: 10_000 });

    await input.fill("test message");
    await input.press("Enter");

    // Error message should appear
    await expect(
      page.getByText(/limit|try again/i)
    ).toBeVisible({ timeout: 10_000 });
  });

  test("§3.5.4 chat API returns 500 → error message, not crash", async ({
    page,
  }) => {
    await mockAuthenticatedUser(page);
    await mockChatError(page, 500, "Something went wrong. Please try again.");
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat");

    const input = page.getByPlaceholder("Ask about Medicare, coverage, or health...");
    await expect(input).toBeVisible({ timeout: 10_000 });

    await input.fill("test");
    await input.press("Enter");

    // Should show error, not crash the page
    await expect(
      page.getByText("I'm having trouble connecting right now")
    ).toBeVisible({ timeout: 10_000 });
  });
});

// ---------------------------------------------------------------------------
// §3.6 Chat — XSS prevention
// ---------------------------------------------------------------------------

test.describe("Chat — XSS prevention", () => {
  test("§3.6.1 script tag in ?message= does not execute", async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).xssTriggered = false;
    });

    await mockUnauthenticatedUser(page);
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    await page.goto(
      "/app/chat?message=%3Cscript%3Ewindow.xssTriggered%3Dtrue%3C%2Fscript%3E"
    );

    await page.waitForLoadState("networkidle");
    const triggered = await page.evaluate(
      () => (window as unknown as Record<string, unknown>).xssTriggered
    );
    expect(triggered).toBe(false);
  });

  test("§3.6.2 img onerror in SSE response does not execute", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).xssTriggered = false;
    });

    await mockAuthenticatedUser(page);
    await page.route("**/api/chat", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: buildSSEResponse(
          'Here is info: <img src=x onerror="window.xssTriggered=true"> about coverage.'
        ),
      })
    );
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat");

    const input = page.getByPlaceholder("Ask about Medicare, coverage, or health...");
    await expect(input).toBeVisible({ timeout: 10_000 });

    await input.fill("test");
    await input.press("Enter");

    // Wait for response to render
    await expect(page.getByText("Here is info")).toBeVisible({ timeout: 10_000 });

    const triggered = await page.evaluate(
      () => (window as unknown as Record<string, unknown>).xssTriggered
    );
    expect(triggered).toBe(false);
  });
});

import { test, expect, Page } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
} from "./helpers";

/**
 * Appeal Levels 2-5 E2E Tests
 *
 * Covers:
 * 1. Modal header shows correct level label (Level 1-3)
 * 2. Informational mode for Level 4-5 (guidance only, no letter actions)
 * 3. Free escalation banner for Level 2+
 * 4. Prior appeals checklist item for Level 2+
 */

// Block SW to prevent cached /api/profile from leaking between tests
// (tests switch between basic auth and admin auth profiles)
test.use({ serviceWorkers: "block" });

// ---------------------------------------------------------------------------
// Custom SSE builder that supports toolsUsed and sessionState
// ---------------------------------------------------------------------------

function buildAppealSSE(options: {
  content: string;
  appealLetter?: string;
  appealLevel: number;
  sessionState?: Record<string, unknown>;
}) {
  const {
    content,
    appealLetter,
    appealLevel,
    sessionState = {},
  } = options;

  const donePayload = {
    content,
    conversationId: "test-appeal-conv",
    suggestions: [],
    sessionState: {
      appealLevel,
      denialCodes: ["CO-4"],
      policyReferences: ["LCD L35936"],
      ...sessionState,
    },
    toolsUsed: ["generate_appeal_letter"],
    ...(appealLetter !== undefined ? { appealLetter } : {}),
  };

  const lines = [
    `event: delta\ndata: ${JSON.stringify({ text: content })}\n\n`,
    `event: done\ndata: ${JSON.stringify(donePayload)}\n\n`,
  ];
  return lines.join("");
}

// ---------------------------------------------------------------------------
// Shared setup
// ---------------------------------------------------------------------------

async function setupChatPage(page: Page) {
  await mockAuthenticatedUser(page, {
    plan: "starter",
    appeal_credits: 2,
  });
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
  await page.route("**/api/appeals*", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appeals: [] }),
    })
  );
}

/**
 * Setup for tests that need AppealGate to grant access.
 *
 * checkAppealAccess() fetches /api/profile and reads plan+isAdmin from
 * the response (not stale authState closure). Using is_admin=true ensures
 * the gate grants access on the first check.
 */
async function setupWithAccessGranted(page: Page) {
  await mockAuthenticatedUser(page, {
    plan: "unlimited",
    is_admin: true,
    appeal_credits: 999,
  });
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
  await page.route("**/api/appeals*", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appeals: [] }),
    })
  );
}

async function mockChatWithAppeal(
  page: Page,
  options: {
    appealLevel: number;
    appealLetter?: string;
    content?: string;
  }
) {
  const {
    appealLevel,
    appealLetter,
    content = "I have prepared your appeal letter.",
  } = options;

  // Unroute any previous chat mock to avoid conflicts between tests
  await page.unroute("**/api/chat").catch(() => {});
  await page.route("**/api/chat", (route) =>
    route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
      body: buildAppealSSE({
        content,
        appealLetter,
        appealLevel,
      }),
    })
  );
}

async function sendMessageAndWaitForResponse(page: Page, content?: string) {
  const input = page.getByPlaceholder(/Ask about|Type a message/i);
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill("Help me appeal my denied claim");
  await input.press("Enter");

  const expectedText = content || "I have prepared your appeal letter.";
  await expect(
    page.getByText(expectedText).first()
  ).toBeVisible({ timeout: 10_000 });
}

async function openAppealModal(page: Page) {
  const viewBtn = page.getByRole("button", { name: /^View$/i });
  await expect(viewBtn).toBeVisible({ timeout: 5_000 });
  await viewBtn.click();
}

// ---------------------------------------------------------------------------
// Test: Modal header shows level label
// ---------------------------------------------------------------------------

test.describe("Appeal Modal — Header Level Label", () => {
  test('Level 1 shows "Appeal Letter" header', async ({ page }) => {
    await setupChatPage(page);
    await mockChatWithAppeal(page, {
      appealLevel: 1,
      appealLetter:
        "MEDICARE APPEAL REQUEST\n\nDear Medicare,\n\nI am writing to appeal the denial...\n\nSincerely,\nPatient",
    });

    await page.goto("/app/chat");
    await sendMessageAndWaitForResponse(page);
    await openAppealModal(page);

    const header = page.locator("h2").filter({ hasText: "Appeal Letter" });
    await expect(header).toBeVisible({ timeout: 5_000 });

    await expect(
      page.locator("h2").filter({ hasText: "Level 1" })
    ).not.toBeVisible();
  });

  test('Level 2 shows "Level 2 Appeal Letter" header', async ({ page }) => {
    await setupChatPage(page);
    await mockChatWithAppeal(page, {
      appealLevel: 2,
      appealLetter:
        "MEDICARE APPEAL REQUEST — LEVEL 2\n\nDear QIC,\n\nI am writing to appeal the Level 1 denial...\n\nSincerely,\nPatient",
    });

    await page.goto("/app/chat");
    await sendMessageAndWaitForResponse(page);
    await openAppealModal(page);

    const header = page.locator("h2").filter({ hasText: "Level 2 Appeal Letter" });
    await expect(header).toBeVisible({ timeout: 5_000 });
  });

  test('Level 3 shows "Level 3 Appeal Letter" header', async ({ page }) => {
    await setupChatPage(page);
    await mockChatWithAppeal(page, {
      appealLevel: 3,
      appealLetter:
        "MEDICARE APPEAL REQUEST — LEVEL 3\n\nDear ALJ,\n\nI am writing to appeal the Level 2 denial...\n\nSincerely,\nPatient",
    });

    await page.goto("/app/chat");
    await sendMessageAndWaitForResponse(page);
    await openAppealModal(page);

    const header = page.locator("h2").filter({ hasText: "Level 3 Appeal Letter" });
    await expect(header).toBeVisible({ timeout: 5_000 });
  });
});

// ---------------------------------------------------------------------------
// Test: Informational mode for Levels 4-5
// ---------------------------------------------------------------------------

test.describe("Appeal Modal — Informational Mode (Levels 4-5)", () => {
  test('Level 4 shows "Level 4 — Medicare Appeals Council" header', async ({
    page,
  }) => {
    await setupChatPage(page);
    await mockChatWithAppeal(page, {
      appealLevel: 4,
      content:
        "For Level 4, you need to file a request with the Medicare Appeals Council. Here is what you need to know.",
    });

    await page.goto("/app/chat");

    const input = page.getByPlaceholder(/Ask about|Type a message/i);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("How do I escalate to Level 4?");
    await input.press("Enter");

    await expect(
      page.getByText(/Medicare Appeals Council/i).first()
    ).toBeVisible({ timeout: 10_000 });
    await openAppealModal(page);

    const header = page.locator("h2").filter({ hasText: /Level 4/ });
    await expect(header).toBeVisible({ timeout: 5_000 });
    await expect(header).toContainText("Medicare Appeals Council");
  });

  test('Level 4 shows "Guidance Only" banner', async ({ page }) => {
    await setupChatPage(page);
    await mockChatWithAppeal(page, {
      appealLevel: 4,
      content:
        "For Level 4, you need to file with the Medicare Appeals Council.",
    });

    await page.goto("/app/chat");

    const input = page.getByPlaceholder(/Ask about|Type a message/i);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("Escalate to Level 4");
    await input.press("Enter");

    await expect(
      page.getByText(/Medicare Appeals Council/i).first()
    ).toBeVisible({ timeout: 10_000 });
    await openAppealModal(page);

    await expect(
      page.getByText("Guidance Only", { exact: true })
    ).toBeVisible({ timeout: 5_000 });
  });

  test("Level 4 shows SHIP counselor phone number", async ({ page }) => {
    await setupChatPage(page);
    await mockChatWithAppeal(page, {
      appealLevel: 4,
      content:
        "For Level 4, you need to file with the Medicare Appeals Council.",
    });

    await page.goto("/app/chat");

    const input = page.getByPlaceholder(/Ask about|Type a message/i);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("Escalate to Level 4");
    await input.press("Enter");

    await expect(
      page.getByText(/Medicare Appeals Council/i).first()
    ).toBeVisible({ timeout: 10_000 });
    await openAppealModal(page);

    await expect(page.getByText("1-877-839-2675")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("Level 4 does NOT show Copy/Download/Print buttons", async ({
    page,
  }) => {
    await setupChatPage(page);
    await mockChatWithAppeal(page, {
      appealLevel: 4,
      content:
        "For Level 4, you need to file with the Medicare Appeals Council.",
    });

    await page.goto("/app/chat");

    const input = page.getByPlaceholder(/Ask about|Type a message/i);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("Escalate to Level 4");
    await input.press("Enter");

    await expect(
      page.getByText(/Medicare Appeals Council/i).first()
    ).toBeVisible({ timeout: 10_000 });
    await openAppealModal(page);

    await expect(
      page.getByText("Guidance Only", { exact: true })
    ).toBeVisible({ timeout: 5_000 });

    await expect(
      page.getByRole("button", { name: /^Copy$/ })
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: /Download/i })
    ).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Print$/ })
    ).not.toBeVisible();
  });

  test('Level 5 shows "Level 5 — Federal District Court" header', async ({
    page,
  }) => {
    await setupChatPage(page);
    await mockChatWithAppeal(page, {
      appealLevel: 5,
      content:
        "Level 5 involves filing a civil action in Federal District Court.",
    });

    await page.goto("/app/chat");

    const input = page.getByPlaceholder(/Ask about|Type a message/i);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("Escalate to Level 5");
    await input.press("Enter");

    await expect(
      page.getByText(/Federal District Court/i).first()
    ).toBeVisible({ timeout: 10_000 });
    await openAppealModal(page);

    const header = page.locator("h2").filter({ hasText: /Level 5/ });
    await expect(header).toBeVisible({ timeout: 5_000 });
    await expect(header).toContainText("Federal District Court");
  });
});

// ---------------------------------------------------------------------------
// Test: Free escalation banner for Level 2+
//
// These tests require AppealGate to grant access (accessGranted=true).
// checkAppealAccess() reads isAdmin from fresh /api/profile response.
// ---------------------------------------------------------------------------

test.describe("Appeal Modal — Free Escalation Banner", () => {

  test('Level 2 shows "no additional credit used" banner', async ({
    page,
  }) => {
    await setupWithAccessGranted(page);
    await mockChatWithAppeal(page, {
      appealLevel: 2,
      appealLetter:
        "MEDICARE APPEAL REQUEST — LEVEL 2\n\nDear QIC,\n\nI am writing to appeal...\n\nSincerely,\nPatient",
    });

    await page.goto("/app/chat");
    await sendMessageAndWaitForResponse(page);
    await openAppealModal(page);
    // Wait for AppealGate to grant access (checkAppealAccess reads fresh profile)
    await expect(
      page.getByText(/Sign and date the letter/i)
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText(/no additional credit used/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test('Level 3 shows "no additional credit used" banner', async ({
    page,
  }) => {
    await setupWithAccessGranted(page);
    await mockChatWithAppeal(page, {
      appealLevel: 3,
      appealLetter:
        "MEDICARE APPEAL REQUEST — LEVEL 3\n\nDear ALJ,\n\nI am writing to appeal...\n\nSincerely,\nPatient",
    });

    await page.goto("/app/chat");
    await sendMessageAndWaitForResponse(page);
    await openAppealModal(page);
    await expect(
      page.getByText(/Sign and date the letter/i)
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText(/no additional credit used/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test('Level 1 does NOT show "no additional credit used" banner', async ({
    page,
  }) => {
    // Negative test: the escalation banner requires appealLevel >= 2
    // so for Level 1 it should never appear regardless of access status.
    await setupChatPage(page);
    await mockChatWithAppeal(page, {
      appealLevel: 1,
      appealLetter:
        "MEDICARE APPEAL REQUEST\n\nDear Medicare,\n\nI am writing to appeal...\n\nSincerely,\nPatient",
    });

    await page.goto("/app/chat");
    await sendMessageAndWaitForResponse(page);
    await openAppealModal(page);
    // Just wait for the modal header to confirm it's open
    await expect(
      page.locator("h2").filter({ hasText: "Appeal Letter" })
    ).toBeVisible({ timeout: 5_000 });

    await expect(
      page.getByText(/no additional credit used/i)
    ).not.toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// Test: Prior appeals checklist item for Level 2+
// ---------------------------------------------------------------------------

test.describe("Appeal Modal — Prior Appeals Checklist", () => {
  test("Level 2 shows prior appeal denial letters checklist item", async ({
    page,
  }) => {
    await setupWithAccessGranted(page);
    await mockChatWithAppeal(page, {
      appealLevel: 2,
      appealLetter:
        "MEDICARE APPEAL REQUEST — LEVEL 2\n\nDear QIC,\n\nI am writing to appeal...\n\nSincerely,\nPatient",
    });

    await page.goto("/app/chat");
    await sendMessageAndWaitForResponse(page);
    await openAppealModal(page);
    await expect(
      page.getByText(/Sign and date the letter/i)
    ).toBeVisible({ timeout: 10_000 });

    await expect(
      page.getByText(/Include copies of all prior appeal denial letters/i)
    ).toBeVisible({ timeout: 5_000 });
  });

  test("Level 1 does NOT show prior appeal denial letters checklist item", async ({
    page,
  }) => {
    // Negative test: the prior appeals checklist item requires appealLevel >= 2.
    // For Level 1 it should never appear regardless of access status.
    await setupChatPage(page);
    await mockChatWithAppeal(page, {
      appealLevel: 1,
      appealLetter:
        "MEDICARE APPEAL REQUEST\n\nDear Medicare,\n\nI am writing to appeal...\n\nSincerely,\nPatient",
    });

    await page.goto("/app/chat");
    await sendMessageAndWaitForResponse(page);
    await openAppealModal(page);
    // Just wait for the modal header to confirm it's open
    await expect(
      page.locator("h2").filter({ hasText: "Appeal Letter" })
    ).toBeVisible({ timeout: 5_000 });

    await expect(
      page.getByText(/Include copies of all prior appeal denial letters/i)
    ).not.toBeVisible();
  });
});

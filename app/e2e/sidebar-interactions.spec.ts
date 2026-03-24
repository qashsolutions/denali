import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  mockConversationHistory,
  mockChatSSE,
} from "./helpers";

/**
 * Sidebar Interaction Tests (pendingtests.md #11, #12)
 *
 * Covers: conversation click navigation, group collapse/expand.
 */

async function setupChatWithHistory(page: import("@playwright/test").Page) {
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

  // Mock conversation history with items in "Today" group
  const now = new Date();
  await mockConversationHistory(page, [
    {
      id: "conv-abc-1",
      preview: "Help with my denied claim",
      created_at: new Date(now.getTime() - 60_000).toISOString(), // 1 min ago
    },
    {
      id: "conv-abc-2",
      preview: "What does Medicare cover?",
      created_at: new Date(now.getTime() - 120_000).toISOString(), // 2 min ago
    },
  ]);

  // Mock individual conversation endpoint
  await page.route("**/api/conversations/conv-abc-1", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        conversation: { id: "conv-abc-1", user_id: "test-user-id-000" },
        messages: [
          {
            id: "msg-1",
            role: "user",
            content: "Help with my denied claim",
            created_at: now.toISOString(),
          },
          {
            id: "msg-2",
            role: "assistant",
            content: "I can help with that.",
            created_at: now.toISOString(),
          },
        ],
      }),
    })
  );
}

test.describe("Sidebar — Click Navigate (#11)", () => {
  test("clicking conversation item navigates to ?id=", async ({ page }) => {
    await setupChatWithHistory(page);
    await page.goto("/app/chat");

    // Open sidebar on mobile
    const toggleBtn = page.getByLabel("Open menu");
    if (await toggleBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await toggleBtn.click();
    }

    // "Today" group should be expanded by default and show conversation items
    const sidebar = page.locator("aside[aria-label='Sidebar']");
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // Click the conversation item (title is in a <p> with truncate class)
    const convItem = sidebar.getByText("Help with my denied claim").first();
    await expect(convItem).toBeVisible({ timeout: 5_000 });
    await convItem.click();

    // URL should now contain ?id=conv-abc-1
    await page.waitForURL("**/app/chat?id=conv-abc-1", { timeout: 5_000 });
    expect(page.url()).toContain("id=conv-abc-1");
  });
});

test.describe("Sidebar — Group Collapse/Expand (#12)", () => {
  test("clicking group header collapses and re-expands items", async ({
    page,
  }) => {
    await setupChatWithHistory(page);
    await page.goto("/app/chat");

    // Open sidebar on mobile
    const toggleBtn = page.getByLabel("Open menu");
    if (await toggleBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await toggleBtn.click();
    }

    const sidebar = page.locator("aside[aria-label='Sidebar']");
    await expect(sidebar).toBeVisible({ timeout: 10_000 });

    // "Today" group header should be visible and expanded (aria-expanded=true)
    const todayHeader = sidebar.getByRole("button", { name: /Today/i });
    await expect(todayHeader).toBeVisible({ timeout: 5_000 });
    await expect(todayHeader).toHaveAttribute("aria-expanded", "true");

    // Conversation items should be visible (use .first() — preview text also contains the phrase)
    const convItem = sidebar.getByText("Help with my denied claim").first();
    await expect(convItem).toBeVisible();

    // Click group header to collapse
    await todayHeader.click();
    await expect(todayHeader).toHaveAttribute("aria-expanded", "false");

    // Items should be hidden
    await expect(convItem).not.toBeVisible();

    // Click again to re-expand
    await todayHeader.click();
    await expect(todayHeader).toHaveAttribute("aria-expanded", "true");
    await expect(convItem).toBeVisible();
  });
});

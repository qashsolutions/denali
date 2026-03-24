import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  mockChatSSE,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  mockConversationHistory,
} from "./helpers";

/**
 * Sidebar Tests (TEST_PLAN §15)
 *
 * Covers: conversation history, grouping, new chat, empty state.
 */

test.describe("Sidebar — Conversation History (§15)", () => {
  test("§15.1 sidebar shows 'New Chat' button", async ({ page }) => {
    await mockAuthenticatedUser(page);
    await mockChatSSE(page, "Hello");
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);
    await page.goto("/app/chat");

    // On mobile, need to open sidebar first
    const sidebarToggle = page.locator("[aria-label='Open sidebar'], button:has-text('Ask Denali')").first();
    if (await sidebarToggle.isVisible()) {
      await sidebarToggle.click();
    }

    await expect(page.getByText(/New Chat|New Conversation/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("§15.2 sidebar shows conversation history grouped by date", async ({
    page,
  }) => {
    await mockAuthenticatedUser(page);
    await mockChatSSE(page, "Hello");
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    // Mock conversation history with items
    await mockConversationHistory(page, [
      {
        id: "conv-1",
        preview: "What does Medicare cover?",
        created_at: new Date().toISOString(),
      },
      {
        id: "conv-2",
        preview: "Help with my appeal",
        created_at: new Date(Date.now() - 86400000).toISOString(), // yesterday
      },
    ]);

    await page.goto("/app/chat");

    // Open sidebar on mobile
    const sidebarToggle = page.locator("[aria-label='Open sidebar'], button:has-text('Ask Denali')").first();
    if (await sidebarToggle.isVisible()) {
      await sidebarToggle.click();
    }

    // Should see conversation titles (first() since preview also contains the text)
    await expect(page.getByText("What does Medicare cover?").first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Help with my appeal").first()).toBeVisible();

    // Should see date groupings (use .first() as timestamps contain group names)
    await expect(page.getByText("Today").first()).toBeVisible();
    await expect(page.getByText("Yesterday").first()).toBeVisible();
  });

  test("§15.3 empty sidebar shows 'No conversations yet'", async ({ page }) => {
    await mockAuthenticatedUser(page);
    await mockChatSSE(page, "Hello");
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    await page.goto("/app/chat");

    // Open sidebar
    const sidebarToggle = page.locator("[aria-label='Open sidebar'], button:has-text('Ask Denali')").first();
    if (await sidebarToggle.isVisible()) {
      await sidebarToggle.click();
    }

    await expect(
      page.getByText(/No conversations|Start a new/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

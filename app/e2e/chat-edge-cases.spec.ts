import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockChatSSE,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  buildSSEResponse,
} from "./helpers";

/**
 * Chat Edge Case Tests (pendingtests.md #29, #30, #31)
 *
 * Covers: loading existing conversation, New Chat reset, URL sync on new conv.
 */

async function setupChatPage(page: import("@playwright/test").Page) {
  await mockAuthenticatedUser(page);
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
  // Mock appeals endpoint (called by useChat when loading a conversation)
  await page.route("**/api/appeals*", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appeals: [] }),
    })
  );
}

test.describe("Chat — Load Existing Conversation (#29)", () => {
  test("navigating to ?id=conv-123 loads conversation messages", async ({
    page,
  }) => {
    await setupChatPage(page);

    // Mock specific conversation endpoint
    // loadConversation() reads data.conversation.messages (not top-level messages)
    await page.route("**/api/conversations/conv-123", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation: {
            id: "conv-123",
            user_id: "test-user-id-000",
            title: null,
            status: "active",
            isAppeal: false,
            createdAt: new Date().toISOString(),
            messages: [
              {
                id: "msg-1",
                role: "user",
                content: "What does Medicare Part B cover?",
                createdAt: new Date().toISOString(),
              },
              {
                id: "msg-2",
                role: "assistant",
                content:
                  "Medicare Part B covers outpatient services, doctor visits, preventive care, and more.",
                createdAt: new Date().toISOString(),
              },
            ],
          },
        }),
      })
    );

    await page.goto("/app/chat?id=conv-123");

    // Previous messages should be rendered
    await expect(
      page.getByText("What does Medicare Part B cover?")
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText("Medicare Part B covers outpatient services").first()
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Chat — New Chat Resets State (#30)", () => {
  test("clicking New Chat clears messages and URL", async ({ page }) => {
    await setupChatPage(page);
    await mockChatSSE(page, "I can help with that.");

    // Mock conversation to load
    await page.route("**/api/conversations/conv-old", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation: {
            id: "conv-old",
            user_id: "test-user-id-000",
            title: null,
            status: "active",
            isAppeal: false,
            createdAt: new Date().toISOString(),
            messages: [
              {
                id: "msg-1",
                role: "user",
                content: "Help with my denied claim",
                createdAt: new Date().toISOString(),
              },
              {
                id: "msg-2",
                role: "assistant",
                content: "I can help you appeal.",
                createdAt: new Date().toISOString(),
              },
            ],
          },
        }),
      })
    );

    await page.goto("/app/chat?id=conv-old");
    await expect(page.getByText("Help with my denied claim")).toBeVisible({
      timeout: 10_000,
    });

    // Open sidebar on mobile
    const toggleBtn = page.getByLabel("Open menu");
    if (await toggleBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await toggleBtn.click();
    }

    // Click "New Chat" button
    const newChatBtn = page.getByRole("button", { name: /New Chat/i });
    await expect(newChatBtn).toBeVisible({ timeout: 5_000 });
    await newChatBtn.click();

    // URL should no longer have ?id=
    await page.waitForURL(
      (url) => !url.search.includes("id="),
      { timeout: 5_000 }
    );

    // Suggestion cards should appear (empty state)
    await expect(
      page.getByText(/Check Coverage|Ask Denali/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Chat — URL Syncs on New Conversation (#31)", () => {
  test("sending first message updates URL with conversationId", async ({
    page,
  }) => {
    await setupChatPage(page);

    // SSE returns a specific conversationId
    await page.route("**/api/chat", (route) =>
      route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body: buildSSEResponse("I can help with that.", {
          conversationId: "new-conv-456",
        }),
      })
    );

    await page.goto("/app/chat");

    // No ?id= initially
    expect(page.url()).not.toContain("id=");

    const input = page.getByPlaceholder(/Ask about|Type a message/i);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("Hello, I need help");
    await input.press("Enter");

    // Wait for response
    await expect(page.getByText("I can help with that.")).toBeVisible({
      timeout: 10_000,
    });

    // URL should now contain ?id=new-conv-456
    await page.waitForURL(/id=new-conv-456/, { timeout: 5_000 });
    expect(page.url()).toContain("id=new-conv-456");
  });
});

import { test, expect } from "@playwright/test";

/**
 * E2E: Coverage check chat flow with mocked /api/chat SSE response.
 *
 * Verifies the user can type a coverage question, receive a streamed
 * assistant response, and see follow-up suggestions.
 */

const MOCK_CONTENT =
  "Medicare generally covers lumbar MRI (CPT 70553) when medically necessary for back pain. " +
  "Your doctor needs to document symptoms lasting at least 6 weeks with conservative treatment tried first. " +
  "This is covered under LCD policy L35936.";

const MOCK_SUGGESTIONS = [
  "What documents does my doctor need?",
  "Is prior authorization required?",
  "What if my MRI gets denied?",
];

/** Build an SSE text/event-stream body matching what route.ts returns */
function buildSSEResponse(): string {
  const lines: string[] = [];

  // Stream the content in chunks (simulating delta events)
  const words = MOCK_CONTENT.split(" ");
  const chunkSize = 5;
  for (let i = 0; i < words.length; i += chunkSize) {
    const chunk = words.slice(i, i + chunkSize).join(" ") + " ";
    lines.push(`event: delta`);
    lines.push(`data: ${JSON.stringify({ text: chunk })}`);
    lines.push("");
  }

  // Tool event
  lines.push(`event: tool`);
  lines.push(
    `data: ${JSON.stringify({ tool: "search_local_coverage", status: "complete" })}`
  );
  lines.push("");

  // Done event with full ChatResponseBody
  lines.push(`event: done`);
  lines.push(
    `data: ${JSON.stringify({
      content: MOCK_CONTENT,
      suggestions: MOCK_SUGGESTIONS,
      conversationId: "test-conv-001",
      sessionState: {
        diagnosisCodes: ["M54.5"],
        procedureCodes: ["70553"],
        policyReferences: ["L35936"],
      },
      toolsUsed: ["search_local_coverage"],
    })}`
  );
  lines.push("");
  // Trailing newline ensures the last event ends with \n\n for SSE parsing
  lines.push("");

  return lines.join("\n");
}

test("user asks about coverage and gets guidance with suggestions", async ({
  page,
}) => {
  // Mock the /api/chat endpoint to return SSE stream
  await page.route("**/api/chat", async (route) => {
    const sseBody = buildSSEResponse();
    await route.fulfill({
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
      body: sseBody,
    });
  });

  // Also mock /api/profile to avoid auth redirects
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

  // Mock conversations endpoint
  await page.route("**/api/conversations", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    });
  });

  // Navigate to chat page
  await page.goto("/app/chat");

  // Wait for the chat input to be ready
  const textarea = page.getByPlaceholder(
    "Ask about Medicare, coverage, or health..."
  );
  await expect(textarea).toBeVisible({ timeout: 10_000 });

  // Type the coverage question
  await textarea.fill("Does Medicare cover a lumbar MRI for back pain?");

  // Click send button
  await page.getByRole("button", { name: "Send message" }).click();

  // Assert: assistant message appears with coverage content
  await expect(page.getByText("LCD policy L35936")).toBeVisible({
    timeout: 15_000,
  });
  await expect(
    page.getByText("Medicare generally covers lumbar MRI")
  ).toBeVisible();

  // Assert: suggestions render as clickable buttons inside ChatInput
  // Suggestions appear when isLoading is false and suggestions array is non-empty
  const firstSuggestion = page.getByRole("button", {
    name: "What documents does my doctor need?",
  });
  await expect(firstSuggestion).toBeVisible({ timeout: 5_000 });

  // All 3 suggestions present
  await expect(
    page.getByRole("button", { name: "Is prior authorization required?" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "What if my MRI gets denied?" })
  ).toBeVisible();

  // Assert: no error state visible
  await expect(page.getByText("error")).not.toBeVisible();
  await expect(page.getByText("Something went wrong")).not.toBeVisible();
});

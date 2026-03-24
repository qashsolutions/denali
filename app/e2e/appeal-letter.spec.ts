import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  buildSSEResponse,
} from "./helpers";

/**
 * Appeal Letter Tests (pendingtests.md #26)
 *
 * Covers: appeal card renders in chat when SSE includes appealLetter.
 */

test.describe("Appeal Card — Renders in Chat (#26)", () => {
  test("SSE response with appealLetter shows appeal card", async ({
    page,
  }) => {
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

    // Mock chat SSE with appealLetter
    await page.route("**/api/chat", (route) =>
      route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
        body: buildSSEResponse(
          "I have prepared your appeal letter for the denied claim.",
          {
            appealLetter:
              "MEDICARE APPEAL REQUEST\n\nDear Sir/Madam,\n\nI am writing to appeal the denial of coverage...\n\nSincerely,\nPatient",
          }
        ),
      })
    );

    await page.goto("/app/chat");

    // Send message to trigger appeal
    const input = page.getByPlaceholder(/Ask about|Type a message/i);
    await expect(input).toBeVisible({ timeout: 10_000 });
    await input.fill("Appeal my denied claim for blood test");
    await input.press("Enter");

    // Appeal card should appear with a view button
    await expect(
      page.getByText(/View Appeal Letter|Appeal Letter/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
} from "./helpers";

/**
 * Health Report Interaction Tests (pendingtests.md #25)
 *
 * Covers: generating spinner banner state.
 */

test.describe("Health Report — Generating Spinner (#25)", () => {
  test("generating status shows spinner banner with text", async ({
    page,
  }) => {
    await mockAuthenticatedUser(page);
    await mockFHIRData(page, true);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);

    // Mock health report with "generating" status
    await page.route("**/api/health-report", (route) => {
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            report: {
              id: "report-gen-1",
              status: "generating",
              report_data: null,
            },
          }),
        });
      }
      return route.continue();
    });

    await page.goto("/app/health");

    await expect(page.getByText("My Health").first()).toBeVisible({
      timeout: 15_000,
    });

    // Spinner banner should show generating text
    await expect(
      page.getByText("Generating your health summary report...")
    ).toBeVisible({ timeout: 5_000 });
  });
});

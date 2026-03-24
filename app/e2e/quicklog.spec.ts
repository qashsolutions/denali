import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  mockDiabetesLog,
  mockDiabetesInsights,
  MOCK_FHIR_CONNECTED,
} from "./helpers";

/**
 * QuickLog Tests (pendingtests.md #9, #10)
 *
 * Covers: glucose form submission, activity/meal tab form switching.
 */

async function setupDiabetesPage(page: import("@playwright/test").Page) {
  await mockAuthenticatedUser(page);
  await mockFHIRData(page, true);
  await mockConsent(page, { health_data_ai: true });
  await mockDiabetesSnapshots(page);
  await mockDiabetesLog(page);
  await mockDiabetesInsights(page);
}

test.describe("QuickLog — Glucose Submission (#9)", () => {
  test("submitting glucose value POSTs to /api/diabetes/log", async ({
    page,
  }) => {
    await setupDiabetesPage(page);

    let postBody: Record<string, unknown> | null = null;
    // Override diabetes log route to capture POST
    await page.unroute("**/api/diabetes/log");
    await page.route("**/api/diabetes/log", (route) => {
      if (route.request().method() === "POST") {
        postBody = route.request().postDataJSON();
        return route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            success: true,
            entry: {
              id: "new-entry-1",
              entry_type: "glucose",
              glucose_value: 120,
              glucose_context: "fasting",
              logged_at: new Date().toISOString(),
            },
          }),
        });
      }
      // GET returns empty
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: [] }),
      });
    });

    await page.goto("/app/diabetes");

    // Wait for Daily Log section
    await expect(page.getByText("Daily Log")).toBeVisible({ timeout: 10_000 });

    // Glucose tab should be active by default
    const glucoseInput = page.getByPlaceholder("mg/dL");
    await expect(glucoseInput).toBeVisible();

    // Fill glucose value
    await glucoseInput.fill("120");

    // Context dropdown should default to "Fasting"
    // Click "Log Entry"
    await page.getByRole("button", { name: "Log Entry" }).click();

    // POST should have been called with correct body
    await page.waitForTimeout(500);
    expect(postBody).toBeTruthy();
    expect(postBody!.entry_type).toBe("glucose");
    expect(postBody!.glucose_value).toBe(120);
    expect(postBody!.glucose_context).toBe("fasting");
  });
});

test.describe("QuickLog — Tab Switching (#10)", () => {
  test("Activity tab shows minutes input", async ({ page }) => {
    await setupDiabetesPage(page);
    await page.goto("/app/diabetes");

    await expect(page.getByText("Daily Log")).toBeVisible({ timeout: 10_000 });

    // Click Activity tab
    await page.getByRole("button", { name: "Activity" }).click();

    // Should show minutes placeholder
    await expect(page.getByPlaceholder("Minutes")).toBeVisible();
    await expect(
      page.getByPlaceholder("Type (e.g. walking)")
    ).toBeVisible();
  });

  test("Meal tab shows food input", async ({ page }) => {
    await setupDiabetesPage(page);
    await page.goto("/app/diabetes");

    await expect(page.getByText("Daily Log")).toBeVisible({ timeout: 10_000 });

    // Click Meal tab
    await page.getByRole("button", { name: "Meal" }).click();

    // Should show meal placeholder
    await expect(page.getByPlaceholder("What did you eat?")).toBeVisible();
  });

  test("Note tab shows note input", async ({ page }) => {
    await setupDiabetesPage(page);
    await page.goto("/app/diabetes");

    await expect(page.getByText("Daily Log")).toBeVisible({ timeout: 10_000 });

    // Click Note tab
    await page.getByRole("button", { name: "Note" }).click();

    // Should show note placeholder
    await expect(page.getByPlaceholder("Add a note...")).toBeVisible();
  });
});

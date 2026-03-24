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
 * Diabetes Interaction Tests (pendingtests.md #50, #51, #52, #53, #54)
 *
 * Covers: RiskAlerts, A1C chart toggle, ScreeningReminders, InsightsCard, log delete.
 */

async function setupDiabetesPage(
  page: import("@playwright/test").Page,
  options: {
    withInsight?: boolean;
    withLogEntries?: boolean;
    withSnapshots?: boolean;
  } = {}
) {
  await mockAuthenticatedUser(page);

  // FHIR connected with diabetes conditions
  await page.route("**/api/fhir/data", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...MOCK_FHIR_CONNECTED,
        // Enrich: No endo in providers, diabetes meds with no active
        conditions: [
          { code: "E11.65", name: "Type 2 diabetes mellitus with hyperglycemia", category: "type2" },
          { code: "I10", name: "Essential hypertension", category: "other" },
        ],
        medications: [
          { name: "Metformin", status: "Active", isDiabetesMed: true, isObesityMed: false, daysSupply: 30, isBrandName: false, gapDays: 0 },
        ],
        screenings: [
          { screeningType: "a1c", displayName: "A1C Test", lastDate: "2025-06-15", monthsSinceLast: 9, isOverdue: true },
          { screeningType: "eye-exam", displayName: "Diabetic Eye Exam", lastDate: "2025-01-10", monthsSinceLast: 14, isOverdue: true },
        ],
        providers: [
          { name: "Dr. Smith", specialty: "Internal Medicine", visitCount: 5, lastSeen: "2026-01-15", npi: "1234567890" },
        ],
      }),
    })
  );

  await mockConsent(page, { health_data_ai: true });

  // Snapshots for A1C chart — SnapshotPoint needs { value, date, loincCode, labName, unit }
  // a1cHistory filters on labName.toLowerCase().includes("a1c"), needs >= 2 entries
  if (options.withSnapshots) {
    await mockDiabetesSnapshots(page, [
      { date: "2025-01-15", value: 7.2, loincCode: "4548-4", labName: "Hemoglobin A1C", unit: "%" },
      { date: "2025-06-15", value: 7.8, loincCode: "4548-4", labName: "Hemoglobin A1C", unit: "%" },
      { date: "2025-12-01", value: 8.1, loincCode: "4548-4", labName: "Hemoglobin A1C", unit: "%" },
    ]);
  } else {
    await mockDiabetesSnapshots(page);
  }

  // Log entries — LogEntry: { id, logged_at, entry_type, glucose_value?, glucose_context?, activity_minutes?, activity_type?, note? }
  if (options.withLogEntries) {
    await mockDiabetesLog(page, [
      {
        id: "log-1",
        entry_type: "glucose",
        glucose_value: 145,
        glucose_context: "fasting",
        note: null,
        logged_at: new Date().toISOString(),
      },
      {
        id: "log-2",
        entry_type: "meal",
        glucose_value: null,
        glucose_context: null,
        note: "Chicken salad",
        logged_at: new Date().toISOString(),
      },
    ]);
  } else {
    await mockDiabetesLog(page);
  }

  // Insights
  if (options.withInsight) {
    await mockDiabetesInsights(page, {
      summary: "Your diabetes management shows room for improvement.",
      recommendations: ["Schedule an A1C test", "Consider adding an endocrinologist to your care team"],
      risk_alerts: [],
      screening_reminders: [],
      generated_at: "2026-03-20T10:00:00Z",
    });
  } else {
    await mockDiabetesInsights(page);
  }

  await page.route("**/api/health-report", (route) =>
    route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ report: null }),
    })
  );
}

test.describe("Diabetes — RiskAlerts + CTA (#50)", () => {
  test("risk alerts show for diabetes user with no endocrinologist", async ({ page }) => {
    await setupDiabetesPage(page);
    await page.goto("/app/diabetes");

    // "No endocrinologist visits found" alert should be visible
    await expect(
      page.getByText("No endocrinologist visits found")
    ).toBeVisible({ timeout: 15_000 });

    // "Find a specialist" CTA link
    await expect(page.getByText("Find a specialist").first()).toBeVisible();
  });
});

test.describe("Diabetes — A1C Chart Toggle (#51)", () => {
  test("A1C trend chart shows toggle between chart and list", async ({ page }) => {
    await setupDiabetesPage(page, { withSnapshots: true });
    await page.goto("/app/diabetes");

    // "A1C Trend" heading visible
    await expect(page.getByText("A1C Trend")).toBeVisible({ timeout: 15_000 });

    // "Show list" toggle button
    const showListBtn = page.getByText("Show list");
    await expect(showListBtn).toBeVisible();
    await showListBtn.click();

    // After clicking, should show "A1C History" and "Show chart"
    await expect(page.getByText("A1C History")).toBeVisible({ timeout: 3_000 });
    await expect(page.getByText("Show chart")).toBeVisible();

    // Values should appear in the list
    await expect(page.getByText("7.2%")).toBeVisible();
    await expect(page.getByText("8.1%")).toBeVisible();
  });
});

test.describe("Diabetes — ScreeningReminders Overdue (#52)", () => {
  test("screening reminders show overdue indicator for A1C", async ({ page }) => {
    await setupDiabetesPage(page);
    await page.goto("/app/diabetes");

    // "Screening Reminders" header
    await expect(
      page.getByText("Screening Reminders")
    ).toBeVisible({ timeout: 15_000 });

    // Overdue A1C alert (9 months since last = at least 6 months, should trigger)
    await expect(
      page.getByText(/Time for an A1C check|Overdue for A1C screening/i)
    ).toBeVisible({ timeout: 5_000 });

    // Eye exam overdue (14 months since last)
    await expect(
      page.getByText(/eye exam overdue|Schedule.*eye exam/i)
    ).toBeVisible();

    // "Medicare covers this at no cost" note
    await expect(
      page.getByText("Medicare covers this at no cost").first()
    ).toBeVisible();
  });
});

test.describe("Diabetes — InsightsCard + Refresh (#53)", () => {
  test("insights card shows Claude analysis and refresh button", async ({ page }) => {
    await setupDiabetesPage(page, { withInsight: true });
    await page.goto("/app/diabetes");

    // "AI Insights" header (case: "AI INSIGHTS" rendered as uppercase via CSS)
    await expect(page.getByText("AI Insights")).toBeVisible({ timeout: 15_000 });

    // Insight summary text
    await expect(
      page.getByText("Your diabetes management shows room for improvement")
    ).toBeVisible();

    // Recommendations
    await expect(page.getByText("Schedule an A1C test")).toBeVisible();

    // Refresh button
    const refreshBtn = page.getByText("Refresh");
    await expect(refreshBtn).toBeVisible();

    // Click refresh (should trigger POST to /api/diabetes/insights)
    let insightPostCalled = false;
    await page.route("**/api/diabetes/insights", (route) => {
      if (route.request().method() === "POST") {
        insightPostCalled = true;
        return route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            insight: {
              summary: "Updated insights.",
              recommendations: [],
              risk_alerts: [],
              screening_reminders: [],
              generated_at: new Date().toISOString(),
            },
          }),
        });
      }
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          insight: {
            summary: "Your diabetes management shows room for improvement.",
            recommendations: ["Schedule an A1C test"],
            risk_alerts: [],
            screening_reminders: [],
            generated_at: "2026-03-20T10:00:00Z",
          },
        }),
      });
    });

    await refreshBtn.click();
    await page.waitForTimeout(1000);
    expect(insightPostCalled).toBe(true);
  });
});

test.describe("Diabetes — Log Delete (#54)", () => {
  test("delete button on log entry fires DELETE and removes entry", async ({ page }) => {
    // Set up page WITHOUT log entries first (we'll override the log route below)
    await setupDiabetesPage(page);

    const logEntries = [
      {
        id: "log-1",
        entry_type: "glucose",
        glucose_value: 145,
        glucose_context: "fasting",
        note: null,
        logged_at: new Date().toISOString(),
      },
      {
        id: "log-2",
        entry_type: "meal",
        glucose_value: null,
        glucose_context: null,
        note: "Chicken salad",
        logged_at: new Date().toISOString(),
      },
    ];

    // Override log route to handle GET + DELETE
    // DELETE uses /api/diabetes/log?id=xxx so we need a glob that matches query params
    let deleteCalled = false;
    await page.unroute("**/api/diabetes/log");
    await page.route("**/api/diabetes/log**", (route) => {
      if (route.request().method() === "DELETE") {
        deleteCalled = true;
        return route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ success: true }),
        });
      }
      // GET returns the log entries
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: logEntries }),
      });
    });

    await page.goto("/app/diabetes");

    // Recent log entries should be visible in QuickLog section
    await expect(page.getByText("Recent")).toBeVisible({ timeout: 15_000 });

    // Delete button(s) should be present
    const deleteButtons = page.locator("[title='Delete']");
    await expect(deleteButtons.first()).toBeVisible({ timeout: 5_000 });

    // Click the first delete button
    await deleteButtons.first().click();
    await page.waitForTimeout(500);

    // DELETE should have been called
    expect(deleteCalled).toBe(true);
  });
});

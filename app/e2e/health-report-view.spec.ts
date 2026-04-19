import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  mockHealthReport,
  MOCK_HEALTH_REPORT,
} from "./helpers";

/**
 * Health Report View Tests (pendingtests.md #41, #42, #43)
 *
 * Covers: report section rendering, share link controls, email send.
 */

// Full mock report matching the API response shape consumed by useHealthReport
const FULL_REPORT = {
  id: "report-full-123",
  status: "ready" as const,
  shareToken: "share-token-full-abc",
  data: {
    generatedAt: "2026-03-20T10:00:00Z",
    patientSummary: {
      age: 68,
      gender: "Male",
      coverageType: "Original Medicare",
      coverageParts: ["Part A", "Part B"],
    },
    redFlags: [
      {
        severity: "warning",
        title: "A1C screening overdue",
        detail: "Last A1C test was over 12 months ago",
        recommendation: "Schedule an A1C test with your doctor",
      },
    ],
    diabetesSection: {
      classification: "diabetic",
      findings: ["Type 2 diabetes diagnosed"],
      medicareBenefits: ["Annual A1C screening covered"],
      actionItems: ["Schedule follow-up with endocrinologist"],
    },
    obesitySection: {
      classification: "none",
      findings: [],
      medicareBenefits: [],
      actionItems: [],
    },
    conditionsSummary: [
      { name: "Type 2 Diabetes", severity: "red", isPrimary: true, note: "Active condition" },
      { name: "Hypertension", severity: "amber", isPrimary: false, note: "Managed with medication" },
    ],
    medicationReview: [
      { name: "Metformin", ndcCode: null, status: "Active — 30 day supply", concern: null },
    ],
    screeningStatus: [
      { type: "A1C Test", lastDate: "2025-06-15", isOverdue: true, medicareCoverage: "Covered annually" },
      { type: "Eye Exam", lastDate: "2025-01-10", isOverdue: true, medicareCoverage: "Covered annually" },
    ],
    dmeSupplies: null,
    careTeam: [
      { specialty: "Internal Medicine", hasVisited: true, recommendation: null },
    ],
    recentDenials: [],
    hospiceStatus: false,
    preDiabetesResources: null,
  } as Record<string, unknown> | null,
  created_at: "2026-03-20T10:00:00Z",
  expires_at: "2026-04-19T10:00:00Z",
};

async function setupReportPage(page: import("@playwright/test").Page) {
  await mockAuthenticatedUser(page);
  await mockFHIRData(page, true);
  await mockConsent(page, { health_data_ai: true });
  await mockDiabetesSnapshots(page);
}

test.describe("Health Report — View Renders Sections (#41)", () => {
  test("report view shows key sections when status is ready", async ({ page }) => {
    await setupReportPage(page);
    await mockHealthReport(page, FULL_REPORT);

    await page.goto("/app/health/report");

    // Main title
    await expect(page.getByText("Medicare Health Summary Report")).toBeVisible({
      timeout: 15_000,
    });

    // Red flags section
    await expect(page.getByText("Items Needing Attention")).toBeVisible();
    await expect(page.getByText("A1C screening overdue")).toBeVisible();

    // Diabetes section
    await expect(page.getByText("Diabetes Assessment")).toBeVisible();

    // Conditions section
    await expect(page.getByText("Conditions Overview")).toBeVisible();

    // Medication section
    await expect(page.getByText("Medication Review")).toBeVisible();
    await expect(page.getByText("Metformin")).toBeVisible();

    // Screenings section
    await expect(page.getByText("Screening Status")).toBeVisible();

    // Care team section
    await expect(page.getByText("Care Team")).toBeVisible();

    // Disclaimer footer (use .first() — text also appears in landing footer)
    await expect(
      page.getByText("This content is AI-generated and can have errors")
    ).toBeVisible();
  });
});

test.describe("Health Report — Share Link Controls (#42)", () => {
  test("share link and control buttons are visible on ready report", async ({ page }) => {
    await setupReportPage(page);
    await mockHealthReport(page, FULL_REPORT);

    await page.goto("/app/health/report");

    await expect(page.getByText("Medicare Health Summary Report")).toBeVisible({
      timeout: 15_000,
    });

    // Control buttons
    await expect(page.getByText("Share Link")).toBeVisible();
    await expect(page.getByText("Email Report")).toBeVisible();
    await expect(page.getByText("Download")).toBeVisible();
    await expect(page.getByText("Regenerate")).toBeVisible();
    await expect(page.getByText("Back to Health")).toBeVisible();
  });
});

test.describe("Health Report — Email Sends via POST (#43)", () => {
  test("clicking Email Report opens form and Send Email fires POST", async ({ page }) => {
    await setupReportPage(page);
    await mockHealthReport(page, FULL_REPORT);

    // Intercept email POST
    let emailPostBody: Record<string, unknown> | null = null;
    await page.route("**/api/health-report/email", (route) => {
      emailPostBody = route.request().postDataJSON();
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/app/health/report");

    await expect(page.getByText("Medicare Health Summary Report")).toBeVisible({
      timeout: 15_000,
    });

    // Click "Email Report" to open form
    await page.getByText("Email Report").click();

    // Fill in email
    const emailInput = page.getByPlaceholder("Recipient email");
    await expect(emailInput).toBeVisible({ timeout: 3_000 });
    await emailInput.fill("doctor@example.com");

    // Click Send Email
    await page.getByRole("button", { name: "Send Email" }).click();

    // Verify POST was sent
    await page.waitForTimeout(500);
    expect(emailPostBody).not.toBeNull();
    expect(emailPostBody!.reportId).toBe("report-full-123");
    expect(emailPostBody!.recipientEmail).toBe("doctor@example.com");
  });
});

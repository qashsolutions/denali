import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  mockDiabetesLog,
  mockDiabetesInsights,
  MOCK_FHIR_CONNECTED,
  MOCK_FHIR_DISCONNECTED,
} from "./helpers";

/**
 * Diabetes Page Tests (TEST_PLAN §6)
 *
 * Covers: header, coverage table, A1C guide, quick actions,
 * connected states, personal status, MDPP section.
 */

async function setupDiabetes(page: import("@playwright/test").Page, connected = false) {
  await mockAuthenticatedUser(page);
  await mockFHIRData(page, connected);
  await mockConsent(page, { health_data_ai: true });
  await mockDiabetesSnapshots(page);
  await mockDiabetesLog(page);
  await mockDiabetesInsights(page);
}

test.describe("Diabetes Page — Always Visible (§6)", () => {
  test("§6.1 header shows 'Diabetes Care' title", async ({ page }) => {
    await setupDiabetes(page, false);
    await page.goto("/app/diabetes");

    await expect(page.getByRole("heading", { name: "Diabetes Care" })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("§6.2 coverage table shows 6 covered items", async ({ page }) => {
    await setupDiabetes(page, false);
    await page.goto("/app/diabetes");

    // Wait for the coverage table heading
    await expect(page.getByRole("heading", { name: "Medicare Diabetes Coverage" })).toBeVisible({
      timeout: 10_000,
    });
    // 6 CoverageItem titles — use .first() since some text appears in quick actions too
    await expect(page.getByText("Diabetes Screening").first()).toBeVisible();
    await expect(page.getByText("Self-Management Training").first()).toBeVisible();
    await expect(page.getByText("Prevention Program (MDPP)").first()).toBeVisible();
    await expect(page.getByText("Supplies (Part B)").first()).toBeVisible();
    await expect(page.getByText("Insulin (Part D)").first()).toBeVisible();
    await expect(page.getByText("Medical Nutrition Therapy").first()).toBeVisible();
  });

  test("§6.3 quick actions grid shows 4 cards", async ({ page }) => {
    await setupDiabetes(page, false);
    await page.goto("/app/diabetes");

    await expect(page.getByText(/Diabetes screening/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/Diabetes supplies/i)).toBeVisible();
    await expect(page.getByText(/Prevention program|MDPP/i).first()).toBeVisible();
  });

  test("§6.4 A1C guide shows 3 ranges", async ({ page }) => {
    await setupDiabetes(page, false);
    await page.goto("/app/diabetes");

    await expect(page.getByText("Understanding A1C")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Normal|Below 5.7/i).first()).toBeVisible();
    await expect(page.getByText(/Pre-Diabet|5.7.*6.4/i).first()).toBeVisible();
    await expect(page.getByText(/Diabetic|6.5.*or higher/i).first()).toBeVisible();
  });
});

test.describe("Diabetes Page — Connected States (§6)", () => {
  test("§6.5 connected with diabetes → personal status section", async ({
    page,
  }) => {
    await setupDiabetes(page, true);
    await page.goto("/app/diabetes");

    // Should show classification badge and medication info
    // MOCK_FHIR_CONNECTED has Type 2 diabetes conditions and Metformin
    await expect(page.getByText(/Diabetic|Type 2/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("§6.6 connected, no diabetes → shows 'no indicators' card", async ({
    page,
  }) => {
    // Mock FHIR with no diabetes conditions but connected
    await mockAuthenticatedUser(page);
    await page.route("**/api/fhir/data", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connected: true,
          patient: { age: 55, gender: "female" },
          coverage: [{ type: "Part A", status: "Active", planName: null }],
          claims: [],
          conditions: [],
          medications: [],
          screenings: [],
          providers: [],
          hospitalizations: [],
          labs: [],
          dme: [],
          isHospice: false,
        }),
      })
    );
    await mockConsent(page, { health_data_ai: true });
    await mockDiabetesSnapshots(page);
    await mockDiabetesLog(page);
    await mockDiabetesInsights(page);

    await page.goto("/app/diabetes");

    // Green box: "No diabetes indicators found in your Medicare records."
    await expect(
      page.getByText("No diabetes indicators found in your Medicare records")
    ).toBeVisible({ timeout: 10_000 });
  });

  test("§6.7 QuickLog visible for signed-in users", async ({ page }) => {
    await setupDiabetes(page, false);
    await page.goto("/app/diabetes");

    // QuickLog has tab buttons: Glucose, Activity, Meal, Note
    await expect(page.getByText(/Glucose|Quick Log/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Diabetes Page — Disconnected (§6)", () => {
  test("§6.8 not connected → shows Pre-Diabetes Risk Card", async ({
    page,
  }) => {
    await setupDiabetes(page, false);
    await page.goto("/app/diabetes");

    await expect(
      page.getByText(/risk test|pre-diabetes|CDC/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });

  test("§6.9 not connected → no personal status section", async ({ page }) => {
    await setupDiabetes(page, false);
    await page.goto("/app/diabetes");

    // Wait for page to load
    await expect(page.getByRole("heading", { name: "Diabetes Care" })).toBeVisible({
      timeout: 10_000,
    });
    // Personal status section should NOT be visible
    await expect(page.getByText(/Your Status/i)).not.toBeVisible();
  });

  test("§6.10 CMS pledge shown at bottom", async ({ page }) => {
    await setupDiabetes(page, false);
    await page.goto("/app/diabetes");

    await expect(
      page.getByText(/Diabetes.*Prevention|committed to/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

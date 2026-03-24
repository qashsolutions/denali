import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  mockHealthReport,
  MOCK_FHIR_CONNECTED,
} from "./helpers";

/**
 * Health Hub Tests (TEST_PLAN §5)
 *
 * Covers: connected/disconnected states, accordion cards, status dots,
 * diabetes care card, obesity card, claims card, account card.
 */

// Helper: mock all required APIs for health page
async function setupHealthPage(page: import("@playwright/test").Page, connected = true) {
  await mockAuthenticatedUser(page);
  await mockFHIRData(page, connected);
  await mockConsent(page);
  await mockDiabetesSnapshots(page);
  // Mock health report API
  await page.route("**/api/health-report", (route) => {
    if (route.request().method() === "GET") {
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: null }),
      });
    }
    return route.continue();
  });
}

test.describe("Health Hub — Connected (§5)", () => {
  test("§5.1 connected state shows accordion cards", async ({ page }) => {
    await setupHealthPage(page, true);
    await page.goto("/app/health");

    // Should see at least Coverage Status and Claims & Providers (always visible)
    await expect(page.getByText("Coverage Status")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Claims & Providers")).toBeVisible();
    await expect(page.getByText("Medicare Account")).toBeVisible();
  });

  test("§5.2 Coverage Status card shows Part A & Part B", async ({ page }) => {
    await setupHealthPage(page, true);
    await page.goto("/app/health");

    await expect(page.getByText("Coverage Status")).toBeVisible({ timeout: 10_000 });
    // Summary should mention active coverage
    await expect(page.getByText(/Part A|Part B|active/i)).toBeVisible();
  });

  test("§5.3 Diabetes Care card visible with diabetes conditions", async ({ page }) => {
    await setupHealthPage(page, true);
    await page.goto("/app/health");

    // MOCK_FHIR_CONNECTED has E11.65 (Type 2 diabetes) in conditions
    // "Diabetes Care" appears in both the card title and a risk alert — use the button/card
    await expect(page.getByRole("button", { name: /Diabetes Care/i })).toBeVisible({ timeout: 10_000 });
  });

  test("§5.4 Health Conditions card visible with conditions", async ({ page }) => {
    await setupHealthPage(page, true);
    await page.goto("/app/health");

    await expect(page.getByText("Health Conditions")).toBeVisible({ timeout: 10_000 });
  });

  test("§5.5 Claims & Providers card shows claim count", async ({ page }) => {
    await setupHealthPage(page, true);
    await page.goto("/app/health");

    await expect(page.getByText("Claims & Providers")).toBeVisible({ timeout: 10_000 });
    // Summary shows "N claims · N providers" pattern
    await expect(page.getByText(/\d+ claims?/i).first()).toBeVisible();
  });

  test("§5.6 clicking card expands content", async ({ page }) => {
    await setupHealthPage(page, true);
    await page.goto("/app/health");

    const coverageCard = page.getByText("Coverage Status");
    await expect(coverageCard).toBeVisible({ timeout: 10_000 });

    // Click to expand
    await coverageCard.click();
    // After expansion, should see coverage details
    await expect(page.getByText(/Part A|Part B|Active/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test("§5.7 Blue Button attribution visible when connected", async ({ page }) => {
    await setupHealthPage(page, true);
    await page.goto("/app/health");

    await expect(page.getByText("Coverage Status")).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByText(/not endorsed or certified by CMS/i)
    ).toBeVisible();
  });

  test("§5.8 Needs Attention card shows for denied claims", async ({ page }) => {
    await setupHealthPage(page, true);
    await page.goto("/app/health");

    // MOCK_FHIR_CONNECTED has claim-2 with status "Denied"
    await expect(page.getByText("Needs Attention")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/denied/i).first()).toBeVisible();
  });
});

test.describe("Health Hub — Disconnected (§5)", () => {
  test("§5.9 disconnected shows Connect Medicare", async ({ page }) => {
    await setupHealthPage(page, false);
    await page.goto("/app/health");

    // h2 heading says "Connect Your Medicare"
    await expect(page.getByRole("heading", { name: /Connect.*Medicare/i })).toBeVisible({
      timeout: 10_000,
    });
  });

  test("§5.10 disconnected does NOT show accordion cards", async ({ page }) => {
    await setupHealthPage(page, false);
    await page.goto("/app/health");

    await expect(page.getByRole("heading", { name: /Connect.*Medicare/i })).toBeVisible({
      timeout: 10_000,
    });
    // Accordion cards should not be visible
    await expect(page.getByText("Coverage Status")).not.toBeVisible();
    await expect(page.getByText("Claims & Providers")).not.toBeVisible();
  });
});

test.describe("Health Hub — Unauthenticated (§5)", () => {
  test("§5.11 unauthenticated user sees health page header", async ({ page }) => {
    await mockUnauthenticatedUser(page);
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);
    await page.route("**/api/health-report", (route) =>
      route.fulfill({ status: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ report: null }) })
    );
    await page.goto("/app/health");

    // Should still see the page (not redirected)
    await expect(page.getByText(/My Health|Connect Medicare/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

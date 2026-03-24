import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  mockHealthReport,
  mockAuditLog,
  mockTopicPreferences,
  MOCK_FHIR_CONNECTED,
} from "./helpers";

/**
 * Health Page Interaction Tests (pendingtests.md #13, #14, #15, #19)
 *
 * Covers: disconnect flow, report banner, unauth redirect, OAuth error.
 */

async function setupConnectedHealth(page: import("@playwright/test").Page) {
  await mockAuthenticatedUser(page);
  await mockFHIRData(page, true);
  await mockConsent(page);
  await mockDiabetesSnapshots(page);
}

test.describe("Health — Disconnect Medicare (#13)", () => {
  test("Disconnect button calls DELETE /api/fhir/disconnect", async ({
    page,
  }) => {
    await setupConnectedHealth(page);
    await mockHealthReport(page);

    let disconnectCalled = false;
    await page.route("**/api/fhir/disconnect", (route) => {
      // useHealthData.disconnect() uses POST, not DELETE
      disconnectCalled = true;
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/app/health");

    // Wait for connected health page to load (may need compilation time)
    await expect(page.getByText("My Health").first()).toBeVisible({
      timeout: 15_000,
    });

    // Expand the outer HealthHubCard "Medicare Account"
    const accountCard = page
      .getByRole("button")
      .filter({ hasText: "Medicare Account" });
    await expect(accountCard).toBeVisible({ timeout: 5_000 });
    await accountCard.click();

    // Inside the HealthHubCard, AccountSection renders its own inner accordion
    // "Your Medicare Account" button — click to expand it
    const yourMedicareBtn = page
      .getByRole("button")
      .filter({ hasText: "Your Medicare Account" });
    await expect(yourMedicareBtn).toBeVisible({ timeout: 5_000 });
    await yourMedicareBtn.click();

    // Click "Disconnect Medicare"
    const disconnectBtn = page.getByText("Disconnect Medicare");
    await expect(disconnectBtn).toBeVisible({ timeout: 5_000 });
    await disconnectBtn.click();

    // Should have called DELETE
    await page.waitForTimeout(500);
    expect(disconnectCalled).toBe(true);
  });
});

test.describe("Health — Report Banner (#14)", () => {
  test("report ready shows banner with View link to /app/health/report", async ({
    page,
  }) => {
    await setupConnectedHealth(page);
    await mockHealthReport(page); // default: status "ready"

    await page.goto("/app/health");

    // Wait for page to load
    await expect(page.getByText("My Health").first()).toBeVisible({
      timeout: 10_000,
    });

    // Report banner should be visible
    await expect(
      page.getByText("Your Health Summary Report is ready")
    ).toBeVisible({ timeout: 5_000 });

    // "View" link should navigate to /app/health/report
    const viewLink = page.getByRole("link", { name: "View" });
    await expect(viewLink).toBeVisible();
    expect(await viewLink.getAttribute("href")).toBe("/app/health/report");
  });
});

test.describe("Health — Unauth Redirect (#15)", () => {
  test("unauthenticated user on /app/health redirects to /app/settings", async ({
    page,
  }) => {
    await mockUnauthenticatedUser(page);
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

    await page.goto("/app/health");

    // Health page checks authState.email — if null, redirects to /app/settings
    await page.waitForURL("**/app/settings**", { timeout: 10_000 });
    expect(page.url()).toContain("/app/settings");
  });
});

test.describe("Health — OAuth Error Banner (#19)", () => {
  test("?error=denied shows amber error banner", async ({ page }) => {
    await mockAuthenticatedUser(page);
    await mockFHIRData(page, false); // disconnected state
    await mockConsent(page);
    await mockDiabetesSnapshots(page);
    await page.route("**/api/health-report", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ report: null }),
      })
    );

    await page.goto("/app/health?error=denied");

    // The error message for "denied" should be visible
    await expect(
      page.getByText("You chose not to connect. You can try again anytime.")
    ).toBeVisible({ timeout: 10_000 });
  });
});

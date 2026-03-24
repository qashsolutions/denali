import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  mockAuditLog,
  mockTopicPreferences,
} from "./helpers";

/**
 * Settings Page Tests (TEST_PLAN §4)
 *
 * Covers: account section, subscription, appearance, accessibility,
 * consent toggles, topic preferences, audit log, danger zone.
 */

async function setupSettings(page: import("@playwright/test").Page, overrides = {}) {
  await mockAuthenticatedUser(page, overrides);
  await mockFHIRData(page, false);
  await mockConsent(page);
  await mockDiabetesSnapshots(page);
  await mockAuditLog(page);
  await mockTopicPreferences(page);
}

test.describe("Settings — Account (§4.1)", () => {
  test("§4.1.1 shows user email", async ({ page }) => {
    await setupSettings(page, { email: "alice@example.com" });
    await page.goto("/app/settings");

    await expect(page.getByText("alice@example.com")).toBeVisible({ timeout: 10_000 });
  });

  test("§4.1.2 shows plan name", async ({ page }) => {
    await setupSettings(page, { plan: "starter" });
    await page.goto("/app/settings");

    await expect(page.getByText(/Starter/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test("§4.1.3 shows trial status for trial users", async ({ page }) => {
    await setupSettings(page, { plan: "trial" });
    await page.goto("/app/settings");

    await expect(page.getByText(/trial|days remaining/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Settings — Appearance & Accessibility (§4.2)", () => {
  test("§4.2.1 theme toggle visible", async ({ page }) => {
    await setupSettings(page);
    await page.goto("/app/settings");

    await expect(page.getByText(/Appearance|Theme/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("§4.2.2 text size option visible", async ({ page }) => {
    await setupSettings(page);
    await page.goto("/app/settings");

    await expect(page.getByText(/Text Size|Accessibility/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Settings — Privacy & Data (§4.3)", () => {
  test("§4.3.1 three consent toggles visible", async ({ page }) => {
    await setupSettings(page);
    await page.goto("/app/settings");

    // All three toggles should be present
    await expect(page.getByText(/Health Data.*AI|Share.*health.*AI/i).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText(/Health Data.*Storage|Store.*health/i).first()).toBeVisible();
    await expect(page.getByText(/Analytics/i).first()).toBeVisible();
  });

  test("§4.3.2 consent toggles default to OFF", async ({ page }) => {
    await setupSettings(page);
    await page.goto("/app/settings");

    // All toggles with role="switch" should be unchecked by default
    const switches = page.getByRole("switch");
    await expect(switches.first()).toBeVisible({ timeout: 10_000 });
    // Default consent is all false, so switches should show unchecked
    const count = await switches.count();
    for (let i = 0; i < count; i++) {
      const checked = await switches.nth(i).getAttribute("aria-checked");
      expect(checked).toBe("false");
    }
  });
});

test.describe("Settings — Topic Preferences (§4.4)", () => {
  test("§4.4.1 topic preference options visible", async ({ page }) => {
    await setupSettings(page);
    await page.goto("/app/settings");

    await expect(page.getByText(/Content Preferences|Topics/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

test.describe("Settings — Data Access History (§4.5)", () => {
  test("§4.5.1 audit log section visible", async ({ page }) => {
    await setupSettings(page);
    await page.goto("/app/settings");

    await expect(
      page.getByText(/Data Access History|Activity Log/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Settings — Danger Zone (§4.6)", () => {
  test("§4.6.1 delete account button visible", async ({ page }) => {
    await setupSettings(page);
    await page.goto("/app/settings");

    await expect(page.getByText(/Delete.*Account/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("§4.6.2 delete requires 2-step confirmation", async ({ page }) => {
    await setupSettings(page);
    await page.goto("/app/settings");

    // First click should show confirmation prompt, not immediately delete
    const deleteButton = page.getByText(/Delete.*Account/i).first();
    await expect(deleteButton).toBeVisible({ timeout: 10_000 });
    await deleteButton.click();

    // Should see confirmation text
    await expect(
      page.getByText(/confirm|are you sure|permanently/i).first()
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Settings — Unauthenticated (§4.7)", () => {
  test("§4.7.1 unauthenticated user sees sign-in option", async ({ page }) => {
    await mockUnauthenticatedUser(page);
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);
    await mockAuditLog(page);
    await mockTopicPreferences(page);
    await page.goto("/app/settings");

    // Should see sign-in / email OTP option
    await expect(
      page.getByText(/Sign in|Email|Get started/i).first()
    ).toBeVisible({ timeout: 10_000 });
  });
});

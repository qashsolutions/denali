import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockUnauthenticatedUser,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
} from "./helpers";

/**
 * Navigation Tests (TEST_PLAN §9)
 *
 * Covers: nav links, bottom tabs, mobile hamburger, page routing.
 */

async function setupNav(page: import("@playwright/test").Page) {
  await mockAuthenticatedUser(page);
  await mockFHIRData(page, false);
  await mockConsent(page);
  await mockDiabetesSnapshots(page);
  await page.route("**/api/health-report", (route) =>
    route.fulfill({ status: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ report: null }) })
  );
}

test.describe("Navigation — Desktop (§9)", () => {
  test("§9.1 AppHeader shows nav links for authenticated user", async ({
    page,
  }) => {
    await setupNav(page);
    await page.goto("/app/chat");

    // Desktop nav links (within the navigation landmark)
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav.getByRole("link", { name: /MyHealth/i })).toBeVisible({
      timeout: 10_000,
    });
    await expect(nav.getByRole("link", { name: /Ask Denali/i })).toBeVisible();
    await expect(nav.getByRole("link", { name: /Blog/i })).toBeVisible();
  });

  test("§9.2 clicking Health nav navigates to /app/health", async ({
    page,
  }) => {
    await setupNav(page);
    await page.goto("/app/chat");

    const nav = page.getByRole("navigation", { name: "Main navigation" });
    const healthLink = nav.getByRole("link", { name: /MyHealth/i });
    await expect(healthLink).toBeVisible({ timeout: 10_000 });
    await healthLink.click();

    await expect(page).toHaveURL(/\/app\/health/);
  });

  test("§9.3 account gear icon visible for authenticated user", async ({
    page,
  }) => {
    await setupNav(page);
    await page.goto("/app/chat");

    await expect(
      page.getByRole("button", { name: /Account|Settings|menu/i })
    ).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Navigation — Public Pages (§9)", () => {
  test("§9.4 landing page accessible without auth", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Denali|Medicare/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("§9.5 blog page accessible without auth", async ({ page }) => {
    await page.goto("/blog");
    await expect(page).toHaveURL(/\/blog/);
  });

  test("§9.6 FAQ page accessible without auth", async ({ page }) => {
    await page.goto("/faq");
    await expect(page.getByText(/FAQ|Frequently Asked/i).first()).toBeVisible({
      timeout: 10_000,
    });
  });
});

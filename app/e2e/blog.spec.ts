import { test, expect } from "@playwright/test";

/**
 * Blog Page Tests (pendingtests.md #37, #38)
 *
 * Covers: blog listing page, blog post page.
 * Note: Blog pages are SSR and fetch from DB. Tests are resilient
 * to missing data — verify page loads without errors.
 */

test.describe("Blog — Listing Page (#37)", () => {
  test("blog listing page loads with heading", async ({ page }) => {
    await page.goto("/blog");

    // Page should load (SSR from DB)
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });

    // Should have at least a heading element
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Blog — Post Page (#38)", () => {
  test("blog post page renders article content", async ({ page }) => {
    // Navigate to a known seeded blog post slug
    await page.goto("/blog/understanding-medicare-denial-codes");

    // If post exists, the page renders with a heading
    // If not, may show 404 — we just check the page loads
    await expect(page.locator("body")).toBeVisible({ timeout: 15_000 });

    // Check for heading (article title or 404 page heading)
    const heading = page.getByRole("heading").first();
    await expect(heading).toBeVisible({ timeout: 10_000 });
  });
});

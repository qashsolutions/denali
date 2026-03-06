import { test, expect } from "@playwright/test";

/**
 * Public Page Rendering Tests
 *
 * Verifies that public pages (no auth required) render correctly
 * with expected content. These are real pages, no mocks.
 */

test.describe("Landing page", () => {
  test("renders hero section with CTA", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Tailored guidance/i })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Try It Free")).toBeVisible();
  });

  test("renders pricing section with 4 plans", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Simple, Transparent Pricing")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByText("Free Trial")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Starter" })).toBeVisible();
    await expect(page.getByText("$20")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Unlimited" })
    ).toBeVisible();
  });

  test("pricing cards show accurate features", async ({ page }) => {
    await page.goto("/");
    // Verify key truthful claims exist
    await expect(
      page.getByText("Coverage, diabetes & obesity guidance").first()
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("10 messages per day")).toBeVisible();
    await expect(
      page.getByText("Appeal letters with citations").first()
    ).toBeVisible();
    // Verify false claims do NOT exist
    await expect(page.getByText("Priority coverage guidance")).not.toBeVisible();
    await expect(
      page.getByText("Full diabetes & obesity coaching")
    ).not.toBeVisible();
  });
});

test.describe("Legal pages", () => {
  test("FAQ page renders with search and sections", async ({ page }) => {
    await page.goto("/faq");
    await expect(
      page.getByRole("heading", { name: "Frequently Asked Questions" })
    ).toBeVisible({ timeout: 10_000 });
    await expect(
      page.getByPlaceholder(/Search FAQs/)
    ).toBeVisible();
    await expect(page.getByText("Data Privacy & Security")).toBeVisible();
    await expect(page.getByText("Trial & Pricing")).toBeVisible();
  });

  test("Terms page renders with table of contents", async ({ page }) => {
    await page.goto("/terms");
    await expect(
      page.getByRole("heading", { name: "Terms of Service" })
    ).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Contents")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Service Description/ })
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /Payment Terms/ })
    ).toBeVisible();
  });

  test("Privacy page renders", async ({ page }) => {
    await page.goto("/privacy");
    await expect(
      page.getByRole("heading", { name: "Privacy Policy" })
    ).toBeVisible({ timeout: 10_000 });
  });
});

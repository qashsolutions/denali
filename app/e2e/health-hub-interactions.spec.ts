import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  mockHealthReport,
  MOCK_FHIR_CONNECTED,
} from "./helpers";

/**
 * Health Hub Interaction Tests (pendingtests.md #21, #22, #23, #24)
 *
 * Covers: accordion expand, Needs Attention card, Diabetes Care conditional,
 * Weight Management conditional.
 */

async function setupConnectedHealth(
  page: import("@playwright/test").Page,
  fhirOverrides?: Record<string, unknown>
) {
  await mockAuthenticatedUser(page);
  if (fhirOverrides) {
    await page.route("**/api/fhir/data", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...MOCK_FHIR_CONNECTED, ...fhirOverrides }),
      })
    );
  } else {
    await mockFHIRData(page, true);
  }
  await mockConsent(page);
  await mockDiabetesSnapshots(page);
  await mockHealthReport(page);
}

test.describe("Health Hub — Coverage Accordion (#21)", () => {
  test("clicking Coverage Status expands to show coverage details", async ({
    page,
  }) => {
    await setupConnectedHealth(page);
    await page.goto("/app/health");

    await expect(page.getByText("My Health").first()).toBeVisible({
      timeout: 15_000,
    });

    // Coverage Status card header
    const coverageBtn = page
      .getByRole("button")
      .filter({ hasText: "Coverage Status" });
    await expect(coverageBtn).toBeVisible({ timeout: 5_000 });
    await coverageBtn.click();

    // Expanded content should show Part A and Part B coverage
    await expect(page.getByText("Part A").first()).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText("Part B").first()).toBeVisible();
  });
});

test.describe("Health Hub — Needs Attention (#22)", () => {
  test("Needs Attention card appears with denied claim summary", async ({
    page,
  }) => {
    await setupConnectedHealth(page);
    await page.goto("/app/health");

    await expect(page.getByText("My Health").first()).toBeVisible({
      timeout: 15_000,
    });

    // Needs Attention should be visible (auto-expanded) — MOCK_FHIR_CONNECTED has 1 denied claim
    const needsAttention = page
      .getByRole("button")
      .filter({ hasText: "Needs Attention" });
    await expect(needsAttention).toBeVisible({ timeout: 5_000 });

    // Summary text should mention denied claim
    await expect(page.getByText(/denied claim/i).first()).toBeVisible();
  });
});

test.describe("Health Hub — Diabetes Card (#23)", () => {
  test("Diabetes Care card visible when diabetes conditions present", async ({
    page,
  }) => {
    await setupConnectedHealth(page);
    await page.goto("/app/health");

    await expect(page.getByText("My Health").first()).toBeVisible({
      timeout: 15_000,
    });

    // Diabetes Care card should be visible (E11.65 = type2 in conditions)
    const diabetesCard = page
      .getByRole("button")
      .filter({ hasText: "Diabetes Care" });
    await expect(diabetesCard).toBeVisible({ timeout: 5_000 });
  });

  test("Diabetes Care card hidden when no diabetes conditions", async ({
    page,
  }) => {
    await setupConnectedHealth(page, {
      conditions: [
        { code: "I10", name: "Essential hypertension", category: "other" },
      ],
    });
    await page.goto("/app/health");

    await expect(page.getByText("My Health").first()).toBeVisible({
      timeout: 15_000,
    });

    // Diabetes Care card should NOT be visible
    const diabetesCard = page
      .getByRole("button")
      .filter({ hasText: "Diabetes Care" });
    await expect(diabetesCard).not.toBeVisible({ timeout: 3_000 });
  });
});

test.describe("Health Hub — Obesity Card (#24)", () => {
  test("Weight Management card visible when obesity conditions present", async ({
    page,
  }) => {
    await setupConnectedHealth(page, {
      conditions: [
        ...MOCK_FHIR_CONNECTED.conditions,
        {
          code: "E66.01",
          name: "Morbid (severe) obesity due to excess calories",
          category: "obesity",
        },
      ],
    });
    await page.goto("/app/health");

    await expect(page.getByText("My Health").first()).toBeVisible({
      timeout: 15_000,
    });

    // Weight Management card should be visible
    const obesityCard = page
      .getByRole("button")
      .filter({ hasText: "Weight Management" });
    await expect(obesityCard).toBeVisible({ timeout: 5_000 });
  });
});

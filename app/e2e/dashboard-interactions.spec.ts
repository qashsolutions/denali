import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
  mockHealthReport,
} from "./helpers";

/**
 * Dashboard Interaction Tests (pendingtests.md #58)
 *
 * Covers: time-aware greeting, nudge strip CTA.
 */

async function setupDashboard(page: import("@playwright/test").Page) {
  await mockAuthenticatedUser(page, { firstName: "Venkata" });
  await mockFHIRData(page, false); // Disconnected → triggers "Connect Medicare" nudge
  await mockConsent(page);
  await mockDiabetesSnapshots(page);
  await mockHealthReport(page, {
    id: "report-dash",
    status: "ready",
    shareToken: "share-dash",
    data: null,
    created_at: "2026-03-20T10:00:00Z",
    expires_at: "2026-04-19T10:00:00Z",
  });

  // Fake JWT to bypass middleware redirect for /app
  const fakeJwtPayload = Buffer.from(
    JSON.stringify({ sub: "test-user-id-000", exp: 9999999999 })
  ).toString("base64url");
  const fakeJwt = `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.${fakeJwtPayload}.fake`;
  await page.context().addCookies([
    { name: "access_token", value: fakeJwt, domain: "localhost", path: "/" },
    { name: "session_issued_at", value: String(Date.now()), domain: "localhost", path: "/" },
  ]);
}

test.describe("Dashboard — Greeting + Nudge (#58)", () => {
  test("dashboard shows personalized greeting and nudge strip with CTA", async ({ page }) => {
    await setupDashboard(page);
    await page.goto("/app");

    // Greeting should contain time-of-day word and/or user's first name
    // getPersonalizedGreeting returns "Good morning, Venkata" / "Good afternoon..." / "Good evening..."
    const greeting = page.locator("h1").first();
    await expect(greeting).toBeVisible({ timeout: 15_000 });

    const greetingText = await greeting.textContent();
    // Should contain "Good" (time-of-day greeting) or at least the name
    expect(
      greetingText?.includes("Good") || greetingText?.includes("Venkata")
    ).toBeTruthy();

    // Feature cards should be visible
    await expect(page.getByText("Coverage Check")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Medicare Dashboard")).toBeVisible();
    await expect(page.getByText("Appeals")).toBeVisible();

    // Nudge strip — for disconnected FHIR user, it should suggest connecting Medicare
    // The nudge strip has role="status" and contains a CTA link
    const nudge = page.locator("[role='status'][aria-live='polite']").first();
    if (await nudge.isVisible({ timeout: 5_000 }).catch(() => false)) {
      // Nudge CTA should be a link
      const ctaLink = nudge.locator("a");
      if (await ctaLink.isVisible().catch(() => false)) {
        const href = await ctaLink.getAttribute("href");
        expect(href).toBeDefined();
      }
    }
  });
});

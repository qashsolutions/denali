import { test, expect } from "@playwright/test";
import {
  mockAuthenticatedUser,
  mockFHIRData,
  mockConsent,
  mockDiabetesSnapshots,
} from "./helpers";

/**
 * Dashboard Tests (pendingtests.md #40)
 *
 * Covers: authenticated dashboard home page with feature cards.
 * Note: /app is middleware-gated — requires valid access_token cookie.
 */

test.describe("Dashboard — Home Page (#40)", () => {
  test("authenticated user sees feature cards", async ({ page }) => {
    await mockAuthenticatedUser(page);
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

    // Fake JWT to bypass middleware redirect for /app
    const fakeJwtPayload = Buffer.from(
      JSON.stringify({ sub: "test-user-id-000", exp: 9999999999 })
    ).toString("base64url");
    const fakeJwt = `eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.${fakeJwtPayload}.fake`;

    await page.context().addCookies([
      { name: "access_token", value: fakeJwt, domain: "localhost", path: "/" },
      { name: "session_issued_at", value: String(Date.now()), domain: "localhost", path: "/" },
    ]);

    await page.goto("/app");

    // Feature cards should be visible
    await expect(page.getByText("Coverage Check")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Medicare Dashboard")).toBeVisible();
    await expect(page.getByText("Appeals")).toBeVisible();
  });
});

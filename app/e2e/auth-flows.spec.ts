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
 * Auth Flow Tests (pendingtests.md #1, #2, #3)
 *
 * Covers: Email OTP sign-in, sign-out, account deletion.
 */

async function setupUnauthSettings(page: import("@playwright/test").Page) {
  await mockUnauthenticatedUser(page);
  await mockFHIRData(page, false);
  await mockConsent(page);
  await mockDiabetesSnapshots(page);
  await mockAuditLog(page);
  await mockTopicPreferences(page);
}

async function setupAuthSettings(
  page: import("@playwright/test").Page,
  overrides = {}
) {
  await mockAuthenticatedUser(page, overrides);
  await mockFHIRData(page, false);
  await mockConsent(page);
  await mockDiabetesSnapshots(page);
  await mockAuditLog(page);
  await mockTopicPreferences(page);
}

test.describe("Auth — Email OTP Sign-In (#1)", () => {
  test("send OTP shows code input on success", async ({ page }) => {
    await setupUnauthSettings(page);

    // Mock send-otp endpoint
    await page.route("**/api/auth/send-otp", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true }),
      })
    );

    await page.goto("/app/settings");

    // Fill email
    const emailInput = page.locator("#email-input");
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await emailInput.fill("alice@example.com");

    // Click Send Code
    await page.getByRole("button", { name: "Send Code" }).click();

    // OTP input should appear
    await expect(page.locator("#otp-input")).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText("Check your email for a verification code.")).toBeVisible();
  });

  test("verify OTP transitions to authenticated state", async ({ page }) => {
    // Manually set up routes — don't use setupUnauthSettings to avoid handler conflicts
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);
    await mockAuditLog(page);
    await mockTopicPreferences(page);

    // Profile handler: unauthenticated initially. verifyEmailOTP sets authState.email
    // directly from its response, so the component switches to authenticated view
    // without needing the profile to return authenticated.
    await page.route("**/api/profile", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: null,
          plan: null,
          role: null,
          is_admin: false,
          appeal_count: 0,
          appeal_credits: 0,
        }),
      })
    );
    await page.route("**/api/conversations", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([]),
      })
    );

    // Mock send-otp
    await page.route("**/api/auth/send-otp", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true }),
      })
    );

    // Mock verify-otp — useAuth sets authState.email = email directly from this
    await page.route("**/api/auth/verify-otp", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          success: true,
          user: { userId: "test-uid-123" },
        }),
      })
    );

    // Mock trial + MFA (called by loadProfileData after verify)
    await page.route("**/api/trial", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active", daysRemaining: 14 }),
      })
    );
    await page.route("**/api/auth/mfa/status", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrolled: false }),
      })
    );

    await page.goto("/app/settings");

    // Step 1: Send code
    const emailInput = page.locator("#email-input");
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await emailInput.fill("alice@example.com");
    await page.getByRole("button", { name: "Send Code" }).click();
    await expect(page.locator("#otp-input")).toBeVisible({ timeout: 5_000 });

    // Step 2: Enter OTP and verify
    await page.locator("#otp-input").fill("123456");
    await page.getByRole("button", { name: "Verify" }).click();

    // After verify, useAuth sets authState.email directly → component shows authenticated view
    // Assert: email visible + Sign Out button appears
    await expect(page.getByText("alice@example.com")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible();
  });

  test("failed OTP send shows error", async ({ page }) => {
    await setupUnauthSettings(page);

    // Return 400 — sendEmailOTP checks res.ok (HTTP status), not body
    await page.route("**/api/auth/send-otp", (route) =>
      route.fulfill({
        status: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Invalid email" }),
      })
    );

    await page.goto("/app/settings");

    const emailInput = page.locator("#email-input");
    await expect(emailInput).toBeVisible({ timeout: 10_000 });
    await emailInput.fill("alice@example.com");
    await page.getByRole("button", { name: "Send Code" }).click();

    // Settings page shows "Failed to send code. Try again." on sendEmailOTP returning false
    await expect(
      page.getByText("Failed to send code. Try again.")
    ).toBeVisible({ timeout: 5_000 });
  });
});

test.describe("Auth — Sign Out (#2)", () => {
  test("sign-out button calls signout API and shows sign-in form", async ({
    page,
  }) => {
    // Set up auth settings first (registers profile handler returning authenticated)
    await mockFHIRData(page, false);
    await mockConsent(page);
    await mockDiabetesSnapshots(page);
    await mockAuditLog(page);
    await mockTopicPreferences(page);

    // Flag-based profile handler: returns authenticated until sign-out, then unauthenticated
    let signedOut = false;
    await page.route("**/api/profile", (route) => {
      if (signedOut) {
        return route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: null,
            plan: null,
            role: null,
            is_admin: false,
            appeal_count: 0,
            appeal_credits: 0,
          }),
        });
      }
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authenticated: true,
          userId: "test-user-id-000",
          email: "bob@example.com",
          plan: "trial",
          role: null,
          is_admin: false,
          isAdmin: false,
          appeal_count: 0,
          appeal_credits: 0,
          appealCount: 0,
          appealCredits: 0,
        }),
      });
    });

    await page.route("**/api/conversations", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([]),
      })
    );

    await page.route("**/api/trial", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active", daysRemaining: 10 }),
      })
    );

    await page.route("**/api/auth/mfa/status", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrolled: false }),
      })
    );

    let signoutCalled = false;
    await page.route("**/api/auth/signout", (route) => {
      signoutCalled = true;
      signedOut = true;
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto("/app/settings");

    // Should see authenticated state
    await expect(page.getByText("bob@example.com")).toBeVisible({
      timeout: 10_000,
    });

    // Click sign out — settings page calls signOut() then router.push("/app")
    // Middleware redirects /app → / (landing page) for unauthenticated users
    await page.getByRole("button", { name: "Sign Out" }).click();

    // Verify signout API was called and we navigated away from settings
    await page.waitForTimeout(1000);
    expect(signoutCalled).toBe(true);
    // After sign-out, user is redirected away from settings
    // (middleware sends /app → / for anon users, or settings re-renders with sign-in form)
    const url = page.url();
    const noLongerOnAuthSettings =
      !url.includes("/app/settings") || // navigated away
      (await page.getByText("Sign in with email").isVisible().catch(() => false)); // or sign-in form showed
    expect(noLongerOnAuthSettings).toBe(true);
  });
});

test.describe("Auth — Account Delete (#3)", () => {
  test("2-step delete calls DELETE /api/account/delete", async ({ page }) => {
    await setupAuthSettings(page, { email: "delete-me@example.com" });

    let deleteCalled = false;
    await page.route("**/api/account/delete", (route) => {
      if (route.request().method() === "DELETE") {
        deleteCalled = true;
        return route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ success: true }),
        });
      }
      return route.continue();
    });

    // After delete, sign-out is called → profile reverts
    await page.route("**/api/auth/signout", (route) =>
      route.fulfill({
        status: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true }),
      })
    );

    await page.goto("/app/settings");

    // Step 1: Click Delete in Danger Zone
    const deleteButton = page
      .getByText(/Delete.*Account/i)
      .first();
    await expect(deleteButton).toBeVisible({ timeout: 10_000 });
    // The "Delete" button in the default state
    await page
      .locator("section")
      .filter({ hasText: "Danger Zone" })
      .getByRole("button", { name: "Delete" })
      .click();

    // Step 2: Confirmation should appear
    await expect(
      page.getByText(/Are you sure.*permanently delete/i)
    ).toBeVisible({ timeout: 5_000 });

    // Step 3: Click confirm
    await page
      .getByRole("button", { name: /Yes, Delete Everything/i })
      .click();

    // DELETE should have been called
    await page.waitForTimeout(500);
    expect(deleteCalled).toBe(true);
  });
});

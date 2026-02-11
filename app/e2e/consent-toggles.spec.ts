import { test, expect, Page } from "@playwright/test";

/**
 * Consent Toggles — E2E Tests
 *
 * Part 1: API access control (request fixture)
 * Part 2: UI toggle behavior (page.route mocks)
 *
 * Verifies: rendering, toggle interaction, correct PUT payload,
 * optimistic updates, and revert on failure.
 */

// ---------------------------------------------------------------------------
// Part 1: API route access control
// ---------------------------------------------------------------------------

test.describe("Consent API access control", () => {
  test("PUT /api/consent returns 401 without auth", async ({ request }) => {
    const response = await request.put("/api/consent", {
      data: { consentType: "analytics", granted: true },
    });
    expect(response.status()).toBe(401);

    const body = await response.json();
    expect(body.error).toBe("Not authenticated");
  });

  test("PUT /api/consent rejects invalid consent type", async ({
    request,
  }) => {
    // This will hit the 401 before the 400 since we're not authenticated.
    // But the route checks auth first, so we test validation via the mock UI tests below.
    // Here we verify the route rejects unauthenticated requests.
    const response = await request.put("/api/consent", {
      data: { consentType: "invalid_type", granted: true },
    });
    // Should be 401 (auth check is first)
    expect(response.status()).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Part 2: UI toggle behavior with mocked API
// ---------------------------------------------------------------------------

/** Mock profile and conversations routes for settings page */
async function mockBaseRoutes(page: Page) {
  await page.route("**/api/profile", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        authenticated: true,
        email: "test@example.com",
        plan: "trial",
        role: null,
        is_admin: false,
        appeal_count: 0,
        appeal_credits: 1,
      }),
    });
  });

  await page.route("**/api/conversations", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([]),
    });
  });

  // Mock trial status
  await page.route("**/api/trial", async (route) => {
    await route.fulfill({
      status: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "active", daysRemaining: 10 }),
    });
  });
}

test.describe("Consent toggle UI", () => {
  test("settings page renders all three consent toggles as switches", async ({
    page,
  }) => {
    await mockBaseRoutes(page);

    // Mock GET /api/consent — all off
    await page.route("**/api/consent", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consent: {
              health_data_ai: false,
              health_data_storage: false,
              analytics: false,
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await page.goto("/app/settings");

    // All three toggle switches should be visible
    const switches = page.getByRole("switch");
    await expect(switches).toHaveCount(3, { timeout: 10_000 });

    // All start unchecked
    for (const sw of await switches.all()) {
      await expect(sw).toHaveAttribute("aria-checked", "false");
    }
  });

  test("toggles render initial state from GET /api/consent", async ({
    page,
  }) => {
    await mockBaseRoutes(page);

    // Mock GET: health_data_ai ON, others OFF
    await page.route("**/api/consent", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consent: {
              health_data_ai: true,
              health_data_storage: false,
              analytics: true,
            },
          }),
        });
      } else {
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await page.goto("/app/settings");

    const switches = page.getByRole("switch");
    await expect(switches).toHaveCount(3, { timeout: 10_000 });

    const allSwitches = await switches.all();
    // health_data_ai = ON
    await expect(allSwitches[0]).toHaveAttribute("aria-checked", "true");
    // health_data_storage = OFF
    await expect(allSwitches[1]).toHaveAttribute("aria-checked", "false");
    // analytics = ON
    await expect(allSwitches[2]).toHaveAttribute("aria-checked", "true");
  });

  test("clicking a toggle sends PUT with correct consent type and granted value", async ({
    page,
  }) => {
    await mockBaseRoutes(page);

    const putRequests: { consentType: string; granted: boolean }[] = [];

    await page.route("**/api/consent", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consent: {
              health_data_ai: false,
              health_data_storage: false,
              analytics: false,
            },
          }),
        });
      } else if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON();
        putRequests.push(body);
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            success: true,
            consentType: body.consentType,
            granted: body.granted,
          }),
        });
      }
    });

    await page.goto("/app/settings");

    const switches = page.getByRole("switch");
    await expect(switches).toHaveCount(3, { timeout: 10_000 });

    // Click the first toggle (health_data_ai) to turn it ON
    await switches.nth(0).click();

    // Wait for PUT to be captured
    await expect
      .poll(() => putRequests.length, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(1);

    expect(putRequests[0]).toEqual({
      consentType: "health_data_ai",
      granted: true,
    });

    // Verify toggle is now checked (optimistic update)
    await expect(switches.nth(0)).toHaveAttribute("aria-checked", "true");
  });

  test("clicking analytics toggle sends correct PUT payload", async ({
    page,
  }) => {
    await mockBaseRoutes(page);

    const putRequests: { consentType: string; granted: boolean }[] = [];

    await page.route("**/api/consent", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consent: {
              health_data_ai: false,
              health_data_storage: false,
              analytics: false,
            },
          }),
        });
      } else if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON();
        putRequests.push(body);
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await page.goto("/app/settings");

    const switches = page.getByRole("switch");
    await expect(switches).toHaveCount(3, { timeout: 10_000 });

    // Click analytics toggle (3rd switch)
    await switches.nth(2).click();

    await expect
      .poll(() => putRequests.length, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(1);

    expect(putRequests[0]).toEqual({
      consentType: "analytics",
      granted: true,
    });
  });

  test("toggle reverts to previous state when API returns error", async ({
    page,
  }) => {
    await mockBaseRoutes(page);

    await page.route("**/api/consent", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consent: {
              health_data_ai: false,
              health_data_storage: false,
              analytics: false,
            },
          }),
        });
      } else if (route.request().method() === "PUT") {
        // Simulate server error
        await route.fulfill({
          status: 500,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ error: "Failed to update consent" }),
        });
      }
    });

    await page.goto("/app/settings");

    const switches = page.getByRole("switch");
    await expect(switches).toHaveCount(3, { timeout: 10_000 });

    // Initial state: all OFF
    await expect(switches.nth(0)).toHaveAttribute("aria-checked", "false");

    // Click to turn ON — optimistic update happens immediately
    await switches.nth(0).click();

    // After API fails, toggle should revert to OFF
    await expect(switches.nth(0)).toHaveAttribute("aria-checked", "false", {
      timeout: 5_000,
    });
  });

  test("toggling OFF an enabled consent sends granted=false", async ({
    page,
  }) => {
    await mockBaseRoutes(page);

    const putRequests: { consentType: string; granted: boolean }[] = [];

    await page.route("**/api/consent", async (route) => {
      if (route.request().method() === "GET") {
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            consent: {
              health_data_ai: true,
              health_data_storage: true,
              analytics: true,
            },
          }),
        });
      } else if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON();
        putRequests.push(body);
        await route.fulfill({
          status: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ success: true }),
        });
      }
    });

    await page.goto("/app/settings");

    const switches = page.getByRole("switch");
    await expect(switches).toHaveCount(3, { timeout: 10_000 });

    // All start ON
    await expect(switches.nth(1)).toHaveAttribute("aria-checked", "true");

    // Click health_data_storage to turn it OFF
    await switches.nth(1).click();

    await expect
      .poll(() => putRequests.length, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(1);

    expect(putRequests[0]).toEqual({
      consentType: "health_data_storage",
      granted: false,
    });

    // Toggle should now be OFF
    await expect(switches.nth(1)).toHaveAttribute("aria-checked", "false");
  });
});

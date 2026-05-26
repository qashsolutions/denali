import { test, expect } from "@playwright/test";
import { mockAuthenticatedUser } from "./helpers";

/**
 * Harness self-test — verifies that the mockAuthenticatedUser helper
 * correctly emits (or omits) cohort fields in the mocked /api/profile
 * response body.
 *
 * This is NOT a feature test. It does not exercise application cohort
 * routing, modal cadence, or any real behaviour. Its sole job is to
 * confirm that the test harness itself does what downstream cohort specs
 * (e.g. cohort-non-medicare.spec.ts) depend on.
 *
 * Without this self-test, a silent regression in helpers.ts could allow
 * cohort specs to pass for the wrong reasons — the mock emitting the
 * wrong field names or wrong values while the spec still "passes" because
 * the application falls back to a default.
 */

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Navigate to /app and capture the /api/profile response that fires on
 * mount via useAuth. Returns the parsed JSON body.
 *
 * Pattern: Promise.all races waitForResponse with goto so we never miss
 * the response if it fires before goto resolves.
 */
async function captureProfileBody(
  page: Parameters<typeof mockAuthenticatedUser>[0]
): Promise<Record<string, unknown>> {
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes("/api/profile") && res.status() === 200
    ),
    page.goto("/app"),
  ]);
  return response.json() as Promise<Record<string, unknown>>;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test.describe("Mock self-test — mockAuthenticatedUser cohort fields", () => {
  /**
   * Test 1 — Backwards-compat (no overrides)
   *
   * Existing specs that don't set cohort fields must be unaffected by the
   * helpers.ts extension. The response body must not contain birth_year or
   * is_on_medicare at all — not undefined, not null, absent.
   */
  test("no overrides: birth_year and is_on_medicare are absent from profile body", async ({
    page,
  }) => {
    await mockAuthenticatedUser(page);
    const body = await captureProfileBody(page);

    expect(body).not.toHaveProperty("birth_year");
    expect(body).not.toHaveProperty("is_on_medicare");
  });

  /**
   * Test 2 — Medicare cohort
   *
   * When both overrides are set with Medicare values, the mock must emit
   * exactly those values with the snake_case field names the server uses.
   */
  test("birthYear + isOnMedicare true: profile body carries birth_year and is_on_medicare=true", async ({
    page,
  }) => {
    await mockAuthenticatedUser(page, { birthYear: 1955, isOnMedicare: true });
    const body = await captureProfileBody(page);

    expect(body.birth_year).toBe(1955);
    expect(body.is_on_medicare).toBe(true);
  });

  /**
   * Test 3 — Non-Medicare cohort
   *
   * is_on_medicare must be exactly false (boolean), not just falsy.
   * The downstream cohort router checks for strict false to route away
   * from Medicare orchestration.
   */
  test("birthYear + isOnMedicare false: profile body carries birth_year and is_on_medicare===false", async ({
    page,
  }) => {
    await mockAuthenticatedUser(page, { birthYear: 1968, isOnMedicare: false });
    const body = await captureProfileBody(page);

    expect(body.birth_year).toBe(1968);
    // Strict boolean false — not null, not 0, not ""
    expect(body.is_on_medicare).toBe(false);
  });

  /**
   * Test 4 — Partial override (only birthYear)
   *
   * The conditional spread in helpers.ts is per-field. Setting birthYear
   * alone must not cause is_on_medicare to appear in the response body.
   */
  test("birthYear only: birth_year is present, is_on_medicare is absent", async ({
    page,
  }) => {
    await mockAuthenticatedUser(page, { birthYear: 1980 });
    const body = await captureProfileBody(page);

    expect(body.birth_year).toBe(1980);
    expect(body).not.toHaveProperty("is_on_medicare");
  });
});

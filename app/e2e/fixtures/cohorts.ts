/**
 * Single source of truth for cohort fixtures used by E2E tests.
 *
 * ## Purpose
 * Denali's user base splits on `is_on_medicare`. Every test that exercises
 * cohort-branched code (skills loader router, birth-year modal cadence, chat
 * page rendering, settings toggles, appeal gating) should parameterize on
 * these two fixtures rather than inline cohort data.
 *
 * ## Usage pattern
 *
 * ```ts
 * import { medicareCohort, nonMedicareCohort } from "./fixtures/cohorts";
 * import { mockAuthenticatedUser } from "./helpers";
 *
 * // Parameterized over both cohorts:
 * for (const [label, fixture] of [
 *   ["Medicare", medicareCohort()],
 *   ["non-Medicare", nonMedicareCohort()],
 * ] as const) {
 *   test(`chat page renders for ${label} user`, async ({ page }) => {
 *     await mockAuthenticatedUser(page, fixture);
 *     // ...
 *   });
 * }
 *
 * // Or for a cohort-specific assertion:
 * test("appeal letter gate hidden for non-Medicare user", async ({ page }) => {
 *   await mockAuthenticatedUser(page, nonMedicareCohort({ plan: "plus" }));
 *   // ...
 * });
 * ```
 *
 * ## Shape contract
 * Each factory returns the EXACT overrides object accepted by
 * `mockAuthenticatedUser()` in `helpers.ts` — which maps 1:1 onto the
 * `/api/profile` response shape. When `helpers.ts` adds new fields to that
 * response, update `ProfileOverrides` here to match.
 *
 * ## Follow-up
 * `helpers.ts` `mockAuthenticatedUser` will be updated to accept these fixture
 * objects directly (same overrides shape). Until that edit lands, pass the
 * fixture object as the `overrides` argument — all fields are already in the
 * accepted type.
 */

// ---------------------------------------------------------------------------
// Shared overrides type — mirrors mockAuthenticatedUser's overrides parameter
// exactly. Extend here when helpers.ts gains new fields.
// ---------------------------------------------------------------------------

export interface ProfileOverrides {
  email?: string;
  plan?: "trial" | "starter" | "plus" | "unlimited";
  is_admin?: boolean;
  appeal_credits?: number;
  firstName?: string;
  trialStatus?: "active" | "expired";
  trialDaysRemaining?: number;
  /** Maps to `birth_year` in the /api/profile response. */
  birthYear?: number;
  /** Maps to `is_on_medicare` in the /api/profile response. */
  isOnMedicare?: boolean;
  /**
   * Maps to `birth_year_modal_dismissed_at` in the /api/profile response.
   * ISO-8601 timestamp string or null.
   */
  birthYearModalDismissedAt?: string | null;
  /**
   * Maps to `birth_year_modal_disabled` in the /api/profile response.
   */
  birthYearModalDisabled?: boolean;
}

// ---------------------------------------------------------------------------
// Medicare cohort
//
// Representative defaults:
//   - is_on_medicare: true
//   - birth_year: 1955  (age 71 as of 2026-04-28 — clearly Medicare-eligible)
//   - plan: "trial"
// ---------------------------------------------------------------------------

/**
 * Returns overrides for a Medicare-cohort user (`is_on_medicare: true`).
 *
 * Defaults produce a trial-plan user born in 1955 (age 71). Every field can
 * be overridden by passing a partial `ProfileOverrides` object. Overrides are
 * shallowly merged — all fields are scalar, so spreading is always correct.
 *
 * ```ts
 * medicareCohort()                        // trial user, born 1955
 * medicareCohort({ plan: "unlimited" })   // unlimited plan, all other defaults
 * medicareCohort({ birthYear: 1948 })     // different birth year
 * ```
 */
export function medicareCohort(overrides: ProfileOverrides = {}): ProfileOverrides {
  return {
    email: "medicare-test@example.com",
    plan: "trial",
    is_admin: false,
    appeal_credits: 0,
    trialStatus: "active",
    trialDaysRemaining: 10,
    // Cohort-defining fields
    isOnMedicare: true,
    birthYear: 1955,
    birthYearModalDismissedAt: null,
    birthYearModalDisabled: false,
    // Caller overrides win
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Non-Medicare cohort
//
// Representative defaults:
//   - is_on_medicare: false
//   - birth_year: 1968  (age 58 as of 2026-04-28 — not Medicare-eligible by age)
//   - plan: "trial"
// ---------------------------------------------------------------------------

/**
 * Returns overrides for a non-Medicare-cohort user (`is_on_medicare: false`).
 *
 * Defaults produce a trial-plan user born in 1968 (age 58). Every field can
 * be overridden by passing a partial `ProfileOverrides` object.
 *
 * Non-Medicare users:
 *   - Are routed to `buildSystemPromptForNonMedicare` by the skills loader router
 *   - Never see appeal-letter features or Medicare-specific skills
 *   - See `NON_MEDICARE_ACKNOWLEDGMENT_SKILL` injected into every prompt
 *
 * ```ts
 * nonMedicareCohort()                       // trial user, born 1968
 * nonMedicareCohort({ plan: "plus" })       // plus plan
 * nonMedicareCohort({ birthYear: undefined }) // unknown birth year (triggers modal)
 * ```
 */
export function nonMedicareCohort(overrides: ProfileOverrides = {}): ProfileOverrides {
  return {
    email: "non-medicare-test@example.com",
    plan: "trial",
    is_admin: false,
    appeal_credits: 0,
    trialStatus: "active",
    trialDaysRemaining: 10,
    // Cohort-defining fields
    isOnMedicare: false,
    birthYear: 1968,
    birthYearModalDismissedAt: null,
    birthYearModalDisabled: false,
    // Caller overrides win
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Convenience re-exports for describe.each / test.each
//
// Usage:
//   import { COHORT_MATRIX } from "./fixtures/cohorts";
//   test.each(COHORT_MATRIX)("renders for %s cohort", async (label, fixture, { page }) => { ... });
// ---------------------------------------------------------------------------

/**
 * A two-row matrix suitable for `test.each` / `describe.each` when the same
 * assertion must pass for both cohorts.
 *
 * ```ts
 * test.each(COHORT_MATRIX)(
 *   "chat page loads for %s cohort",
 *   async (label, fixture, { page }) => {
 *     await mockAuthenticatedUser(page, fixture);
 *     await page.goto("/app/chat");
 *     await expect(page).toHaveTitle(/Denali/);
 *   }
 * );
 * ```
 */
export const COHORT_MATRIX: [string, ProfileOverrides][] = [
  ["Medicare", medicareCohort()],
  ["non-Medicare", nonMedicareCohort()],
];

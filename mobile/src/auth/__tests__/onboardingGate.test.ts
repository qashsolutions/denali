/**
 * Returning-user onboarding gate (NAV-1 / NAV-2 / NAV-3).
 *
 * Pins two clinical-safety invariants:
 *  - NAV-1: a user is "onboarded" (may skip straight to the app) ONLY when the
 *    cohort fields AND the mandatory mood screener are both done. The critical
 *    case is "cohort done, mood NOT done" → must be false, or sign-in would skip
 *    the mood screener (and its 988 path).
 *  - NAV-2: the local DB is per-device, so it may hold another account's row.
 *    Completion requires the profile to belong to the signed-in user
 *    (`profile.id === userId`) — account A's profile must NOT onboard account B.
 */
import { describe, expect, it } from "vitest";

import { isOnboardingComplete } from "../onboardingGate";

const USER = "user-abc";
const FULL = { id: USER, birth_year: 1960, sex_at_birth: "female" as const };

describe("isOnboardingComplete", () => {
  it("false when there is no profile", () => {
    expect(isOnboardingComplete(null, true, USER)).toBe(false);
    expect(isOnboardingComplete(null, false, USER)).toBe(false);
  });

  it("FALSE when cohort is done but the mood screener is NOT (NAV-1)", () => {
    // The regression: gating on cohort fields alone would skip the mandatory
    // mood screener + its 988 path for a user who abandoned after cohort.
    expect(isOnboardingComplete(FULL, false, USER)).toBe(false);
  });

  it("true only when cohort fields AND the mood screener are both done", () => {
    expect(isOnboardingComplete(FULL, true, USER)).toBe(true);
  });

  it("FALSE when the profile belongs to a DIFFERENT user (NAV-2)", () => {
    // Cross-user leak guard: a fully-onboarded account A on a shared device
    // must not let freshly-signed-in account B skip onboarding.
    expect(isOnboardingComplete(FULL, true, "someone-else")).toBe(false);
  });

  it("false when a permanent field is missing even if mood is done", () => {
    expect(
      isOnboardingComplete(
        { id: USER, birth_year: null, sex_at_birth: "male" },
        true,
        USER,
      ),
    ).toBe(false);
    expect(
      isOnboardingComplete(
        { id: USER, birth_year: 1955, sex_at_birth: null },
        true,
        USER,
      ),
    ).toBe(false);
  });
});

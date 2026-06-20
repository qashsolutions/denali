/**
 * Returning-user onboarding gate (NAV-1 / NAV-3).
 *
 * Pins the clinical-safety invariant: a user is "onboarded" (may skip straight
 * to the app) ONLY when the cohort fields AND the mandatory mood screener are
 * both done. The critical case is "cohort done, mood NOT done" → must be false,
 * or sign-in would skip the mood screener (and its 988 path).
 */
import { describe, expect, it } from "vitest";

import { isOnboardingComplete } from "../onboardingGate";

const FULL = { birth_year: 1960, sex_at_birth: "female" as const };

describe("isOnboardingComplete", () => {
  it("false when there is no profile", () => {
    expect(isOnboardingComplete(null, true)).toBe(false);
    expect(isOnboardingComplete(null, false)).toBe(false);
  });

  it("FALSE when cohort is done but the mood screener is NOT (NAV-1)", () => {
    // The regression: gating on cohort fields alone would skip the mandatory
    // mood screener + its 988 path for a user who abandoned after cohort.
    expect(isOnboardingComplete(FULL, false)).toBe(false);
  });

  it("true only when cohort fields AND the mood screener are both done", () => {
    expect(isOnboardingComplete(FULL, true)).toBe(true);
  });

  it("false when a permanent field is missing even if mood is done", () => {
    expect(
      isOnboardingComplete({ birth_year: null, sex_at_birth: "male" }, true),
    ).toBe(false);
    expect(
      isOnboardingComplete({ birth_year: 1955, sex_at_birth: null }, true),
    ).toBe(false);
  });
});

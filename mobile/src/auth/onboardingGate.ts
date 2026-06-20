/**
 * Returning-user onboarding gate (pure, node-safe, testable).
 *
 * Decides whether a returning user has COMPLETED onboarding and may skip the
 * interstitial chain straight to the app after sign-in.
 *
 * CLINICAL-SAFETY (NAV-1): completion requires BOTH the permanent cohort fields
 * (written at the cohort confirm step) AND that the MANDATORY mood screener has
 * run. The mood screener (PHQ-2) is the LAST required onboarding step — it runs
 * AFTER cohort + intake and persists a `questionnaire` observation, and it
 * carries the 988 crisis surface. Gating on the cohort fields ALONE would send
 * a user who completed cohort but abandoned before the mood screener straight
 * to the app, silently skipping that screener (and its 988 path). So we require
 * the mood signal too — the safe direction is "re-onboard", never "skip".
 */
import type { ProfileRow } from "@/contracts";

export function isOnboardingComplete(
  profile: Pick<ProfileRow, "birth_year" | "sex_at_birth"> | null,
  hasMoodObservation: boolean,
): boolean {
  return (
    profile != null &&
    profile.birth_year != null &&
    profile.sex_at_birth != null &&
    hasMoodObservation
  );
}

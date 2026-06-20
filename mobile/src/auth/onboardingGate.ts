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
 *
 * CROSS-USER SAFETY (NAV-2): the local SQLCipher DB is keyed per-DEVICE, so on a
 * shared/test device it can hold rows for more than one account. `getProfile()`
 * returns the most-recently-updated row REGARDLESS of who is signed in, so the
 * caller must pass the signed-in `userId` and we verify the row belongs to them
 * (`profile.id === userId`). Without this, account A's completed profile could
 * let a freshly-signed-in account B skip onboarding (incl. the mood screener).
 * Pair this with a USER-SCOPED mood read (`getLatestObservation(userId, …)`),
 * not an un-scoped `listObservations`, so neither half leaks across accounts.
 */
import type { ProfileRow } from "@/contracts";

export function isOnboardingComplete(
  profile: Pick<ProfileRow, "id" | "birth_year" | "sex_at_birth"> | null,
  hasMoodObservation: boolean,
  userId: string,
): boolean {
  return (
    profile != null &&
    profile.id === userId &&
    profile.birth_year != null &&
    profile.sex_at_birth != null &&
    hasMoodObservation
  );
}

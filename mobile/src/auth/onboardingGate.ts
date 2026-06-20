/**
 * Returning-user onboarding gate (pure, node-safe, testable).
 *
 * Decides whether a returning user has COMPLETED onboarding and may skip the
 * interstitial chain straight to the app after sign-in.
 *
 * CLINICAL-SAFETY (NAV-1): completion requires BOTH the permanent cohort fields
 * (written at the cohort confirm step) AND that the MANDATORY mood screener has
 * run. The mood screener is the LAST required onboarding step — it runs AFTER
 * cohort + intake, persists a `questionnaire` observation, and carries the 988
 * crisis surface. Gating on the cohort fields ALONE would send a user who
 * completed cohort but abandoned before the mood screener straight to the app,
 * silently skipping that screener (and its 988 path). So we require the mood
 * signal too — the safe direction is "re-onboard", never "skip".
 *
 * The mood signal must recognize BOTH completion shapes. A NEGATIVE PHQ-2 screen
 * persists the PHQ-2 panel summary (`55757-9`). A POSITIVE PHQ-2 screen (score
 * ≥ threshold) expands to PHQ-9 and persists the PHQ-9 summary (`44249-1`)
 * INSTEAD — it never writes `55757-9` (see `InstrumentsScreen.advanceMoodAfterResponse`).
 * Gating on `55757-9` alone therefore judged every positive-screen user — exactly
 * the cohort the screener exists to catch — as "not onboarded" forever, looping
 * them back through cohort + intake + the 988 surface on every launch. So
 * "mood done" = the PHQ-2 panel OR the PHQ-9 summary is present
 * (`MOOD_SCREENER_CODES` / `hasMoodScreenerObservation`).
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
import { PHQ2, PHQ9 } from "@/onboarding/instruments";

/**
 * The LOINC summary codes that signal the mandatory mood screener completed:
 * the PHQ-2 panel (negative screen) and the PHQ-9 total (positive screen, which
 * expands and persists PHQ-9 instead of PHQ-2). Presence of EITHER ⇒ done.
 */
export const MOOD_SCREENER_CODES: readonly string[] = [
  PHQ2.loincCode,
  PHQ9.loincCode,
];

/**
 * Did the mandatory mood screener complete for this user? Resolves a
 * user-scoped "latest observation for code" lookup across `MOOD_SCREENER_CODES`
 * and returns true as soon as one is present. Takes the lookup as a function so
 * the decision stays node-testable (no DAL/`react-native` dependency) — the
 * caller binds it to `(code) => dal.getLatestObservation(userId, code)`.
 */
export async function hasMoodScreenerObservation(
  getLatestForCode: (code: string) => Promise<unknown | null>,
): Promise<boolean> {
  for (const code of MOOD_SCREENER_CODES) {
    if ((await getLatestForCode(code)) != null) return true;
  }
  return false;
}

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

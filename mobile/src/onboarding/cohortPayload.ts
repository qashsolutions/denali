/**
 * Cohort onboarding — pure payload helpers.
 *
 * Mirrors the web's `canSubmitOnboarding` + `buildOnboardingPayload`
 * from app/src/app/onboarding/medicare/MedicareOnboardingForm.tsx, plus
 * adds birth_year (Phase 1 mobile is the 45+ cohort gate).
 *
 * The mobile flow PATCHes the same /api/profile endpoint as the web; the
 * server's PATCH allowlist already supports all four fields and uses
 * additive semantics — omitting a key leaves the column untouched.
 *
 * Helpers are kept pure so they're testable under Node-only vitest. The
 * screen calls them and forwards the result to ApiClient.apiPatch.
 */
import type { GenderIdentity, SexAtBirth } from "@/contracts";

export interface CohortPayload {
  birth_year: number;
  is_on_medicare: boolean;
  sex_at_birth: SexAtBirth;
  gender_identity?: GenderIdentity;
}

/**
 * Whether the cohort form can be submitted. Required: birth_year (in valid
 * range), sex_at_birth, is_on_medicare. Gender identity is optional.
 */
export function canSubmitCohort(args: {
  birthYear: number | null;
  sexAtBirth: SexAtBirth | null;
  isOnMedicare: boolean | null;
  currentYear?: number;
}): boolean {
  const year = args.currentYear ?? new Date().getFullYear();
  if (args.sexAtBirth == null) return false;
  if (args.isOnMedicare == null) return false;
  if (args.birthYear == null) return false;
  if (!Number.isInteger(args.birthYear)) return false;
  if (args.birthYear < 1900 || args.birthYear > year) return false;
  return true;
}

/**
 * Build the PATCH /api/profile body. Optional `gender_identity` is omitted
 * when null so the column is left untouched (additive PATCH semantics).
 *
 * Caller is responsible for calling `canSubmitCohort` first — this function
 * asserts the required fields are non-null but does NOT re-validate range.
 */
export function buildCohortPayload(args: {
  birthYear: number;
  sexAtBirth: SexAtBirth;
  isOnMedicare: boolean;
  genderIdentity: GenderIdentity | null;
}): CohortPayload {
  const payload: CohortPayload = {
    birth_year: args.birthYear,
    is_on_medicare: args.isOnMedicare,
    sex_at_birth: args.sexAtBirth,
  };
  if (args.genderIdentity !== null) {
    payload.gender_identity = args.genderIdentity;
  }
  return payload;
}

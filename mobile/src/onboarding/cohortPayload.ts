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

/** Which required cohort field the user hasn't supplied yet. */
export type MissingCohortField =
  | "birth_year"
  | "sex_at_birth"
  | "is_on_medicare";

/**
 * Result of evaluating live cohort form state. Either ready-to-submit (with
 * a built payload) or missing-a-required-field (with the specific field).
 */
export type CohortDecision =
  | { kind: "ready"; payload: CohortPayload }
  | { kind: "missing"; field: MissingCohortField };

/**
 * Pure decision function: takes live cohort form state as explicit
 * arguments and returns whether submission can proceed.
 *
 * This exists because the prior architecture relied on closure-captured
 * state inside the auto-advance handler, which produced a stale-closure
 * dead-end on the gender step (memoized handler holding initial nulls;
 * "Please complete all required answers" error rendered even when all
 * required fields had been filled). Taking state via args eliminates the
 * stale-closure class structurally — the caller passes current state,
 * the function can only see what it's given.
 *
 * Required: birth_year (in valid range), sex_at_birth, is_on_medicare.
 * Optional: gender_identity. Omitted from the payload when null
 * (additive PATCH semantics — column left untouched).
 */
export function decideCohortSubmission(args: {
  birthYear: number | null;
  sexAtBirth: SexAtBirth | null;
  isOnMedicare: boolean | null;
  genderIdentity: GenderIdentity | null;
  currentYear?: number;
}): CohortDecision {
  const year = args.currentYear ?? new Date().getFullYear();
  if (
    args.birthYear == null ||
    !Number.isInteger(args.birthYear) ||
    args.birthYear < 1900 ||
    args.birthYear > year
  ) {
    return { kind: "missing", field: "birth_year" };
  }
  if (args.sexAtBirth == null) {
    return { kind: "missing", field: "sex_at_birth" };
  }
  if (args.isOnMedicare == null) {
    return { kind: "missing", field: "is_on_medicare" };
  }
  return {
    kind: "ready",
    payload: buildCohortPayload({
      birthYear: args.birthYear,
      sexAtBirth: args.sexAtBirth,
      isOnMedicare: args.isOnMedicare,
      genderIdentity: args.genderIdentity,
    }),
  };
}

/** User-facing copy that names the specific missing field. */
export function missingCohortFieldMessage(field: MissingCohortField): string {
  switch (field) {
    case "birth_year":
      return "Please go back and answer: birth year.";
    case "sex_at_birth":
      return "Please go back and answer: sex at birth.";
    case "is_on_medicare":
      return "Please go back and answer: Medicare.";
  }
}

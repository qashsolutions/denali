/**
 * demographicsDisplay — plain-language labels for the profile demographics
 * shown read-only in Settings → "Your details" (D31).
 *
 * Display layer only: maps the stored SexAtBirth / GenderIdentity union values
 * + birth year to user-facing strings, and derives age. Storage is untouched.
 * Labels mirror the cohort-onboarding option labels so Settings and onboarding
 * never disagree. Pure (no React) + unit-tested.
 */

import type { GenderIdentity, SexAtBirth } from "@/contracts";

const SEX_AT_BIRTH_LABEL: Record<SexAtBirth, string> = {
  male: "Male",
  female: "Female",
  intersex: "Intersex",
  unknown: "Prefer not to say",
};

const GENDER_IDENTITY_LABEL: Record<GenderIdentity, string> = {
  male: "Male",
  female: "Female",
  "non-binary": "Non-binary",
  "transgender-male": "Transgender male",
  "transgender-female": "Transgender female",
  other: "Other",
  "prefer-not-to-say": "Prefer not to say",
};

/** Placeholder for a demographic the user hasn't provided. */
export const NOT_SET_LABEL = "Not set";

/**
 * Gender identity options in display order — the EDITABLE picker in Settings
 * (D32) maps over these. Order mirrors the cohort-onboarding GENDER_OPTIONS.
 * Gender identity is display-only (non-clinical), so it is freely editable.
 */
export const GENDER_IDENTITY_VALUES: ReadonlyArray<GenderIdentity> = [
  "male",
  "female",
  "non-binary",
  "transgender-male",
  "transgender-female",
  "other",
  "prefer-not-to-say",
];

export function sexAtBirthLabel(value: SexAtBirth | null): string {
  if (value == null) return NOT_SET_LABEL;
  return SEX_AT_BIRTH_LABEL[value] ?? value;
}

export function genderIdentityLabel(value: GenderIdentity | null): string {
  if (value == null) return NOT_SET_LABEL;
  return GENDER_IDENTITY_LABEL[value] ?? value;
}

/**
 * Age in whole years from a birth year, given the current year. Null when the
 * birth year is absent or implausible (guards a typo'd year producing a wild
 * age). The caller passes `currentYear` explicitly (stale-closure rule).
 */
export function ageFromBirthYear(
  birthYear: number | null,
  currentYear: number,
): number | null {
  if (birthYear == null) return null;
  const age = currentYear - birthYear;
  return age >= 0 && age <= 130 ? age : null;
}

/** "1965 · age 61", or just the year if age is implausible, or "Not set". */
export function birthYearLabel(
  birthYear: number | null,
  currentYear: number,
): string {
  if (birthYear == null) return NOT_SET_LABEL;
  const age = ageFromBirthYear(birthYear, currentYear);
  return age != null ? `${birthYear} · age ${age}` : String(birthYear);
}

/** Medicare enrollment as a plain Yes/No/Not set. */
export function medicareLabel(isOnMedicare: boolean | null): string {
  if (isOnMedicare == null) return NOT_SET_LABEL;
  return isOnMedicare ? "Yes" : "No";
}

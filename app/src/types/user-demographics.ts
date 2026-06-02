/**
 * User demographics — USCDI-aligned value sets (Chunk 3).
 *
 * Used by:
 *   - users.sex_at_birth     TEXT NULL   (mandatory at app layer, gated by /onboarding interstitial)
 *   - users.gender_identity  TEXT NULL   (optional, no gate)
 *
 * Value sets are enforced by these TypeScript string-literal unions in app code,
 * NOT by DB CHECK constraints — USCDI value sets occasionally evolve, and
 * app-layer validation is more flexible to change than ALTER CONSTRAINT.
 */

export type SexAtBirth = "male" | "female" | "intersex" | "unknown";

export type GenderIdentity =
  | "male"
  | "female"
  | "non-binary"
  | "transgender-male"
  | "transgender-female"
  | "other"
  | "prefer-not-to-say";

export const SEX_AT_BIRTH_VALUES = [
  "male",
  "female",
  "intersex",
  "unknown",
] as const satisfies readonly SexAtBirth[];

export const GENDER_IDENTITY_VALUES = [
  "male",
  "female",
  "non-binary",
  "transgender-male",
  "transgender-female",
  "other",
  "prefer-not-to-say",
] as const satisfies readonly GenderIdentity[];

export function isValidSexAtBirth(v: unknown): v is SexAtBirth {
  return (
    typeof v === "string" &&
    (SEX_AT_BIRTH_VALUES as readonly string[]).includes(v)
  );
}

export function isValidGenderIdentity(v: unknown): v is GenderIdentity {
  return (
    typeof v === "string" &&
    (GENDER_IDENTITY_VALUES as readonly string[]).includes(v)
  );
}

// ─── Display labels — shared by onboarding form + Settings ─────────────────
// Source-of-truth for the user-facing label of each enum value. Keep here so
// every consumer (onboarding, Settings, future chat context, audit display)
// uses the same label without duplicating the mapping.

export const SEX_AT_BIRTH_LABELS: Record<SexAtBirth, string> = {
  male: "Male",
  female: "Female",
  intersex: "Intersex",
  unknown: "Prefer not to say",
};

export const GENDER_IDENTITY_LABELS: Record<GenderIdentity, string> = {
  male: "Male",
  female: "Female",
  "non-binary": "Non-binary",
  "transgender-male": "Transgender male",
  "transgender-female": "Transgender female",
  other: "Other",
  "prefer-not-to-say": "Prefer not to say",
};

// ─── v1 UI option lists ────────────────────────────────────────────────────
// SEX_AT_BIRTH has 4 enum values but v1 UI exposes only 3 (no "Intersex" in
// the picker; if it's set via API the dropdown shows blank — documented edge
// in the Settings page). Shared by onboarding form + Settings page so the
// option list stays consistent across both surfaces.

export const SEX_AT_BIRTH_UI_OPTIONS: ReadonlyArray<{
  value: SexAtBirth;
  label: string;
}> = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unknown", label: "Prefer not to say" },
];

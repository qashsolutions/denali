/**
 * Validated instruments — selection + barrel.
 *
 * `instrumentsFor(sexAtBirth)` returns the canonical battery for a given
 * sex_at_birth, using the contract type guard for safety:
 *   - All: PHQ-9, GAD-7, AUDIT-C, Epworth
 *   - "female": + MRS
 *   - "male":   + ADAM, IPSS
 *   - "intersex" / "unknown" / null: only the unisex set (PHQ-9 / GAD-7 /
 *     AUDIT-C / Epworth). The agent spec only branches MRS and ADAM/IPSS
 *     on female/male; intersex + unknown receive the unisex set per the
 *     "branch on sex_at_birth" hard rule.
 */
import type { SexAtBirth } from "@/contracts";

/**
 * Local type guard for SexAtBirth. The web's user-demographics module
 * exports an equivalent helper but the frozen mobile contracts re-export
 * types only (no runtime values) — see mobile/src/contracts/index.ts.
 * Mirror the discriminator here.
 */
const SEX_AT_BIRTH_VALUES: ReadonlyArray<SexAtBirth> = [
  "male",
  "female",
  "intersex",
  "unknown",
];

function isValidSexAtBirth(v: unknown): v is SexAtBirth {
  return (
    typeof v === "string" &&
    (SEX_AT_BIRTH_VALUES as readonly string[]).includes(v)
  );
}

import { ADAM } from "./adam";
import { AUDIT_C } from "./auditC";
import { EPWORTH } from "./epworth";
import { GAD7 } from "./gad7";
import { IPSS } from "./ipss";
import { MRS } from "./mrs";
import { PHQ2 } from "./phq2";
import { PHQ9 } from "./phq9";
import type { InstrumentDefinition, InstrumentId } from "./types";

export {
  ADAM,
  AUDIT_C,
  EPWORTH,
  GAD7,
  IPSS,
  MRS,
  PHQ2,
  PHQ9,
};
export { isAdamPositive } from "./adam";
export {
  IPSS_QOL_ITEM,
  IPSS_QOL_RESPONSE_OPTIONS,
} from "./ipss";
export { PHQ9_LEAD_IN } from "./phq9";
export { PHQ2_LEAD_IN } from "./phq2";
export { GAD7_LEAD_IN } from "./gad7";
export { AUDIT_C_LEAD_IN } from "./auditC";
export { EPWORTH_LEAD_IN } from "./epworth";
export { MRS_LEAD_IN } from "./mrs";
export { ADAM_LEAD_IN } from "./adam";
export { IPSS_LEAD_IN } from "./ipss";
export { CRISIS_988_COPY, shouldShow988, PHQ9_ITEM_9_INDEX } from "./safety";
export type {
  InstrumentDefinition,
  InstrumentId,
  InstrumentItem,
  InstrumentResponses,
  ResponseOption,
} from "./types";

/**
 * Return the validated-instrument battery for the cohort's sex_at_birth.
 *
 * The unisex set ships to everyone. Sex-specific instruments only attach
 * when sex_at_birth strictly matches via `isValidSexAtBirth`.
 *
 * The order is the order shown in the screen: PHQ-9 first (because the
 * 988 surface is most-critical to encounter early), then GAD-7, AUDIT-C,
 * Epworth, then any sex-specific instruments at the end.
 */
export function instrumentsFor(
  sexAtBirth: SexAtBirth | null | undefined,
): ReadonlyArray<InstrumentDefinition> {
  const unisex: ReadonlyArray<InstrumentDefinition> = [
    PHQ9,
    GAD7,
    AUDIT_C,
    EPWORTH,
  ];
  if (!isValidSexAtBirth(sexAtBirth)) return unisex;
  if (sexAtBirth === "female") return [...unisex, MRS];
  if (sexAtBirth === "male") return [...unisex, ADAM, IPSS];
  // intersex, unknown — unisex only.
  return unisex;
}

/**
 * Look up an instrument definition by its stable id (the value stored in
 * each observation's `metadata.instrument`). Used by the display layer to
 * recover an instrument's response SCALE (min/max) when rendering a
 * per-item visual — display reads the scale, never re-derives clinical
 * wording. Returns undefined for an unknown id.
 */
const INSTRUMENTS_BY_ID: Readonly<Record<InstrumentId, InstrumentDefinition>> =
  {
    "PHQ-9": PHQ9,
    "PHQ-2": PHQ2,
    "GAD-7": GAD7,
    "AUDIT-C": AUDIT_C,
    Epworth: EPWORTH,
    MRS,
    ADAM,
    IPSS,
  };

export function getInstrumentById(
  id: string,
): InstrumentDefinition | undefined {
  return (INSTRUMENTS_BY_ID as Record<string, InstrumentDefinition>)[id];
}

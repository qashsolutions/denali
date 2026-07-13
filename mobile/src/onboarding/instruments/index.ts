/**
 * Validated instruments — selection + barrel.
 *
 * `instrumentsFor()` returns the canonical battery for every cohort.
 *
 * 2026-07 LICENSING DECISION (audit/LICENSING_BRIEF.md): only public-domain
 * instruments ship. Epworth/ESS (MAPI licence), MRS (ZEG Berlin licence),
 * IPSS (Wolters Kluwer/MAPI), and ADAM (Saint Louis University, not clearly
 * free) were REMOVED. What ships:
 *   - All cohorts: PHQ-9 (PHQ-2 gate), GAD-7, AUDIT-C — all public domain.
 * Sex-specific coverage (menopause / urinary / hormonal symptoms) moved to
 * the unlicensed symptom tracker (src/screens/symptoms/*): plain trackable
 * observations with a trend, never a scored proprietary questionnaire.
 */
import type { SexAtBirth } from "@/contracts";

import { AUDIT_C } from "./auditC";
import { GAD7 } from "./gad7";
import { PHQ2 } from "./phq2";
import { PHQ9 } from "./phq9";
import type { InstrumentDefinition, InstrumentId } from "./types";

export { AUDIT_C, GAD7, PHQ2, PHQ9 };
export { PHQ9_LEAD_IN } from "./phq9";
export { PHQ2_LEAD_IN } from "./phq2";
export { GAD7_LEAD_IN } from "./gad7";
export { AUDIT_C_LEAD_IN } from "./auditC";
export { CRISIS_988_COPY, shouldShow988, PHQ9_ITEM_9_INDEX } from "./safety";
export type {
  InstrumentDefinition,
  InstrumentId,
  InstrumentItem,
  InstrumentResponses,
  ResponseOption,
} from "./types";

/**
 * Return the validated-instrument battery. Post-2026-07 this is the same
 * public-domain set for every cohort — sex no longer branches the scored
 * instruments (the removed sex-specific instruments were proprietary).
 *
 * The `sexAtBirth` param is retained for call-site compatibility
 * (`domainsForCohort` passes it) and forward flexibility; it does not
 * currently branch. Order is the screen order: PHQ-9 first (988 surface
 * encountered early), then GAD-7, AUDIT-C.
 */
export function instrumentsFor(
  _sexAtBirth?: SexAtBirth | null | undefined,
): ReadonlyArray<InstrumentDefinition> {
  return [PHQ9, GAD7, AUDIT_C];
}

/**
 * Look up an instrument definition by its stable id (the value stored in
 * each observation's `metadata.instrument`). Used by the display layer to
 * recover an instrument's response SCALE (min/max) when rendering a
 * per-item visual — display reads the scale, never re-derives clinical
 * wording. Returns undefined for an unknown id (including the removed
 * instruments' historical rows, which then fall back to generic display).
 */
const INSTRUMENTS_BY_ID: Readonly<Record<InstrumentId, InstrumentDefinition>> =
  {
    "PHQ-9": PHQ9,
    "PHQ-2": PHQ2,
    "GAD-7": GAD7,
    "AUDIT-C": AUDIT_C,
  };

export function getInstrumentById(
  id: string,
): InstrumentDefinition | undefined {
  return (INSTRUMENTS_BY_ID as Record<string, InstrumentDefinition>)[id];
}

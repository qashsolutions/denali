/**
 * Domain registry — Phase-3 (Health Hub) increment 1.
 *
 * Maps every instrument and every observation-category onto a small
 * set of user-facing **health domains**. The dashboard renders one
 * card per domain; the detail screen pivots into the per-domain
 * history. Pure data + thin helpers; no React.
 *
 * Per the operator's Q1 decision: 9 user-facing domains (down from
 * 13). Active screeners stay distinct; passives collapse into
 * `health_history`; biomarker/vital/anthropometric collapse into
 * `health_markers`. The latter is the domain that will eventually
 * host the curated key-biomarker surface (see
 * `mobile/src/screens/timeline/biomarkers/`).
 *
 * Cohort gating reuses `instrumentsFor(sex_at_birth)` from the
 * onboarding side — the dashboard surfaces ONLY domains relevant to
 * the user's cohort. Passive domains (`health_history`,
 * `health_markers`) are always relevant.
 *
 * Clinical key is `sex_at_birth`, not `gender_identity`
 * (mobile/CLAUDE.md, Engineering rules § Display + clinical boundary).
 */

import type { ObservationCategory, SexAtBirth } from "@/contracts";
import { instrumentsFor } from "@/onboarding/instruments";

/** Stable identifiers for the 9 user-facing domains. */
export type DomainId =
  | "mood"           // PHQ-2 / PHQ-9
  | "anxiety"        // GAD-7
  | "sleep"          // Epworth
  | "alcohol"        // AUDIT-C
  | "urinary"        // IPSS
  | "menopause"      // MRS
  | "hormonal"       // ADAM
  | "health_markers" // biomarker + vital + anthropometric (+ future device data)
  | "health_history" // family_history + conditions + symptoms + lifestyle
  ;

/**
 * Map an instrument id (matches `metadata_json.instrument` written by
 * InstrumentsScreen → `persistInstrument`) onto its domain.
 *
 * Adding a new instrument: add its id here AND extend `instrumentsFor`
 * if the instrument is cohort-scoped.
 */
export const INSTRUMENT_TO_DOMAIN: Readonly<Record<string, DomainId>> = {
  "PHQ-2": "mood",
  "PHQ-9": "mood",
  "GAD-7": "anxiety",
  Epworth: "sleep",
  "AUDIT-C": "alcohol",
  IPSS: "urinary",
  MRS: "menopause",
  ADAM: "hormonal",
};

/**
 * Map an observation category onto its domain.
 *
 * The `questionnaire` category never reaches this map at runtime —
 * questionnaire rows always carry `metadata_json.instrument` and are
 * routed via INSTRUMENT_TO_DOMAIN. The entry exists so the
 * Record<ObservationCategory, DomainId> typing is exhaustive; the
 * value is a sensible fallback if an orphaned questionnaire row ever
 * shows up.
 */
export const CATEGORY_TO_DOMAIN: Readonly<Record<ObservationCategory, DomainId>> = {
  questionnaire: "health_history",
  biomarker: "health_markers",
  vital: "health_markers",
  anthropometric: "health_markers",
  screening: "health_markers",
  symptom: "health_history",
  family_history: "health_history",
  condition: "health_history",
  lifestyle: "health_history",
};

/**
 * Canonical render order for domains. The dashboard uses this to
 * order the "Your checks" section AFTER filtering to domains with
 * data, and to order the "Available" section.
 *
 * Active screeners first (most actionable for the 45+ cohort), then
 * the two umbrellas.
 */
export const DOMAIN_ORDER: ReadonlyArray<DomainId> = [
  "mood",
  "anxiety",
  "sleep",
  "alcohol",
  "urinary",
  "menopause",
  "hormonal",
  "health_markers",
  "health_history",
];

/**
 * Domains that are ALWAYS surfaced regardless of cohort. The two
 * umbrella domains accept data from any user (you can upload a lab,
 * record a condition, etc., without being in any specific cohort).
 */
const UNIVERSAL_DOMAINS: ReadonlySet<DomainId> = new Set<DomainId>([
  "health_markers",
  "health_history",
]);

/**
 * Return the domains relevant to a user's cohort, in render order.
 *
 * Cohort gating cribs off the existing `instrumentsFor(sexAtBirth)`
 * helper — the same set of instruments that get offered as
 * questionnaires get their domain cards surfaced here. For
 * `sex_at_birth ∈ { "unknown", "intersex", null }`, the unisex
 * instruments' domains apply (Mood / Anxiety / Sleep / Alcohol).
 *
 * Universal domains are always included.
 */
export function domainsForCohort(
  sexAtBirth: SexAtBirth | null | undefined,
): ReadonlyArray<DomainId> {
  const relevant = new Set<DomainId>(UNIVERSAL_DOMAINS);
  const insts = instrumentsFor(sexAtBirth);
  for (const inst of insts) {
    const dom = INSTRUMENT_TO_DOMAIN[inst.id];
    if (dom) relevant.add(dom);
  }
  return DOMAIN_ORDER.filter((d) => relevant.has(d));
}

/**
 * Resolve the domain for a SINGLE observation row.
 *
 * For questionnaire rows we honor `metadata.instrument` (passed by
 * the caller after parsing metadata_json) ahead of the category
 * map. For non-questionnaire rows the category map is authoritative.
 *
 * Returns `null` when the input is unrecognizable — the caller
 * should treat as "skip this row" rather than crash. This is the
 * defensive default that mirrors `parseObservationMetadata`'s
 * tolerance.
 */
export function domainForRow(args: {
  category: ObservationCategory;
  metadataInstrument: string | null;
}): DomainId | null {
  if (args.metadataInstrument != null) {
    const dom = INSTRUMENT_TO_DOMAIN[args.metadataInstrument];
    if (dom) return dom;
  }
  return CATEGORY_TO_DOMAIN[args.category] ?? null;
}

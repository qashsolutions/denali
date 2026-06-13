/**
 * Preventive-care layer — USPSTF-sourced screening cadence by age + sex
 * (scaffold; operator review 2026-06-13).
 *
 * GOAL: a "Due for…" surface (e.g. bone-density scan, mammogram, lipid panel,
 * colorectal screening) driven by US Preventive Services Task Force
 * recommendations, filtered to the user's age + sex_at_birth. This is the
 * age/gender-relevant layer that complements the marker catalog: the catalog
 * is what you can LOG, this is what's DUE.
 *
 * BOUNDARY (load-bearing): the recommendation SET + cadences are CLINICAL
 * content. They MUST come from the USPSTF Prevention TaskForce API / ePSS (or
 * a clinical-reviewer extract), NEVER hand-authored in code — same rule as
 * the interpretation table + CURATED_PANELS. So `PREVENTIVE_RECOMMENDATIONS`
 * ships EMPTY here; populating it is a clinical-reviewer + integration task.
 * The `dueScreenings` logic is pure and ready — it returns [] until the set
 * is supplied. Any surface built on this must "explain, never recommend"
 * beyond stating the standardized cadence + the operator-locked referral verb.
 *
 * INTEGRATION PLAN (docs/design/biomarkers-longitudinal-v1.md):
 *   - Source: USPSTF Prevention TaskForce API (free, key-gated) — the
 *     authoritative, machine-readable age/sex screening recommendations.
 *   - Sync: fetch + map to PreventiveRecommendation, store as a VERSIONED set
 *     with provenance. Queries are by age/sex only (no PHI leaves device —
 *     same posture as the government-API tools).
 *   - "Last done" dates come from LOCAL observations (e.g. a logged mammogram
 *     / DEXA date) — never transmitted.
 */

import type { SexAtBirth } from "@/contracts";

export interface PreventiveRecommendation {
  /** Stable id (USPSTF topic id once integrated). */
  id: string;
  /** Plain-language title — e.g. "Bone density scan". No acronyms. */
  title: string;
  /** Plain-language one-liner: what + why (factual, no directive). */
  summary: string;
  /** Sexes this applies to (sex_at_birth). Empty = all. */
  sex: ReadonlyArray<SexAtBirth>;
  /** Inclusive age window in years; null bound = open-ended. */
  ageMin: number | null;
  ageMax: number | null;
  /** Cadence in months (24 = every 2 years); null = one-time / clinician-set. */
  cadenceMonths: number | null;
  /** Provenance — USPSTF topic + grade + retrieval date once integrated. */
  source: string;
}

/**
 * The recommendation set. EMPTY by design — populated ONLY from the USPSTF
 * API / a clinical-reviewer extract (see module docblock). Never hand-author
 * clinical screening rules here.
 */
export const PREVENTIVE_RECOMMENDATIONS: ReadonlyArray<PreventiveRecommendation> =
  [];

export interface DueScreening {
  rec: PreventiveRecommendation;
  /** ISO date the screening was last done, or null if never. */
  lastDone: string | null;
}

/**
 * Pure: given the (age, sex) cohort + a map of last-done dates by rec id,
 * return the recommendations that apply AND are due (never done, or older
 * than the cadence). Returns [] until a recommendation set is supplied.
 * `now` is injected for deterministic testing.
 */
export function dueScreenings(args: {
  sexAtBirth: SexAtBirth | null | undefined;
  ageYears: number | null;
  lastDoneByRecId: Readonly<Record<string, string | undefined>>;
  now: Date;
  recommendations?: ReadonlyArray<PreventiveRecommendation>;
}): DueScreening[] {
  const recs = args.recommendations ?? PREVENTIVE_RECOMMENDATIONS;
  const out: DueScreening[] = [];
  for (const rec of recs) {
    // Sex gate — empty `sex` = applies to all.
    if (
      rec.sex.length > 0 &&
      (args.sexAtBirth == null || !rec.sex.includes(args.sexAtBirth))
    ) {
      continue;
    }
    // Age gate. Never surface an age-specific screen when age is unknown
    // (CLAUDE.md: never apply an age-specific range when ageYears is null) —
    // a rec carrying ANY age bound is withheld until the user's age is known.
    // Recs with no age bound still surface for unknown age.
    if (rec.ageMin != null || rec.ageMax != null) {
      if (args.ageYears == null) continue;
      if (rec.ageMin != null && args.ageYears < rec.ageMin) continue;
      if (rec.ageMax != null && args.ageYears > rec.ageMax) continue;
    }
    const lastDone = args.lastDoneByRecId[rec.id] ?? null;
    if (lastDone == null) {
      out.push({ rec, lastDone: null }); // never done → due
      continue;
    }
    if (rec.cadenceMonths != null) {
      const dueAfter = new Date(lastDone);
      dueAfter.setMonth(dueAfter.getMonth() + rec.cadenceMonths);
      if (args.now.getTime() >= dueAfter.getTime()) {
        out.push({ rec, lastDone });
      }
    }
  }
  return out;
}

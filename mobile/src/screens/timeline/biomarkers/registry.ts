/**
 * Curated biomarker panels — Phase-3 increment 1 (architecture, content
 * to be supplied by clinical reviewer + guidelines).
 *
 * The dashboard's `health_markers` domain eventually surfaces a sex+age
 * CURATED set of "markers commonly tracked at your age and sex" —
 * populated from the user's uploaded lab/vital/device data where
 * present, shown as educational empty slots where not.
 *
 * BOUNDARY rules (load-bearing per mobile/CLAUDE.md → Engineering rules
 * § Display + clinical boundary):
 *   - Education + organization, NEVER screening recommendations.
 *   - Strings describe what a marker IS, never tell the user to get
 *     one tested.
 *   - Curated panels + ranges come from a clinical reviewer + sourced
 *     guidelines. Schema is in place; content awaits.
 *   - Age is OPTIONAL: with age → age+sex panel; without age →
 *     sex-only panel (no age-specific normal/abnormal claim). Never
 *     apply age-specific ranges when age is null.
 *   - Sex is the clinical key (sex_at_birth). When sex is unknown
 *     (intersex / null), no panel is returned.
 */

import type { SexAtBirth } from "@/contracts";

export interface CuratedBiomarkerPanel {
  /** Stable id — used for telemetry and panel reuse. */
  panelId: string;
  sex: "male" | "female";
  /** "specific" carries age range; "any" is the sex-only fallback panel. */
  ageRange:
    | { kind: "specific"; min: number; max: number }
    | { kind: "any" };
  /**
   * LOINC codes for the curated markers, ordered by salience (most
   * commonly tracked first). The dashboard joins these against the
   * user's observations to produce tracked / untracked slots.
   */
  loincCodes: ReadonlyArray<string>;
  /** Guideline citation. Provisional until clinical reviewer ships. */
  source: string;
  /** True until clinical review. */
  provisional: boolean;
}

/**
 * Increment 1 ships this EMPTY. The schema is in place; the dashboard's
 * health_markers card renders the generic non-prescriptive prompt until
 * a panel arrives. Adding content requires the clinical reviewer to
 * supply a sourced list — do NOT populate from memory.
 */
export const CURATED_PANELS: ReadonlyArray<CuratedBiomarkerPanel> = [];

/**
 * Pick the curated panel matching the user's cohort.
 *
 * Match policy (delta from Phase-3 plan):
 *   - sex unknown / intersex / null → return null (no panel claim).
 *   - sex known + age known → match (sex, age ∈ range).
 *   - sex known + age null → match (sex, ageRange.kind === "any").
 *
 * Returns null when no panel matches (including when CURATED_PANELS is
 * empty, as in increment 1). The dashboard renders the generic
 * non-prescriptive prompt in that case.
 */
export function getCuratedPanel(
  sexAtBirth: SexAtBirth | null | undefined,
  ageYears: number | null,
): CuratedBiomarkerPanel | null {
  if (sexAtBirth !== "male" && sexAtBirth !== "female") return null;
  const sex = sexAtBirth;

  if (ageYears == null) {
    // Sex-only fallback panel.
    return (
      CURATED_PANELS.find(
        (p) => p.sex === sex && p.ageRange.kind === "any",
      ) ?? null
    );
  }

  // Specific age range match.
  return (
    CURATED_PANELS.find(
      (p) =>
        p.sex === sex &&
        p.ageRange.kind === "specific" &&
        ageYears >= p.ageRange.min &&
        ageYears <= p.ageRange.max,
    ) ?? null
  );
}

/**
 * Per-biomarker educational copy — Phase-3 increment 1 (architecture
 * only; content awaits clinical reviewer).
 *
 * Shown in the health_markers domain detail screen when a curated
 * panel surfaces a marker the user has NO data for. Strict boundary
 * (mobile/CLAUDE.md → Display + clinical boundary):
 *
 *   - `whatItIs`: descriptive — what the biomarker measures.
 *   - `whyTracked`: explanatory — why clinicians commonly track it.
 *   - NEVER prescriptive — no "you should get tested for X", no
 *     "schedule a panel", no test directives. The boundary lint test
 *     in __tests__/registry.test.ts asserts the regex
 *     /(should|need to|must).{0,30}test/i rejects every shipped
 *     education entry.
 *
 * Increment 1 ships the map empty. Adding entries requires the
 * clinical reviewer to supply sourced, non-prescriptive copy.
 */

export interface BiomarkerEducation {
  /** LOINC code (matches CuratedBiomarkerPanel.loincCodes). */
  loinc: string;
  /** Plain-language friendly name (typically mirrors LAB_FRIENDLY_NAME). */
  friendlyName: string;
  /** Descriptive — what the marker measures. */
  whatItIs: string;
  /** Explanatory — why clinicians commonly track this marker. */
  whyTracked: string;
  /** True until clinical review. */
  provisional: boolean;
}

/**
 * Increment 1: empty. The dashboard's untracked-slot UI handles the
 * empty case by rendering the generic non-prescriptive prompt
 * ("Talking with your doctor about which markers matter for you").
 */
export const BIOMARKER_EDUCATION: Readonly<Record<string, BiomarkerEducation>> = {};

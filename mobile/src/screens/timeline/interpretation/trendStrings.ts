/**
 * Trend strings V1 — versioned user-facing copy for the Step-3 trend
 * layer, governed alongside the interpretation table (same rules: copy
 * lives HERE, renderers only fill templates; never synthesized at
 * render time; provenance attached).
 *
 * These strings are FACTUAL/NAVIGATIONAL — they restate stored scores
 * and dates and make no clinical interpretation, so they carry no ‡
 * provisional mark at render (the band pill next to them does). They
 * still ship pending_clinical_review so the reviewer signs off on the
 * register like all curated copy.
 *
 * Hard rules (Step-3 prompt + clinical boundary): template-only deltas
 * from stored scores; no population comparisons; no advice phrasing;
 * nothing model-generated.
 */

import type { ProvenanceRecord } from "@/lib/provenance";

export const TREND_STRINGS_VERSION = "1.0.0-provisional";

export const TREND_STRINGS_PROVENANCE: ProvenanceRecord = {
  source:
    "Operator-approved Step-2 Part D plan + Step-3 prompt (factual delta templates and quiet-state copy; no clinical claims).",
  pmid_or_code_system_version: null,
  retrieved_at: null,
  review_status: "pending_clinical_review",
};

/** n=1 quiet state — no chart, no placeholder axes. */
export const TREND_EMPTY_STATE =
  "Your trend will appear after your next check-in.";

const DELTA_MOVED = "Your score moved from {{from}} to {{to}} since {{date}}.";
const DELTA_UNCHANGED = "Your score is unchanged since {{date}}.";

/**
 * Fill the delta template from stored scores. Comparison semantics
 * (latest vs immediately previous check-in, independent of the selected
 * range) live in trend/sessions.ts deltaPair; this only words it.
 */
export function formatTrendDelta(
  previousScore: number,
  latestScore: number,
  previousDateLabel: string,
): string {
  if (previousScore === latestScore) {
    return DELTA_UNCHANGED.replace("{{date}}", previousDateLabel);
  }
  return DELTA_MOVED.replace("{{from}}", String(previousScore))
    .replace("{{to}}", String(latestScore))
    .replace("{{date}}", previousDateLabel);
}

const A11Y_TEMPLATE =
  "{{instrument}} trend chart. Latest score {{score}}, {{band}}.";

/**
 * Accessibility label for the chart container — built from the same
 * curated vocabulary (instrument friendly name, latest score, the
 * band's plain-language pill), optionally followed by the delta line.
 */
export function formatTrendAccessibilityLabel(
  instrumentName: string,
  latestScore: number,
  bandPill: string,
  deltaText?: string | null,
): string {
  const base = A11Y_TEMPLATE.replace("{{instrument}}", instrumentName)
    .replace("{{score}}", String(latestScore))
    .replace("{{band}}", bandPill);
  return deltaText ? `${base} ${deltaText}` : base;
}

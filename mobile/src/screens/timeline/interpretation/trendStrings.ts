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

const LAST_CHECKINS = "Last {{n}} check-ins";
const LAST_CHECKIN_SINGULAR = "Last check-in";

/**
 * Dashboard sparkline meta line (Increment 2) — navigation/structural
 * label restating how many points the mini-trend shows. Factual, no
 * clinical claim; versioned here rather than inlined as a JSX literal.
 */
export function formatLastCheckins(n: number): string {
  return n === 1 ? LAST_CHECKIN_SINGULAR : LAST_CHECKINS.replace("{{n}}", String(n));
}

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

// ─── BMI delta strings ───────────────────────────────────────────────────────
//
// Same versioning rules as instrument deltas: factual/navigational,
// no interpretation verb, no population comparison, no advice phrasing.
// BMI values rounded to 1 dp in the string (display only — value_num
// keeps full precision in the DAL).

const BMI_DELTA_MOVED =
  "Your BMI moved from {{from}} to {{to}} since {{date}}.";
const BMI_DELTA_UNCHANGED = "Your BMI is unchanged since {{date}}.";

/**
 * Fill the BMI delta template from derived values. Comparison semantics
 * (latest vs immediately previous point, full history) live in
 * BmiTrendChart; this only words it.
 *
 * Both values are rounded to 1 dp in the output — display chrome, not
 * stored precision. The rounding matches the display convention in
 * bmi.ts (deriveBmiTrend rounds each point to 1 dp at derivation time,
 * so the round here is a no-op for most callers; it guards edge cases
 * where a caller passes a raw float).
 */
export function formatBmiTrendDelta(
  previousBmi: number,
  latestBmi: number,
  previousDateLabel: string,
): string {
  const from = previousBmi.toFixed(1);
  const to = latestBmi.toFixed(1);
  if (from === to) {
    return BMI_DELTA_UNCHANGED.replace("{{date}}", previousDateLabel);
  }
  return BMI_DELTA_MOVED.replace("{{from}}", from)
    .replace("{{to}}", to)
    .replace("{{date}}", previousDateLabel);
}

// ─── Generic marker delta strings ─────────────────────────────────────────────
//
// For raw markers (weight, waist, labs) on the per-marker history screen.
// Same versioning rules: factual/navigational, no interpretation verb, no
// population comparison, no advice phrasing. The from/to are PRE-FORMATTED
// value+unit labels ("78 kg") built by the caller via formatMarkerValue — this
// only words the sentence. "Unchanged" is decided by the DISPLAYED labels being
// equal, so the copy always matches what the user sees on the card.

const MARKER_DELTA_MOVED =
  "Your {{marker}} moved from {{from}} to {{to}} since {{date}}.";
const MARKER_DELTA_UNCHANGED = "Your {{marker}} is unchanged since {{date}}.";

/**
 * Fill the generic marker delta template. `markerName` is the plain-language
 * name as shown on the card (e.g. "Weight"); `fromLabel`/`toLabel` are the
 * already-formatted value+unit strings (e.g. "78 kg"). Comparison semantics
 * (latest vs immediately previous reading, full history) live in the caller.
 */
export function formatMarkerTrendDelta(
  markerName: string,
  fromLabel: string,
  toLabel: string,
  previousDateLabel: string,
): string {
  if (fromLabel === toLabel) {
    return MARKER_DELTA_UNCHANGED.replace("{{marker}}", markerName).replace(
      "{{date}}",
      previousDateLabel,
    );
  }
  return MARKER_DELTA_MOVED.replace("{{marker}}", markerName)
    .replace("{{from}}", fromLabel)
    .replace("{{to}}", toLabel)
    .replace("{{date}}", previousDateLabel);
}

// ─── Accessibility ────────────────────────────────────────────────────────────

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

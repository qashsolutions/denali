/**
 * Phase 1 mobile — report interpretation helpers (pure, node-safe).
 *
 * CLINICAL BOUNDARY (load-bearing): this layer NEVER diagnoses, names a
 * condition, assesses risk, or recommends anything. It only restates what the
 * REPORT itself printed:
 *   - the report's own abnormal flag (H/L/Critical) → a red/amber/green chip;
 *   - a factual count of how many values the report flagged.
 * The flag is SOURCED — from the structured `abnormal_flag` the backend copied
 * off the report, or (fallback, until that backend ships) from the verbatim
 * `source_text`. We never synthesise a flag the report didn't state; a value
 * with no stated flag returns null → no chip, no claim.
 *
 * Severity vocabulary maps to the app's existing pill tints (ok/watch/alarm),
 * so the review chips read the same red/amber/"green"(teal) language as the
 * dashboard bands. Kept RN-free for vitest.
 */

import type { ExtractedObservation } from "./types";

export type ReportFlag = "normal" | "low" | "high" | "critical";

/** Pill tint classes reused from the band system (see pill.ts `tintByClass`). */
export type RagTint = "ok" | "watch" | "alarm";

export interface RagResult {
  tint: RagTint;
  /** Plain-language restatement of the report's flag — NOT a diagnosis. */
  label: string;
}

/**
 * Resolve the report's own flag for one observation, then map to a chip.
 * Returns null when the report stated no flag — we make no claim.
 */
export function ragForObservation(obs: ExtractedObservation): RagResult | null {
  const flag = obs.abnormal_flag ?? flagFromSourceText(obs.source_text);
  switch (flag) {
    case "normal":
      return { tint: "ok", label: "In range" };
    case "high":
      return { tint: "watch", label: "Flagged high" };
    case "low":
      return { tint: "watch", label: "Flagged low" };
    case "critical":
      return { tint: "alarm", label: "Flagged critical" };
    default:
      return null;
  }
}

/**
 * Fallback flag detection from the verbatim source excerpt. Matches only the
 * report's explicit flag WORDS (HIGH/LOW/CRITICAL/PANIC/NORMAL/WNL) — never
 * single letters (a stray "L" in "mL" or a unit must not read as "low"). If
 * the report printed no flag word, returns null (no claim).
 */
function flagFromSourceText(src: string | null | undefined): ReportFlag | null {
  if (!src) return null;
  const s = src.toUpperCase();
  if (/\b(CRITICAL|PANIC)\b/.test(s)) return "critical";
  if (/\bHIGH\b/.test(s)) return "high";
  if (/\bLOW\b/.test(s)) return "low";
  if (/\b(NORMAL|WNL)\b/.test(s)) return "normal";
  return null;
}

/**
 * Crisp, factual, report-only summary of what was extracted. Counts values
 * and how many the REPORT flagged out of range. No diagnosis, no condition
 * names, no risk language. Empty string for zero observations (the screen
 * shows its own empty state).
 */
export function summarizeReport(
  observations: ReadonlyArray<ExtractedObservation>,
): string {
  const n = observations.length;
  if (n === 0) return "";
  const flagged = observations.filter((o) => {
    const r = ragForObservation(o);
    return r != null && r.tint !== "ok";
  }).length;
  const values = n === 1 ? "value" : "values";
  if (flagged === 0) {
    return `Read ${n} ${values} from this report. None are flagged outside the range on your report.`;
  }
  const verb = flagged === 1 ? "is" : "are";
  return `Read ${n} ${values} from this report. ${flagged} ${verb} flagged outside the range on your report.`;
}

const TYPE_LABEL: Record<string, string> = {
  lab: "Lab results",
  ehr: "EHR export",
  visit: "Visit summary",
};

/**
 * Suggest an identifiable default name so a user never has to think about it:
 * "{report type} · {Mon YYYY}", e.g. "Lab results · Jun 2026". `date` is passed
 * in (testable; no internal clock). Editable downstream.
 */
export function suggestReportName(reportType: string, date: Date): string {
  const label = TYPE_LABEL[reportType] ?? "Report";
  const month = date.toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
  return `${label} · ${month}`;
}

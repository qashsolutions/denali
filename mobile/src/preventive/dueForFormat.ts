/**
 * Pure display helpers for the "Due for…" preventive card. Kept separate from
 * the RN component so the wording logic is node-unit-testable.
 *
 * BOUNDARY: these format FACTS only — the standardized cadence and when a
 * screening was last logged. No directive phrasing ("you should…"); the card's
 * only soft pointer is the operator-locked referral verb, rendered separately.
 */

import type { DueScreening } from "./uspstf";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
] as const;

/** Factual cadence phrase from a month interval. null → null (no cadence). */
export function formatCadence(months: number | null): string | null {
  if (months == null) return null;
  if (months % 12 === 0) {
    const years = months / 12;
    return years === 1 ? "every year" : `every ${years} years`;
  }
  return months === 1 ? "every month" : `every ${months} months`;
}

/** "Apr 2026" from an ISO date; "" if unparseable. Locale-free (deterministic). */
export function formatMonthYear(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (m == null) return "";
  const month = MONTHS[Number(m[2]) - 1];
  return month == null ? "" : `${month} ${m[1]}`;
}

/**
 * Factual meta line for a due screening — the standardized interval + when it
 * was last logged. States facts only, never a directive.
 */
export function formatDueMeta(d: DueScreening): string {
  const parts: string[] = [];
  const cadence = formatCadence(d.rec.cadenceMonths);
  if (cadence != null) parts.push(`Usually ${cadence}`);
  parts.push(
    d.lastDone == null
      ? "no date logged yet"
      : `last logged ${formatMonthYear(d.lastDone)}`,
  );
  return parts.join(" · ");
}

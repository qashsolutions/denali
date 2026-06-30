/**
 * latestPerCode — collapse marker rows to ONE row per LOINC code (the most
 * recent reading).
 *
 * Used by the Health-markers detail (D27) so logging a marker daily/weekly
 * shows a SINGLE "latest" card per marker rather than a card-per-entry wall.
 * The longitudinal record is not lost — it lives in the trend chart's dots
 * (BMI today; per-marker charts as they come online) and, always, in the
 * append-only DAL / export. This helper feeds ONLY the card list; the chart is
 * always fed the full unfiltered history.
 *
 * Pure + order-stable: defensively sorts newest-first (so the result does not
 * depend on caller ordering) and keeps the first row seen per `code`. Display
 * concern only — never mutates storage, never drops a row from the DAL.
 *
 * NOT a clinical operation: it selects by recency, not by value; it does not
 * interpret, rank, or compare readings.
 */

import type { ObservationRow } from "@/contracts";

export function latestPerCode(
  rows: ReadonlyArray<ObservationRow>,
): ObservationRow[] {
  // Newest-first by effective_at, tie-broken by recorded_at then id so the
  // pick is deterministic when two readings share an effective_at.
  const sorted = [...rows].sort((a, b) => {
    if (a.effective_at !== b.effective_at) {
      return a.effective_at < b.effective_at ? 1 : -1;
    }
    if (a.recorded_at !== b.recorded_at) {
      return a.recorded_at < b.recorded_at ? 1 : -1;
    }
    return a.id < b.id ? 1 : -1;
  });
  const seen = new Set<string>();
  const out: ObservationRow[] = [];
  for (const row of sorted) {
    if (seen.has(row.code)) continue;
    seen.add(row.code);
    out.push(row);
  }
  return out;
}

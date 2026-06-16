/**
 * instrumentDomainView — pure consolidation model for an instrument domain
 * detail (D30).
 *
 * The instrument DomainDetail shows the trend chart (every check-in as a dot) +
 * the LATEST check-in card only; the full session history drills down to
 * InstrumentHistory. This helper makes the three decisions testable in node:
 *
 *   - latest: the most-recent session (newest-first), or null.
 *   - chartableInstrumentIds: the unique chartable instruments across ALL
 *     sessions, most-recent-first. LOAD-BEARING: computed from every session,
 *     NOT from the (now single-card) rendered list — else a domain whose latest
 *     check-in is the non-chartable PHQ-2 gate would lose its chart. PHQ-2 is
 *     always skipped (it's the gate screen, never charted — operator review
 *     2026-06-12).
 *   - hasHistory: more than one session ⇒ the latest card is a drill-down.
 *
 * Pure (no React/DAL). Mirrors latestPerCode (D27) / deriveMarkerChartModel (D28).
 */

import type { TimelineCard } from "./grouping";
import { isChartableInstrument } from "./trend/sessions";

export interface InstrumentDomainView {
  latest: TimelineCard | null;
  chartableInstrumentIds: string[];
  hasHistory: boolean;
}

function effectiveAt(card: TimelineCard): string {
  return card.kind === "instrument-session"
    ? card.effective_at
    : card.row.effective_at;
}

export function instrumentDomainView(
  sessions: ReadonlyArray<TimelineCard>,
): InstrumentDomainView {
  const sorted = [...sessions].sort((a, b) =>
    effectiveAt(a) < effectiveAt(b) ? 1 : -1,
  ); // newest-first

  const seen = new Set<string>();
  const chartableInstrumentIds: string[] = [];
  for (const s of sorted) {
    if (s.kind !== "instrument-session") continue;
    if (seen.has(s.instrumentId)) continue;
    seen.add(s.instrumentId);
    if (s.instrumentId === "PHQ-2") continue; // gate screen, never charted
    if (isChartableInstrument(s.instrumentId)) {
      chartableInstrumentIds.push(s.instrumentId);
    }
  }

  return {
    latest: sorted.length > 0 ? sorted[0] : null,
    chartableInstrumentIds,
    hasHistory: sorted.length > 1,
  };
}

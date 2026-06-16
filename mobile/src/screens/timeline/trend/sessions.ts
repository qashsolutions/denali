/**
 * Trend sessions — pure helpers for the Step-3 trend chart data path.
 *
 * Query shape (per the approved Step-2 Part D plan):
 *
 *   dal.listObservations({ category: "questionnaire", latest_only: true,
 *                          since: <range start; OMITTED for "all">,
 *                          limit: TREND_QUERY_LIMIT })
 *     → groupByInstrumentSession → filter to instrument
 *     → per-session score (sum; ADAM excluded from charts entirely)
 *     → ascending by effective_at.
 *
 * LOAD-BEARING: the limit is the 2000 backstop, NEVER the dashboard's
 * PAGE_SIZE = 200 (which truncates history to ~22 PHQ-9 sessions). A
 * pinned test enforces this.
 *
 * Pure module — no React, no DAL. The hook (useInstrumentSessions.ts)
 * supplies live state; decision logic stays here with explicit args
 * (mobile/CLAUDE.md stale-closure rule).
 */

import type { ObservationRow, ObservationsFilter, SexAtBirth } from "@/contracts";

import { groupByInstrumentSession } from "../grouping";
import {
  INTERPRETATION_TABLE_V1,
  type InterpretationBand,
} from "../interpretation/tableV1";
import { computeSessionScore } from "../rollup";

export type TrendRange = "3m" | "6m" | "y" | "all";

export const TREND_RANGES: ReadonlyArray<TrendRange> = ["3m", "6m", "y", "all"];

/** Backstop only — far above any real cadence; never the UI PAGE_SIZE. */
export const TREND_QUERY_LIMIT = 2000;

export interface ScoredSession {
  /** ISO timestamp of the session (shared effective_at of its items). */
  effective_at: string;
  /** Completed-session score (sum of item values). */
  score: number;
}

/**
 * Chartable = the table ships a scoreRange for the instrument. ADAM has
 * none (binary outcome — a score-over-time line would be dishonest).
 */
export function isChartableInstrument(instrumentId: string): boolean {
  return (
    INTERPRETATION_TABLE_V1.instruments[instrumentId]?.scoreRange != null
  );
}

/**
 * Inclusive lower bound for a range, as ISO; null for "all". UTC month
 * math — deterministic across device timezones and DST boundaries (the
 * pinned boundary test would otherwise drift an hour at DST).
 */
export function rangeStartIso(range: TrendRange, now: Date): string | null {
  if (range === "all") return null;
  const start = new Date(now.getTime());
  const months = range === "3m" ? 3 : range === "6m" ? 6 : 12;
  start.setUTCMonth(start.getUTCMonth() - months);
  return start.toISOString();
}

/**
 * The exact DAL filter for a trend query. `since` omitted for "all";
 * `limit` is always the 2000 backstop.
 */
export function buildTrendQuery(
  range: TrendRange,
  now: Date,
): ObservationsFilter {
  const since = rangeStartIso(range, now);
  return {
    category: "questionnaire",
    latest_only: true,
    ...(since != null ? { since } : {}),
    limit: TREND_QUERY_LIMIT,
  };
}

/**
 * Rows → completed scored sessions for ONE instrument, ascending by
 * effective_at. Incomplete sessions (null score) are dropped — a chart
 * point must be a real total.
 */
export function computeScoredSessions(
  rows: ReadonlyArray<ObservationRow>,
  instrumentId: string,
): ScoredSession[] {
  const cards = groupByInstrumentSession([...rows]);
  const out: ScoredSession[] = [];
  for (const card of cards) {
    if (card.kind !== "instrument-session") continue;
    if (card.instrumentId !== instrumentId) continue;
    const score = computeSessionScore(card.instrumentId, card.items);
    if (score == null) continue;
    out.push({ effective_at: card.effective_at, score });
  }
  out.sort((a, b) => (a.effective_at < b.effective_at ? -1 : 1));
  return out;
}

/**
 * The band set the chart shades for a user — same sex resolution as the
 * lookup layer: sex-specific instruments (AUDIT-C) use the male set for
 * "male" and the female (more-sensitive) set for everyone else, per the
 * documented fallback. age-sex-specific strategies have no instrument
 * consumers; charts render no bands for them.
 */
export function chartBandsFor(
  instrumentId: string,
  sexAtBirth: SexAtBirth | null,
): ReadonlyArray<InterpretationBand> {
  const entry = INTERPRETATION_TABLE_V1.instruments[instrumentId];
  if (entry?.scoreRange == null) return [];
  const strategy = entry.strategy;
  if (strategy.kind === "uniform") return strategy.bands;
  if (strategy.kind === "sex-specific") {
    return sexAtBirth === "male"
      ? strategy.bandsBySex.male
      : strategy.bandsBySex.female;
  }
  return [];
}

/**
 * Latest vs immediately-previous check-in — the delta pair is computed
 * from the FULL session history ("all"), independent of the selected
 * chart range (Step-3 rule 13).
 */
export function deltaPair(
  allSessions: ReadonlyArray<ScoredSession>,
): { previous: ScoredSession; latest: ScoredSession } | null {
  if (allSessions.length < 2) return null;
  return {
    previous: allSessions[allSessions.length - 2],
    latest: allSessions[allSessions.length - 1],
  };
}

/** A band's vertical extent in SCORE space for the chart (before pixel mapping). */
export interface BandScoreSpan {
  band: InterpretationBand;
  /** Top of the band in score space (higher score → higher on the chart). */
  top: number;
  /** Bottom of the band in score space. */
  bottom: number;
  /** Score of the hairline boundary BELOW this band; null for the lowest band. */
  boundary: number | null;
}

/**
 * Lay out chart bands in SCORE space (before pixel mapping). Bands fill the
 * HALF-STEP-PADDED domain [scoreRange.min - 0.5, scoreRange.max + 0.5];
 * interior boundaries are the MIDPOINT between adjacent (sorted, range-clamped)
 * bands. For integer-inclusive instrument bands this is IDENTICAL to the
 * legacy ±0.5 tiling — e.g. bands [0,4][5,9] → boundary 4.5, padded edges
 * -0.5 / 9.5 — so instrument charts render pixel-for-pixel as before. For
 * decimal bands (BMI: 18.4/18.5, 24.9/25.0, 29.9/30.0) it tiles with no gap or
 * overlap. Pure + unit-tested; the renderer maps these scores through yOf().
 */
export function layoutBandScores(
  bands: ReadonlyArray<InterpretationBand>,
  scoreRange: { min: number; max: number },
): BandScoreSpan[] {
  const lo = scoreRange.min - 0.5;
  const hi = scoreRange.max + 0.5;
  const sorted = [...bands]
    .sort((a, b) => a.minScore - b.minScore)
    .map((b) => ({
      band: b,
      minScore: Math.max(b.minScore, scoreRange.min),
      maxScore: Math.min(b.maxScore, scoreRange.max),
    }));
  const boundaries: number[] = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    boundaries.push((sorted[i].maxScore + sorted[i + 1].minScore) / 2);
  }
  return sorted.map((s, idx) => ({
    band: s.band,
    top: idx === sorted.length - 1 ? hi : boundaries[idx],
    bottom: idx === 0 ? lo : boundaries[idx - 1],
    boundary: idx > 0 ? boundaries[idx - 1] : null,
  }));
}

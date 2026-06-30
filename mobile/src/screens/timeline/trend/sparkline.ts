/**
 * Sparkline helpers — Increment 2 (dashboard DomainCard mini-trend).
 *
 * Pure module (no React, no RN): the dashboard card already holds the
 * instrument-domain rollup's `sessions` array, so the sparkline needs
 * NO new DAL query — it scores those sessions and projects the last few
 * into a tiny polyline.
 *
 * Honesty gate (the clinical judgment the design notes call out — a
 * dramatic mental-health trend would be the wrong call, and sparse
 * ordinal data can't support one): a sparkline renders ONLY with ≥2
 * complete sessions. With 0–1, `sparklinePolyline` returns null and the
 * card shows the pill alone — no flat line, no fake density.
 */

import type { TimelineCard } from "../grouping";
import { computeSessionScore } from "../rollup";

/** Max points shown on a card sparkline (mockup "Last 5 check-ins"). */
export const SPARKLINE_MAX_POINTS = 5;

/**
 * Last `maxN` COMPLETE session scores for an instrument, chronological
 * (oldest → newest). `sessions` arrive newest-first (rollup convention);
 * incomplete sessions (null score) are dropped — a point must be a real
 * total. Non-instrument cards never call this.
 */
export function recentSessionScores(
  sessions: ReadonlyArray<TimelineCard>,
  maxN: number = SPARKLINE_MAX_POINTS,
): number[] {
  const scored: number[] = [];
  // sessions are newest-first; walk newest → oldest, collecting up to
  // maxN complete scores, then reverse to chronological for plotting.
  for (const card of sessions) {
    if (scored.length >= maxN) break;
    if (card.kind !== "instrument-session") continue;
    const score = computeSessionScore(card.instrumentId, card.items);
    if (score == null) continue;
    scored.push(score);
  }
  return scored.reverse();
}

export interface SparklineGeometry {
  /** SVG polyline `points` attribute (chronological). */
  points: string;
  /** End (latest) dot position. */
  endX: number;
  endY: number;
}

/**
 * Project scores into a polyline for a `width`×`height` viewBox, scaled
 * to the instrument's `scoreRange`. Returns null when fewer than 2
 * scored points exist (the honesty gate) so the caller renders nothing.
 *
 * Y is inverted (higher score → higher on screen = smaller y). A
 * half-step pad keeps single-band-flat lines off the exact top/bottom
 * edge, matching the detail chart's domain treatment.
 */
export function sparklinePolyline(
  scores: ReadonlyArray<number>,
  scoreRange: { min: number; max: number },
  width: number,
  height: number,
  pad = 4,
): SparklineGeometry | null {
  if (scores.length < 2) return null;
  const lo = scoreRange.min;
  const hi = scoreRange.max;
  const span = hi - lo || 1;
  const plotH = Math.max(height - pad * 2, 1);
  const xOf = (i: number) => (i * width) / (scores.length - 1);
  const yOf = (v: number) => {
    const clamped = Math.min(Math.max(v, lo), hi);
    return pad + (1 - (clamped - lo) / span) * plotH;
  };
  const coords = scores.map((s, i) => ({ x: xOf(i), y: yOf(s) }));
  const points = coords.map((c) => `${c.x},${c.y}`).join(" ");
  const end = coords[coords.length - 1];
  return { points, endX: end.x, endY: end.y };
}

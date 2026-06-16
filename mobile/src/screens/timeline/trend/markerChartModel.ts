/**
 * markerChartModel — pure data model for the per-marker trend chart (D28).
 *
 * Extracts the axis/points/value-reference math out of MarkerTrendChart so it
 * is node-testable (no React, no DAL) — the same discipline as deriveBmiTrend +
 * layoutBandScores. The data-aware axis is exactly where the BMI "line outside
 * the chart" bug lived (D26), so it carries pinned tests.
 *
 * Rules:
 *   - Points: this code's numeric readings, ascending by effective_at.
 *   - Range filter: same UTC math as instruments (rangeStartIso); "all" keeps
 *     the full history.
 *   - scoreRange (display chrome, NOT a clinical cutoff): encompasses the
 *     plotted data AND, when the marker is banded, the bands' finite extent so
 *     every category shows; a value outside the bands is never clipped.
 *   - yRefValues: band-less markers only — the data min/max, to anchor a line
 *     that has no severity bands. Banded markers return null (bands convey
 *     position; the renderer stays byte-identical).
 */

import type { ObservationRow } from "@/contracts";

import type { InterpretationBand } from "../interpretation/tableV1";
import { rangeStartIso, type TrendRange } from "./sessions";

export interface MarkerChartPoint {
  score: number;
  effective_at: string;
}

export interface MarkerChartModel {
  /** Full history for this code, ascending — drives the range-independent delta. */
  allPoints: MarkerChartPoint[];
  /** Range-filtered points actually plotted. */
  chartPoints: MarkerChartPoint[];
  /** Padded display axis encompassing data (+ finite band bounds when banded). */
  scoreRange: { min: number; max: number };
  /** Band-less only: values to draw value-gridlines at (data min/max); else null. */
  yRefValues: number[] | null;
}

export function deriveMarkerChartModel(
  rows: ReadonlyArray<ObservationRow>,
  code: string,
  bands: ReadonlyArray<InterpretationBand>,
  range: TrendRange,
  now: Date,
): MarkerChartModel {
  const allPoints: MarkerChartPoint[] = rows
    .filter((r) => r.code === code && r.value_num != null)
    .map((r) => ({ score: r.value_num as number, effective_at: r.effective_at }))
    .sort((a, b) => (a.effective_at < b.effective_at ? -1 : 1));

  const since = rangeStartIso(range, now);
  const chartPoints =
    since == null ? allPoints : allPoints.filter((p) => p.effective_at >= since);

  const vals = chartPoints.map((p) => p.score);
  let scoreRange = { min: 0, max: 1 };
  if (vals.length > 0) {
    const finite = bands
      .flatMap((b) => [b.minScore, b.maxScore])
      .filter((n) => Number.isFinite(n));
    const lo = Math.min(...vals, ...(finite.length > 0 ? finite : vals));
    const hi = Math.max(...vals, ...(finite.length > 0 ? finite : vals));
    scoreRange = { min: Math.floor(lo) - 1, max: Math.ceil(hi) + 1 };
  }

  let yRefValues: number[] | null = null;
  if (bands.length === 0 && vals.length > 0) {
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    yRefValues = min === max ? [max] : [max, min];
  }

  return { allPoints, chartPoints, scoreRange, yRefValues };
}

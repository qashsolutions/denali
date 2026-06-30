/**
 * BMI trend range-filter tests.
 *
 * BmiTrendChart filters deriveBmiTrend points to the selected range window
 * using rangeStartIso (the same UTC month math as instrument sessions) with
 * effectiveAt >= since. These tests verify:
 *
 *   - 3m / 6m / y / all windows correctly include / exclude points.
 *   - Points exactly AT the start boundary are INCLUDED (>= semantics).
 *   - "all" returns every point regardless of date.
 *   - Empty result when no points fall in the window.
 *
 * Pure logic — no React, no DAL.
 */

import { describe, expect, it } from "vitest";

import { rangeStartIso, type TrendRange } from "../sessions";

/**
 * Apply the same filter BmiTrendChart uses:
 *   points where effectiveAt >= rangeStartIso(range, now)
 */
function filterBmiPoints(
  points: ReadonlyArray<{ effectiveAt: string; bmi: number }>,
  range: TrendRange,
  now: Date,
): Array<{ effectiveAt: string; bmi: number }> {
  const since = rangeStartIso(range, now);
  if (since == null) return [...points];
  return points.filter((p) => p.effectiveAt >= since);
}

const NOW = new Date("2026-06-15T12:00:00.000Z");

// Reference boundary ISOs (UTC month subtraction matches rangeStartIso)
// 3m → 2026-03-15T12:00:00.000Z
// 6m → 2025-12-15T12:00:00.000Z
// y  → 2025-06-15T12:00:00.000Z

const POINTS = [
  { effectiveAt: "2024-06-01T00:00:00.000Z", bmi: 31.0 }, // outside all except "all"
  { effectiveAt: "2025-06-15T12:00:00.000Z", bmi: 28.5 }, // exactly at 1y boundary
  { effectiveAt: "2025-12-15T12:00:00.000Z", bmi: 27.2 }, // exactly at 6m boundary
  { effectiveAt: "2026-03-15T12:00:00.000Z", bmi: 26.1 }, // exactly at 3m boundary
  { effectiveAt: "2026-06-01T00:00:00.000Z", bmi: 25.3 }, // inside all windows
];

describe("BMI trend range filter", () => {
  it('"all" returns every point', () => {
    expect(filterBmiPoints(POINTS, "all", NOW)).toHaveLength(5);
  });

  it('"y" includes points from exactly 12 months ago and newer', () => {
    const result = filterBmiPoints(POINTS, "y", NOW);
    // 2024-06-01 is outside (before 2025-06-15 boundary); the rest are in.
    expect(result).toHaveLength(4);
    expect(result[0].bmi).toBe(28.5); // exactly at boundary — included
  });

  it('"6m" includes points from exactly 6 months ago and newer', () => {
    const result = filterBmiPoints(POINTS, "6m", NOW);
    expect(result).toHaveLength(3);
    expect(result[0].bmi).toBe(27.2); // exactly at 6m boundary — included
  });

  it('"3m" includes points from exactly 3 months ago and newer', () => {
    const result = filterBmiPoints(POINTS, "3m", NOW);
    expect(result).toHaveLength(2);
    expect(result[0].bmi).toBe(26.1); // exactly at 3m boundary — included
  });

  it("returns empty array when no points fall in the window", () => {
    const oldPoints = [{ effectiveAt: "2020-01-01T00:00:00.000Z", bmi: 29.0 }];
    expect(filterBmiPoints(oldPoints, "3m", NOW)).toHaveLength(0);
  });

  it("returns empty array from empty input for any range", () => {
    for (const range of ["3m", "6m", "y", "all"] as TrendRange[]) {
      expect(filterBmiPoints([], range, NOW)).toHaveLength(0);
    }
  });
});

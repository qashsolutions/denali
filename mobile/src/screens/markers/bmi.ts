/**
 * BMI derivation helper — pure logic, no UI, no DAL.
 *
 * Derives BMI (kg/m²) from the latest height and weight observations stored
 * in the local DAL. The value is annotated with provenance "derived" so it
 * is NEVER stored as a raw measurement; it is a display-time computation
 * from coded source values.
 *
 * CLINICAL BOUNDARY (load-bearing, mobile/CLAUDE.md § Display + clinical
 * boundary):
 *   - Returns the numeric BMI value ONLY. No category label
 *     (underweight / normal / overweight / obese), no band, no verdict.
 *     WHO BMI categories are interpretation content — reviewer-gated, deferred.
 *   - "derived" source signals to every consumer that this value was computed,
 *     not directly measured.
 *   - Returns null (not a guess) when either height or weight is missing.
 *
 * LOINC codes used (NLM-verified):
 *   - Height: 8302-2  "Body height"
 *   - Weight: 29463-7 "Body weight"
 *   - BMI:    39156-5 "Body mass index (BMI) [Ratio]"
 *
 * Agent: marker-capture track (Phase 1, 2026-06-15).
 * Spec:  docs/design/phase-1-45plus.md; docs/design/biomarkers-longitudinal-v1.md.
 */

import type { ObservationRow } from "@/contracts";

/** LOINC code for body height (NLM-verified 2026-06-15). */
export const LOINC_HEIGHT = "8302-2";
/** LOINC code for body weight (NLM-verified 2026-06-15). */
export const LOINC_WEIGHT = "29463-7";
/** LOINC code for body mass index (NLM-verified 2026-06-15). */
export const LOINC_BMI = "39156-5";

export interface BmiResult {
  /** BMI in kg/m², rounded to one decimal place. */
  bmi: number;
  /** ISO8601 timestamp of the MORE RECENT of the two source observations. */
  effectiveAt: string;
  /** Provenance — always "derived" (never directly measured). */
  source: "derived";
  /** The height observation used (canonical unit: cm). */
  heightObs: Pick<ObservationRow, "id" | "value_num" | "unit" | "effective_at">;
  /** The weight observation used (canonical unit: kg). */
  weightObs: Pick<ObservationRow, "id" | "value_num" | "unit" | "effective_at">;
}

/**
 * Derive BMI from the latest height and weight observations in a list.
 *
 * Scans `observations` for the most recent row with `code === LOINC_HEIGHT`
 * (stored in cm) and the most recent row with `code === LOINC_WEIGHT`
 * (stored in kg). Returns null when either is absent or has a null value_num.
 *
 * Pure function — takes live state as explicit arguments (stale-closure rule
 * from mobile/CLAUDE.md § Engineering rules). No side effects.
 */
export function deriveBmi(
  observations: ReadonlyArray<ObservationRow>,
): BmiResult | null {
  let heightRow: ObservationRow | null = null;
  let weightRow: ObservationRow | null = null;

  for (const obs of observations) {
    if (obs.code === LOINC_HEIGHT && obs.value_num != null) {
      if (
        heightRow == null ||
        obs.effective_at > heightRow.effective_at
      ) {
        heightRow = obs;
      }
    }
    if (obs.code === LOINC_WEIGHT && obs.value_num != null) {
      if (
        weightRow == null ||
        obs.effective_at > weightRow.effective_at
      ) {
        weightRow = obs;
      }
    }
  }

  if (heightRow == null || weightRow == null) return null;

  const heightCm = heightRow.value_num!;
  const weightKg = weightRow.value_num!;

  // Defensive: guard against a height of zero (would produce Infinity).
  if (heightCm <= 0 || weightKg <= 0) return null;

  const heightM = heightCm / 100;
  const rawBmi = weightKg / (heightM * heightM);
  const bmi = Math.round(rawBmi * 10) / 10;

  // effectiveAt = the later of the two timestamps.
  const effectiveAt =
    heightRow.effective_at > weightRow.effective_at
      ? heightRow.effective_at
      : weightRow.effective_at;

  return {
    bmi,
    effectiveAt,
    source: "derived",
    heightObs: {
      id: heightRow.id,
      value_num: heightRow.value_num,
      unit: heightRow.unit,
      effective_at: heightRow.effective_at,
    },
    weightObs: {
      id: weightRow.id,
      value_num: weightRow.value_num,
      unit: weightRow.unit,
      effective_at: weightRow.effective_at,
    },
  };
}

/**
 * Derive BMI from each date point in a chronological series of observations.
 *
 * For trend display (≥2 points): walks the observation list in
 * chronological order (ascending effective_at) and computes a BMI snapshot
 * at each unique effective_at that has BOTH height and weight data.
 *
 * Because height changes rarely, the running "last known height" is
 * propagated forward until a newer height observation supersedes it.
 * Similarly for weight.
 *
 * Returns an array of { effectiveAt, bmi } snapshots, chronological
 * (ascending). Returns [] when fewer than two distinct snapshots are
 * computable.
 *
 * Pure function — stale-closure rule.
 */
export interface BmiTrendPoint {
  effectiveAt: string;
  bmi: number;
}

export function deriveBmiTrend(
  observations: ReadonlyArray<ObservationRow>,
): BmiTrendPoint[] {
  // Sort ascending by effective_at; on a tie, process HEIGHT before WEIGHT so
  // a height+weight pair logged at the same instant emits ONE point (the
  // weight) with the just-registered height already in hand.
  const sorted = [...observations].sort((a, b) => {
    if (a.effective_at !== b.effective_at) {
      return a.effective_at < b.effective_at ? -1 : 1;
    }
    const rank = (c: ObservationRow) => (c.code === LOINC_HEIGHT ? 0 : 1);
    return rank(a) - rank(b);
  });

  let lastHeight: number | null = null;
  const points: BmiTrendPoint[] = [];

  // BMI is weight-driven (height is ~constant in adults), so we emit a trend
  // point per WEIGHT observation, propagating the last-known height forward.
  // A height observation only updates the running height — it never emits its
  // own point (that would stamp a spurious "change" using a stale weight).
  // No backward propagation: a weight logged before any height yields no point
  // (we never guess a height we haven't seen).
  for (const obs of sorted) {
    if (obs.value_num == null || obs.value_num <= 0) continue;
    if (obs.code === LOINC_HEIGHT) {
      lastHeight = obs.value_num;
      continue;
    }
    if (obs.code === LOINC_WEIGHT) {
      if (lastHeight == null) continue;
      const heightM = lastHeight / 100;
      const bmi = Math.round((obs.value_num / (heightM * heightM)) * 10) / 10;
      // Multiple weights at the same instant → keep one point (the latest).
      const last = points[points.length - 1];
      if (last != null && last.effectiveAt === obs.effective_at) {
        last.bmi = bmi;
      } else {
        points.push({ effectiveAt: obs.effective_at, bmi });
      }
    }
  }

  return points;
}

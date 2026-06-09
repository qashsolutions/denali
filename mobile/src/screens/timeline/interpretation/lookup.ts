/**
 * Interpretation lookup — pure functions over INTERPRETATION_TABLE_V1.
 *
 * Strings are NEVER generated here. Every returned headline / explanation
 * / pill comes from the table, with `{{score}}` interpolated.
 *
 * Operator deltas folded in:
 *   - Sex-dependent instruments (AUDIT-C) fall back to the female (more
 *     sensitive, lower threshold) bands for sex_at_birth ∈ { "unknown",
 *     "intersex", null }, AND return a short `fallbackNote` so the
 *     renderer can surface why a more-sensitive cutoff was chosen.
 *     Never silently defaults, never crashes.
 *   - ADAM is binary; the renderer must call `computeAdamOutcome(items)`
 *     and pass the resulting 0/1 to `lookupInterpretation`.
 */

import type { SexAtBirth } from "@/contracts";

import {
  INTERPRETATION_TABLE_V1,
  type InterpretationBand,
  type InterpretationTableV1,
  isSpecificSex,
} from "./tableV1";

export interface InterpretationResult {
  /** The matched band — copy of the entry, with {{score}} already filled in. */
  band: InterpretationBand;
  /** Set when a sex-fallback (or other non-default path) was used. */
  fallbackNote?: string;
}

const SEX_FALLBACK_NOTE =
  "Because cutoffs for this screen differ by sex at birth and we don't have that information for you, we used the more-sensitive threshold.";

function interpolateScore(text: string, score: number): string {
  return text.replace(/\{\{score\}\}/g, String(score));
}

function withScoreFilled(band: InterpretationBand, score: number): InterpretationBand {
  return {
    ...band,
    headline: interpolateScore(band.headline, score),
    explanation: interpolateScore(band.explanation, score),
  };
}

function findBand(
  bands: ReadonlyArray<InterpretationBand>,
  score: number,
): InterpretationBand | null {
  for (const b of bands) {
    if (score >= b.minScore && score <= b.maxScore) return b;
  }
  return null;
}

/**
 * Look up an interpretation band for a given instrument + score.
 *
 * For sex-dependent instruments (AUDIT-C), `sexAtBirth` selects the
 * branch. For non-male/non-female values, the female (more sensitive)
 * bands are used and a `fallbackNote` is returned.
 *
 * Returns null when the instrument is unknown or the score is out of
 * the table's covered range. Callers should treat null as a render
 * fallback ("Score: 12") and never crash.
 */
export function lookupInterpretation(
  instrumentId: string,
  score: number,
  sexAtBirth: SexAtBirth | null | undefined,
  table: InterpretationTableV1 = INTERPRETATION_TABLE_V1,
): InterpretationResult | null {
  const entry = table.instruments[instrumentId];
  if (entry == null) return null;

  if (entry.sexDependent != null) {
    const specific = isSpecificSex(sexAtBirth);
    const bands = specific
      ? entry.sexDependent[sexAtBirth as "male" | "female"]
      : entry.sexDependent.female;
    const band = findBand(bands, score);
    if (band == null) return null;
    const filled = withScoreFilled(band, score);
    return specific ? { band: filled } : { band: filled, fallbackNote: SEX_FALLBACK_NOTE };
  }

  const band = findBand(entry.bands, score);
  if (band == null) return null;
  return { band: withScoreFilled(band, score) };
}

/**
 * ADAM binary outcome from per-item responses (1 = yes, 0 = no).
 *
 * Morley 2000 positive-screen rule:
 *   positive iff item1 == yes OR item7 == yes OR
 *               (count of yes among items 2,3,4,5,6,8,9,10 >= 3).
 *
 * Returns 1 (positive) or 0 (negative). Returns null when the input
 * array is the wrong length OR any required item is null/undefined.
 *
 * Caller looks up the band via:
 *   lookupInterpretation("ADAM", outcome, sexAtBirth)
 */
export function computeAdamOutcome(
  responses: ReadonlyArray<number | null>,
): 0 | 1 | null {
  if (responses.length !== 10) return null;
  for (const r of responses) {
    if (r == null) return null;
  }
  const yes = (i: number): boolean => responses[i] === 1;
  if (yes(0) || yes(6)) return 1;
  let countYes = 0;
  for (const i of [1, 2, 3, 4, 5, 7, 8, 9]) {
    if (yes(i)) countYes += 1;
  }
  return countYes >= 3 ? 1 : 0;
}

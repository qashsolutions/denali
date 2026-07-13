/**
 * Interpretation lookup — pure functions over INTERPRETATION_TABLE_V1.
 *
 * V1.1 surface:
 *   - Object-form signature `lookupInterpretation({key, score,
 *     sexAtBirth, ageYears, kind})` supports the three RangeStrategy
 *     kinds (uniform / sex-specific / age-sex-specific).
 *   - Positional form `lookupInterpretation(instrumentId, score,
 *     sexAtBirth, table?)` kept as a thin back-compat shim for
 *     pre-V1.1 callsites. It implicitly passes `ageYears: null` and
 *     `kind: "instrument"`.
 *
 * Strings are NEVER generated here. Every returned headline /
 * explanation / pill comes from the table, with `{{score}}`
 * interpolated.
 *
 * Operator deltas (Part B + Phase-3 plan) folded in:
 *   - Sex-dependent instruments (AUDIT-C today): non-male/non-female
 *     → female (more-sensitive) bands + `fallbackNote`.
 *   - Age-sex-specific instruments (biomarkers when ranges arrive):
 *     ageYears null + sex known + sexOnlyFallback present → return
 *     band + `gentleNudge` so the renderer can prompt for birth year.
 *     Otherwise the lookup returns null and the renderer shows raw
 *     value with no band — NEVER an age-specific claim without age.
 */

import type { SexAtBirth } from "@/contracts";

import {
  INTERPRETATION_TABLE_V1,
  type InterpretationBand,
  type InterpretationTableV1_1,
  type RangeStrategy,
  isSpecificSex,
} from "./tableV1";

export interface InterpretationResult {
  /** The matched band — copy of the entry, with {{score}} already filled in. */
  band: InterpretationBand;
  /** Set when a sex-fallback (or other non-default path) was used. */
  fallbackNote?: string;
  /**
   * Set when an age-sex-specific entry returned a band via the
   * sexOnlyFallback branch (sex known, age unknown). Renderer can
   * surface a non-blocking prompt: "Adding your birth year sharpens
   * this comparison."
   */
  gentleNudge?: { reason: "age-missing" };
}

export interface InterpretationLookupArgs {
  /** Instrument id (matches metadata_json.instrument) OR LOINC code. */
  key: string;
  /** Numeric score (or unit-bearing biomarker value). */
  score: number;
  /** From the user's profile. Required for sex-specific entries. */
  sexAtBirth: SexAtBirth | null | undefined;
  /**
   * Computed from `birth_year`. Required for age-sex-specific entries.
   * When null AND strategy is age-sex-specific without a sexOnlyFallback,
   * the lookup returns null.
   */
  ageYears: number | null;
  /** Defaults to INTERPRETATION_TABLE_V1 (which is V1.1 internally). */
  table?: InterpretationTableV1_1;
  /** Which subspace to consult — instruments or biomarkers. */
  kind: "instrument" | "biomarker";
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

function lookupAgainstStrategy(
  strategy: RangeStrategy,
  score: number,
  sexAtBirth: SexAtBirth | null | undefined,
  ageYears: number | null,
): InterpretationResult | null {
  switch (strategy.kind) {
    case "uniform": {
      const band = findBand(strategy.bands, score);
      return band == null ? null : { band: withScoreFilled(band, score) };
    }
    case "sex-specific": {
      const specific = isSpecificSex(sexAtBirth);
      const bands = specific
        ? strategy.bandsBySex[sexAtBirth as "male" | "female"]
        : strategy.bandsBySex.female;
      const band = findBand(bands, score);
      if (band == null) return null;
      const filled = withScoreFilled(band, score);
      return specific
        ? { band: filled }
        : { band: filled, fallbackNote: SEX_FALLBACK_NOTE };
    }
    case "age-sex-specific": {
      // No sex → no specific claim. Render raw value.
      if (!isSpecificSex(sexAtBirth)) return null;
      const sex = sexAtBirth as "male" | "female";

      // No age → try sex-only fallback if available; otherwise null.
      // NEVER apply an age-specific range when ageYears is null.
      if (ageYears == null) {
        if (!strategy.sexOnlyFallback) return null;
        const band = findBand(strategy.sexOnlyFallback[sex], score);
        if (band == null) return null;
        return {
          band: withScoreFilled(band, score),
          gentleNudge: { reason: "age-missing" },
        };
      }

      // Both known: match (sex, age ∈ [min, max]).
      const matched = strategy.ranges.find(
        (r) => r.sex === sex && ageYears >= r.ageMin && ageYears <= r.ageMax,
      );
      if (matched == null) return null;
      const band = findBand(matched.bands, score);
      return band == null ? null : { band: withScoreFilled(band, score) };
    }
  }
}

/**
 * Object-form (V1.1): look up an interpretation band for a given
 * (key, score, sex, age, kind).
 *
 * Returns null when:
 *   - the key is unknown in the chosen subspace (`kind`);
 *   - the strategy is uniform but score is out of range;
 *   - the strategy is sex-specific and sex is null/unknown (falls
 *     back to female + fallbackNote, never null in this branch);
 *   - the strategy is age-sex-specific and (sex unknown) OR (age null
 *     AND no sexOnlyFallback) OR (no range matches the (sex, age)).
 */
export function lookupInterpretation(
  args: InterpretationLookupArgs,
): InterpretationResult | null;
/**
 * Positional form (back-compat). Implicitly: `ageYears: null`,
 * `kind: "instrument"`. New callers should use the object form so the
 * age + kind dimensions are explicit.
 */
export function lookupInterpretation(
  instrumentId: string,
  score: number,
  sexAtBirth: SexAtBirth | null | undefined,
  table?: InterpretationTableV1_1,
): InterpretationResult | null;
export function lookupInterpretation(
  arg1: InterpretationLookupArgs | string,
  arg2?: number,
  arg3?: SexAtBirth | null | undefined,
  arg4?: InterpretationTableV1_1,
): InterpretationResult | null {
  let args: InterpretationLookupArgs;
  if (typeof arg1 === "string") {
    args = {
      key: arg1,
      score: arg2 as number,
      sexAtBirth: arg3,
      ageYears: null,
      table: arg4,
      kind: "instrument",
    };
  } else {
    args = arg1;
  }

  const table = args.table ?? INTERPRETATION_TABLE_V1;
  const entry =
    args.kind === "biomarker"
      ? table.biomarkers[args.key]
      : table.instruments[args.key];
  if (entry == null) return null;

  return lookupAgainstStrategy(
    entry.strategy,
    args.score,
    args.sexAtBirth,
    args.ageYears,
  );
}

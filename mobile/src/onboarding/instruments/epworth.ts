/**
 * Epworth Sleepiness Scale (ESS).
 *
 * Canonical reference: Johns MW. A new method for measuring daytime
 * sleepiness: the Epworth sleepiness scale. Sleep. 1991;14(6):540-545.
 *
 * Coding: no clinician-verified LOINC for the ESS total/items is on hand. The
 * previously-used "89204-2" is in fact "PHQ-9 modified for Teens total score"
 * and "89202-6" etc. are unrelated administrative codes (verified on
 * loinc.org) — a fabricated panel. Coded with denali `internal` slugs (same
 * pattern as ADAM / MRS / IPSS) until a real LOINC is sourced. Interpretation
 * keys off the instrument `id`, never this code, so it is storage provenance
 * only; swap to a verified LOINC later without touching the analysis layer.
 *
 * Scoring: sum of 8 items, each 0-3. Range 0-24.
 *   0-7 normal | 8-9 mild | 10-15 moderate | 16-24 severe daytime sleepiness
 *
 * Item wording is verbatim from the Johns 1991 ESS scale.
 */
import type { InstrumentDefinition } from "./types";

export const EPWORTH_LEAD_IN =
  "How likely are you to doze off or fall asleep in the following situations, in " +
  "contrast to feeling just tired? This refers to your usual way of life in recent " +
  "times. Even if you have not done some of these things recently, try to work out " +
  "how they would have affected you.";

const EPWORTH_RESPONSE_OPTIONS = [
  { value: 0, label: "Would never doze" },
  { value: 1, label: "Slight chance of dozing" },
  { value: 2, label: "Moderate chance of dozing" },
  { value: 3, label: "High chance of dozing" },
] as const;

export const EPWORTH: InstrumentDefinition = {
  id: "Epworth",
  loincCode: "denali.EPWORTH.v1",
  codeSystem: "internal",
  displayName: "Epworth Sleepiness Scale",
  items: [
    { number: 1, itemCode: "denali.EPWORTH.v1.1", text: "Sitting and reading." },
    { number: 2, itemCode: "denali.EPWORTH.v1.2", text: "Watching TV." },
    {
      number: 3,
      itemCode: "denali.EPWORTH.v1.3",
      text: "Sitting inactive in a public place (e.g., a theater or a meeting).",
    },
    {
      number: 4,
      itemCode: "denali.EPWORTH.v1.4",
      text: "As a passenger in a car for an hour without a break.",
    },
    {
      number: 5,
      itemCode: "denali.EPWORTH.v1.5",
      text: "Lying down to rest in the afternoon when circumstances permit.",
    },
    {
      number: 6,
      itemCode: "denali.EPWORTH.v1.6",
      text: "Sitting and talking to someone.",
    },
    {
      number: 7,
      itemCode: "denali.EPWORTH.v1.7",
      text: "Sitting quietly after a lunch without alcohol.",
    },
    {
      number: 8,
      itemCode: "denali.EPWORTH.v1.8",
      text: "In a car, while stopped for a few minutes in traffic.",
    },
  ],
  responseOptions: EPWORTH_RESPONSE_OPTIONS,
  score(responses) {
    if (responses.length < 8) return null;
    let total = 0;
    for (let i = 0; i < 8; i++) {
      const v = responses[i];
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      if (v < 0 || v > 3) return null;
      total += v;
    }
    return total;
  },
  interpret(score) {
    if (score <= 7) return "Normal daytime sleepiness";
    if (score <= 9) return "Mild daytime sleepiness";
    if (score <= 15) return "Moderate daytime sleepiness";
    return "Severe daytime sleepiness";
  },
};

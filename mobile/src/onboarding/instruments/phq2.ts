/**
 * PHQ-2 — Patient Health Questionnaire 2-item screener.
 *
 * The first two items of the PHQ-9. Used as a fallback when the 988 safety
 * surface is not yet shippable for PHQ-9 item 9. Phase 1 mobile ships the
 * full PHQ-9 with the 988 modal; PHQ-2 is kept here for the documented
 * deferral path per the agent spec:
 *
 *   "If the operator wants to defer the safety surface for any reason, the
 *    entire PHQ-9 must be replaced with PHQ-2 (items 1 and 2 only — no
 *    self-harm item). Do not ship PHQ-9 without the 988 surface, ever."
 *
 * LOINC panel: 55757-9 ("Patient Health Questionnaire 2 item [Reported]").
 * Per-item codes reuse the PHQ-9 per-item LOINC codes (44250-9, 44255-8).
 *
 * Scoring: sum of items 1-2, each 0-3. Range 0-6. Cutoff ≥3 suggests
 * further evaluation per Kroenke 2003.
 */
import type { InstrumentDefinition } from "./types";

export const PHQ2_LEAD_IN =
  "Over the last 2 weeks, how often have you been bothered by any of the following problems?";

const PHQ2_RESPONSE_OPTIONS = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" },
] as const;

export const PHQ2: InstrumentDefinition = {
  id: "PHQ-2",
  loincCode: "55757-9",
  codeSystem: "LOINC",
  displayName: "PHQ-2",
  items: [
    {
      number: 1,
      itemCode: "44250-9",
      text: "Little interest or pleasure in doing things.",
    },
    {
      number: 2,
      itemCode: "44255-8",
      text: "Feeling down, depressed, or hopeless.",
    },
  ],
  responseOptions: PHQ2_RESPONSE_OPTIONS,
  score(responses) {
    if (responses.length < 2) return null;
    let total = 0;
    for (let i = 0; i < 2; i++) {
      const v = responses[i];
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      if (v < 0 || v > 3) return null;
      total += v;
    }
    return total;
  },
  interpret(score) {
    return score >= 3
      ? "Positive screen — further evaluation suggested"
      : "Negative screen";
  },
};

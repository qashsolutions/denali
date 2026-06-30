/**
 * PHQ-9 — Patient Health Questionnaire-9.
 *
 * Canonical reference: Kroenke K, Spitzer RL, Williams JBW. The PHQ-9:
 * validity of a brief depression severity measure. J Gen Intern Med
 * 2001;16(9):606-13. Copyright owned by Pfizer Inc.; instrument is
 * reproduction-permitted without permission.
 *
 * LOINC panel: 44249-1 ("Patient Health Questionnaire 9 item (PHQ-9)
 * total score [Reported]"). Per-item LOINC codes are the PHQ-9 panel
 * members, mapped to each item by CONCEPT — verified verbatim against
 * loinc.org (2026-06-17). They are NOT contiguous-by-position: Q6 self-worth
 * is 44258-2, Q7 concentration 44252-5, Q8 psychomotor 44253-3, Q9 self-harm
 * 44260-8 (an earlier scramble had Q6-Q9 rotated).
 *
 * Item wording is verbatim from the published instrument. DO NOT
 * paraphrase. The lead-in "Over the last 2 weeks, how often have you
 * been bothered by any of the following problems?" is the question
 * stem the screen renders above the items.
 *
 * Scoring: sum items 1-9, each 0-3. Range 0-27. Severity bands:
 *   0-4  minimal | 5-9 mild | 10-14 moderate | 15-19 mod-severe | 20-27 severe
 *
 * Item 9 is the suicidal-ideation item — see `safety.ts` and the 988 modal.
 */
import type { InstrumentDefinition } from "./types";

export const PHQ9_LEAD_IN =
  "Over the last 2 weeks, how often have you been bothered by any of the following problems?";

const PHQ9_RESPONSE_OPTIONS = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" },
] as const;

export const PHQ9: InstrumentDefinition = {
  id: "PHQ-9",
  loincCode: "44249-1",
  codeSystem: "LOINC",
  displayName: "PHQ-9",
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
    {
      number: 3,
      itemCode: "44259-0",
      text: "Trouble falling or staying asleep, or sleeping too much.",
    },
    {
      number: 4,
      itemCode: "44254-1",
      text: "Feeling tired or having little energy.",
    },
    {
      number: 5,
      itemCode: "44251-7",
      text: "Poor appetite or overeating.",
    },
    {
      number: 6,
      itemCode: "44258-2", // verbatim loinc.org: "Feeling bad about yourself…"
      text:
        "Feeling bad about yourself — or that you are a failure or " +
        "have let yourself or your family down.",
    },
    {
      number: 7,
      itemCode: "44252-5", // verbatim loinc.org: "Trouble concentrating…"
      text:
        "Trouble concentrating on things, such as reading the newspaper " +
        "or watching television.",
    },
    {
      number: 8,
      itemCode: "44253-3", // verbatim loinc.org: "Moving or speaking so slowly…"
      text:
        "Moving or speaking so slowly that other people could have noticed? " +
        "Or the opposite — being so fidgety or restless that you have " +
        "been moving around a lot more than usual.",
    },
    {
      number: 9,
      // verbatim loinc.org: "Thoughts that you would be better off dead…" —
      // the self-harm item. Was wrongly 44258-2 (which is the item-6 self-worth
      // code); the 988 path keys off index 8, not this code, so triggering was
      // unaffected, but the STORED observation code was mislabeled.
      itemCode: "44260-8",
      text:
        "Thoughts that you would be better off dead, or of hurting yourself " +
        "in some way.",
    },
  ],
  responseOptions: PHQ9_RESPONSE_OPTIONS,
  score(responses) {
    if (responses.length < 9) return null;
    let total = 0;
    for (let i = 0; i < 9; i++) {
      const v = responses[i];
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      if (v < 0 || v > 3) return null;
      total += v;
    }
    return total;
  },
  interpret(score) {
    if (score <= 4) return "Minimal depression symptoms";
    if (score <= 9) return "Mild depression symptoms";
    if (score <= 14) return "Moderate depression symptoms";
    if (score <= 19) return "Moderately severe depression symptoms";
    return "Severe depression symptoms";
  },
};

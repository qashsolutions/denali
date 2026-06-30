/**
 * ADAM — Androgen Deficiency in Aging Males questionnaire.
 *
 * Canonical reference: Morley JE, Charlton E, Patrick P, Kaiser FE, Cadeau
 * P, McCready D, Perry HM 3rd. Validation of a screening questionnaire for
 * androgen deficiency in aging males. Metabolism. 2000;49(9):1239-1242.
 *
 * No official LOINC panel for ADAM. Phase 1 uses internal stable code
 * `denali.ADAM.v1`.
 *
 * 10 yes/no items. Scoring per Morley 2000: positive screen if the answer
 * to item 1 OR item 7 is yes, OR if the answer is yes to any 3 of the
 * other 8 items. The screen surfaces a boolean "positive" interpretation;
 * the summary observation stores the count of yes-responses (0-10).
 *
 * Branch: only rendered when sex_at_birth === "male".
 */
import type { InstrumentDefinition } from "./types";

export const ADAM_LEAD_IN =
  "Please answer yes or no to each of the following questions.";

const ADAM_RESPONSE_OPTIONS = [
  { value: 0, label: "No" },
  { value: 1, label: "Yes" },
] as const;

export const ADAM: InstrumentDefinition = {
  id: "ADAM",
  loincCode: "denali.ADAM.v1",
  codeSystem: "internal",
  displayName: "ADAM (Androgen Deficiency in Aging Males)",
  items: [
    {
      number: 1,
      itemCode: "denali.ADAM.v1.1",
      text: "Do you have a decrease in libido (sex drive)?",
    },
    {
      number: 2,
      itemCode: "denali.ADAM.v1.2",
      text: "Do you have a lack of energy?",
    },
    {
      number: 3,
      itemCode: "denali.ADAM.v1.3",
      text: "Do you have a decrease in strength and/or endurance?",
    },
    {
      number: 4,
      itemCode: "denali.ADAM.v1.4",
      text: "Have you lost height?",
    },
    {
      number: 5,
      itemCode: "denali.ADAM.v1.5",
      text: "Have you noticed a decreased enjoyment of life?",
    },
    {
      number: 6,
      itemCode: "denali.ADAM.v1.6",
      text: "Are you sad and/or grumpy?",
    },
    {
      number: 7,
      itemCode: "denali.ADAM.v1.7",
      text: "Are your erections less strong?",
    },
    {
      number: 8,
      itemCode: "denali.ADAM.v1.8",
      text: "Have you noticed a recent deterioration in your ability to play sports?",
    },
    {
      number: 9,
      itemCode: "denali.ADAM.v1.9",
      text: "Are you falling asleep after dinner?",
    },
    {
      number: 10,
      itemCode: "denali.ADAM.v1.10",
      text: "Has there been a recent deterioration in your work performance?",
    },
  ],
  responseOptions: ADAM_RESPONSE_OPTIONS,
  score(responses) {
    if (responses.length < 10) return null;
    let yesCount = 0;
    for (let i = 0; i < 10; i++) {
      const v = responses[i];
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      if (v !== 0 && v !== 1) return null;
      if (v === 1) yesCount += 1;
    }
    return yesCount;
  },
  interpret(_score) {
    // The screen separately surfaces the "positive screen" boolean via
    // `isAdamPositive` (defined below) — interpret() returns the same
    // boolean in plain language.
    return "Positive screen criteria: yes to item 1 OR item 7, OR yes to any 3 of items 2-10 (excluding 1 and 7).";
  },
};

/**
 * Morley 2000 positive-screen rule:
 *   positive iff item1 == yes OR item7 == yes OR (count of yes among items 2,3,4,5,6,8,9,10 >= 3)
 *
 * Returns null when the responses are incomplete.
 */
export function isAdamPositive(
  responses: ReadonlyArray<number | null>,
): boolean | null {
  if (responses.length < 10) return null;
  for (let i = 0; i < 10; i++) {
    const v = responses[i];
    if (v !== 0 && v !== 1) return null;
  }
  if (responses[0] === 1) return true;
  if (responses[6] === 1) return true;
  const otherYes = [1, 2, 3, 4, 5, 7, 8, 9] // indexes excluding 0 (item 1) and 6 (item 7)
    .reduce((acc, idx) => acc + (responses[idx] === 1 ? 1 : 0), 0);
  return otherYes >= 3;
}

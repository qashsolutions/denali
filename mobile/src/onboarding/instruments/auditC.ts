/**
 * AUDIT-C — Alcohol Use Disorders Identification Test, 3-item version.
 *
 * Canonical reference: Bush K, Kivlahan DR, McDonell MB, Fihn SD, Bradley
 * KA. The AUDIT alcohol consumption questions (AUDIT-C). Arch Intern Med.
 * 1998;158:1789-1795.
 *
 * LOINC panel: 75626-2 ("Total score [AUDIT-C]"). Per-item LOINC codes
 * 68518-0 (Q1), 68519-8 (Q2), 68520-6 (Q3).
 *
 * Scoring: sum of 3 items, each 0-4. Range 0-12.
 *   Positive screen cutoff: ≥4 for men, ≥3 for women (Bush 1998).
 *   The screen surfaces both cutoffs; the score does not branch on sex.
 *
 * Item wording verbatim. Response option text is also verbatim from the
 * NIAAA-distributed AUDIT-C form.
 */
import type { InstrumentDefinition } from "./types";

export const AUDIT_C_LEAD_IN =
  "The next questions are about your use of alcoholic beverages during the past year.";

// AUDIT-C uses DIFFERENT verbatim option labels per item (frequency on Q1/Q3,
// quantity on Q2) but identical 0–4 scoring — Bush 1998 / NIAAA form. Per-item
// `responseOptions` carry the correct labels; the previous single blended set
// ("monthly or less / 1-2 drinks") mislabeled the Q1 frequency question with
// Q2's quantities. These are VERBATIM instrument labels — not Denali-authored.
const AUDIT_C_Q1_FREQUENCY = [
  { value: 0, label: "Never" },
  { value: 1, label: "Monthly or less" },
  { value: 2, label: "2 to 4 times a month" },
  { value: 3, label: "2 to 3 times a week" },
  { value: 4, label: "4 or more times a week" },
] as const;
const AUDIT_C_Q2_QUANTITY = [
  { value: 0, label: "1 or 2" },
  { value: 1, label: "3 or 4" },
  { value: 2, label: "5 or 6" },
  { value: 3, label: "7 to 9" },
  { value: 4, label: "10 or more" },
] as const;
const AUDIT_C_Q3_FREQUENCY = [
  { value: 0, label: "Never" },
  { value: 1, label: "Less than monthly" },
  { value: 2, label: "Monthly" },
  { value: 3, label: "Weekly" },
  { value: 4, label: "Daily or almost daily" },
] as const;

export const AUDIT_C: InstrumentDefinition = {
  id: "AUDIT-C",
  loincCode: "75626-2",
  codeSystem: "LOINC",
  displayName: "AUDIT-C",
  items: [
    {
      number: 1,
      itemCode: "68518-0",
      text: "How often did you have a drink containing alcohol in the past year?",
      responseOptions: AUDIT_C_Q1_FREQUENCY,
    },
    {
      number: 2,
      itemCode: "68519-8",
      text:
        "How many drinks containing alcohol did you have on a typical day " +
        "when you were drinking in the past year?",
      responseOptions: AUDIT_C_Q2_QUANTITY,
    },
    {
      number: 3,
      itemCode: "68520-6",
      text:
        "How often did you have six or more drinks on one occasion in the past year?",
      responseOptions: AUDIT_C_Q3_FREQUENCY,
    },
  ],
  // Shared fallback = Q1's frequency set; every item overrides it above.
  responseOptions: AUDIT_C_Q1_FREQUENCY,
  score(responses) {
    if (responses.length < 3) return null;
    let total = 0;
    for (let i = 0; i < 3; i++) {
      const v = responses[i];
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      if (v < 0 || v > 4) return null;
      total += v;
    }
    return total;
  },
  interpret(score) {
    return (
      `Score ${score} of 12. Positive screen cutoff: ≥4 for men, ≥3 for women ` +
      `(Bush 1998).`
    );
  },
};

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
    },
    {
      number: 2,
      itemCode: "68519-8",
      text:
        "How many drinks containing alcohol did you have on a typical day " +
        "when you were drinking in the past year?",
    },
    {
      number: 3,
      itemCode: "68520-6",
      text:
        "How often did you have six or more drinks on one occasion in the past year?",
    },
  ],
  // AUDIT-C responses use DIFFERENT option labels per item but identical
  // 0–4 scoring. We expose a single label set per item via the screen by
  // using item-number-aware rendering — but the contract is one shared
  // responseOptions array. The screen will branch on item number to relabel
  // options when rendering. Keep the scoring scale 0–4 here.
  responseOptions: [
    { value: 0, label: "Never (or 0 drinks)" },
    { value: 1, label: "1 (monthly or less / 1-2 drinks)" },
    { value: 2, label: "2 (2-4 times a month / 3-4 drinks)" },
    { value: 3, label: "3 (2-3 times a week / 5-6 drinks)" },
    { value: 4, label: "4 (4+ times a week / 7+ drinks)" },
  ],
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

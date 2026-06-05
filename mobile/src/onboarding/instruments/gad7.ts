/**
 * GAD-7 — Generalized Anxiety Disorder 7-item scale.
 *
 * Canonical reference: Spitzer RL, Kroenke K, Williams JBW, Löwe B. A brief
 * measure for assessing generalized anxiety disorder: the GAD-7. Arch Intern
 * Med. 2006;166:1092-1097.
 *
 * LOINC panel: 69737-5. Per-item codes 69725-0 through 69731-8.
 *
 * Item wording verbatim. DO NOT paraphrase.
 *
 * Scoring: sum of 7 items, each 0-3. Range 0-21.
 *   0-4 minimal | 5-9 mild | 10-14 moderate | 15-21 severe
 */
import type { InstrumentDefinition } from "./types";

export const GAD7_LEAD_IN =
  "Over the last 2 weeks, how often have you been bothered by the following problems?";

const GAD7_RESPONSE_OPTIONS = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Several days" },
  { value: 2, label: "More than half the days" },
  { value: 3, label: "Nearly every day" },
] as const;

export const GAD7: InstrumentDefinition = {
  id: "GAD-7",
  loincCode: "69737-5",
  codeSystem: "LOINC",
  displayName: "GAD-7",
  items: [
    {
      number: 1,
      itemCode: "69725-0",
      text: "Feeling nervous, anxious, or on edge.",
    },
    {
      number: 2,
      itemCode: "68509-9",
      text: "Not being able to stop or control worrying.",
    },
    {
      number: 3,
      itemCode: "69733-4",
      text: "Worrying too much about different things.",
    },
    {
      number: 4,
      itemCode: "69734-2",
      text: "Trouble relaxing.",
    },
    {
      number: 5,
      itemCode: "69735-9",
      text: "Being so restless that it is hard to sit still.",
    },
    {
      number: 6,
      itemCode: "69689-8",
      text: "Becoming easily annoyed or irritable.",
    },
    {
      number: 7,
      itemCode: "69736-7",
      text: "Feeling afraid as if something awful might happen.",
    },
  ],
  responseOptions: GAD7_RESPONSE_OPTIONS,
  score(responses) {
    if (responses.length < 7) return null;
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const v = responses[i];
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      if (v < 0 || v > 3) return null;
      total += v;
    }
    return total;
  },
  interpret(score) {
    if (score <= 4) return "Minimal anxiety symptoms";
    if (score <= 9) return "Mild anxiety symptoms";
    if (score <= 14) return "Moderate anxiety symptoms";
    return "Severe anxiety symptoms";
  },
};

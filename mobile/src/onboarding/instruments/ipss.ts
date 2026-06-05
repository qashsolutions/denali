/**
 * IPSS — International Prostate Symptom Score.
 *
 * Canonical reference: Barry MJ, Fowler FJ Jr, O'Leary MP, Bruskewitz RC,
 * Holtgrewe HL, Mebust WK, Cockett AT. The American Urological Association
 * symptom index for benign prostatic hyperplasia. J Urol. 1992;148(5):1549-57.
 *
 * No official LOINC panel for IPSS. Phase 1 uses internal stable code
 * `denali.IPSS.v1`.
 *
 * 7 symptom items, each 0-5, total range 0-35.
 *   0-7   mild
 *   8-19  moderate
 *   20-35 severe
 *
 * Plus 1 quality-of-life item, scored 0-6 separately (NOT summed into the
 * total per Barry 1992). The summary observation stores the 7-item total;
 * the QoL response is stored as its own observation.
 *
 * Branch: only rendered when sex_at_birth === "male".
 */
import type { InstrumentDefinition } from "./types";

export const IPSS_LEAD_IN =
  "Over the past month, how often have you had the following symptoms?";

const IPSS_SYMPTOM_RESPONSE_OPTIONS = [
  { value: 0, label: "Not at all" },
  { value: 1, label: "Less than 1 time in 5" },
  { value: 2, label: "Less than half the time" },
  { value: 3, label: "About half the time" },
  { value: 4, label: "More than half the time" },
  { value: 5, label: "Almost always" },
] as const;

export const IPSS_QOL_RESPONSE_OPTIONS = [
  { value: 0, label: "Delighted" },
  { value: 1, label: "Pleased" },
  { value: 2, label: "Mostly satisfied" },
  { value: 3, label: "Mixed (about equally satisfied and dissatisfied)" },
  { value: 4, label: "Mostly dissatisfied" },
  { value: 5, label: "Unhappy" },
  { value: 6, label: "Terrible" },
] as const;

export const IPSS_QOL_ITEM = {
  number: 8,
  itemCode: "denali.IPSS.v1.qol",
  text:
    "If you were to spend the rest of your life with your urinary condition " +
    "just the way it is now, how would you feel about that?",
} as const;

export const IPSS: InstrumentDefinition = {
  id: "IPSS",
  loincCode: "denali.IPSS.v1",
  codeSystem: "internal",
  displayName: "International Prostate Symptom Score",
  items: [
    {
      number: 1,
      itemCode: "denali.IPSS.v1.1",
      text:
        "Incomplete emptying — Over the past month, how often have you had a " +
        "sensation of not emptying your bladder completely after you finished " +
        "urinating?",
    },
    {
      number: 2,
      itemCode: "denali.IPSS.v1.2",
      text:
        "Frequency — Over the past month, how often have you had to urinate " +
        "again less than two hours after you finished urinating?",
    },
    {
      number: 3,
      itemCode: "denali.IPSS.v1.3",
      text:
        "Intermittency — Over the past month, how often have you found you " +
        "stopped and started again several times when you urinated?",
    },
    {
      number: 4,
      itemCode: "denali.IPSS.v1.4",
      text:
        "Urgency — Over the past month, how often have you found it difficult " +
        "to postpone urination?",
    },
    {
      number: 5,
      itemCode: "denali.IPSS.v1.5",
      text: "Weak stream — Over the past month, how often have you had a weak urinary stream?",
    },
    {
      number: 6,
      itemCode: "denali.IPSS.v1.6",
      text:
        "Straining — Over the past month, how often have you had to push or " +
        "strain to begin urination?",
    },
    {
      number: 7,
      itemCode: "denali.IPSS.v1.7",
      text:
        "Nocturia — Over the past month, how many times did you most typically " +
        "get up to urinate from the time you went to bed at night until the time " +
        "you got up in the morning? (0 = none, 5 = 5+ times)",
    },
  ],
  responseOptions: IPSS_SYMPTOM_RESPONSE_OPTIONS,
  score(responses) {
    // Scores items 1-7 only. QOL item is collected separately by the screen
    // and stored as its own observation.
    if (responses.length < 7) return null;
    let total = 0;
    for (let i = 0; i < 7; i++) {
      const v = responses[i];
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      if (v < 0 || v > 5) return null;
      total += v;
    }
    return total;
  },
  interpret(score) {
    if (score <= 7) return "Mild urinary symptoms";
    if (score <= 19) return "Moderate urinary symptoms";
    return "Severe urinary symptoms";
  },
};

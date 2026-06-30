/**
 * Menopause Rating Scale (MRS).
 *
 * Canonical reference: Heinemann LAJ, Potthoff P, Schneider HPG. International
 * versions of the Menopause Rating Scale (MRS). Health Qual Life Outcomes.
 * 2003;1:28.
 *
 * No official LOINC panel for the MRS as of work date. Phase 1 uses an
 * internal stable code `denali.MRS.v1`. When a LOINC panel is adopted by
 * the MRS owner (the Berlin Center for Epidemiology and Health Research),
 * a future migration can supersede each MRS observation with a LOINC-coded
 * row (append-only contract — no UPDATE).
 *
 * Items verbatim from the published v1 English instrument. The user rates
 * the severity of each complaint on a 0-4 scale:
 *   0 = none | 1 = mild | 2 = moderate | 3 = severe | 4 = very severe
 *
 * Scoring: sum of 11 items. Range 0-44. Subscales (somatic/psychological/
 * urogenital) exist but the Phase 1 screen ships the total only — the
 * summary observation stores the total; the subscale split can be derived
 * later from the per-item observations without re-prompting the user.
 *
 * Branch: only rendered when sex_at_birth === "female". Use
 * `isValidSexAtBirth` from the contract types for the discrimination.
 */
import type { InstrumentDefinition } from "./types";

export const MRS_LEAD_IN =
  "Which of the following symptoms apply to you at this time? Please mark the " +
  "appropriate box for each symptom. For symptoms that do not apply, please " +
  "mark 'none'.";

const MRS_RESPONSE_OPTIONS = [
  { value: 0, label: "None" },
  { value: 1, label: "Mild" },
  { value: 2, label: "Moderate" },
  { value: 3, label: "Severe" },
  { value: 4, label: "Very severe" },
] as const;

export const MRS: InstrumentDefinition = {
  id: "MRS",
  loincCode: "denali.MRS.v1",
  codeSystem: "internal",
  displayName: "Menopause Rating Scale",
  items: [
    {
      number: 1,
      itemCode: "denali.MRS.v1.1",
      text: "Hot flushes, sweating (episodes of sweating).",
    },
    {
      number: 2,
      itemCode: "denali.MRS.v1.2",
      text: "Heart discomfort (unusual awareness of heartbeat, heart skipping, heart racing, tightness).",
    },
    {
      number: 3,
      itemCode: "denali.MRS.v1.3",
      text: "Sleep problems (difficulty in falling asleep, difficulty in sleeping through, waking up early).",
    },
    {
      number: 4,
      itemCode: "denali.MRS.v1.4",
      text: "Depressive mood (feeling down, sad, on the verge of tears, lack of drive, mood swings).",
    },
    {
      number: 5,
      itemCode: "denali.MRS.v1.5",
      text: "Irritability (feeling nervous, inner tension, feeling aggressive).",
    },
    {
      number: 6,
      itemCode: "denali.MRS.v1.6",
      text: "Anxiety (inner restlessness, feeling panicky).",
    },
    {
      number: 7,
      itemCode: "denali.MRS.v1.7",
      text:
        "Physical and mental exhaustion (general decrease in performance, " +
        "impaired memory, decrease in concentration, forgetfulness).",
    },
    {
      number: 8,
      itemCode: "denali.MRS.v1.8",
      text: "Sexual problems (change in sexual desire, in sexual activity and satisfaction).",
    },
    {
      number: 9,
      itemCode: "denali.MRS.v1.9",
      text: "Bladder problems (difficulty in urinating, increased need to urinate, bladder incontinence).",
    },
    {
      number: 10,
      itemCode: "denali.MRS.v1.10",
      text: "Dryness of vagina (sensation of dryness or burning in the vagina, difficulty with sexual intercourse).",
    },
    {
      number: 11,
      itemCode: "denali.MRS.v1.11",
      text: "Joint and muscular discomfort (pain in the joints, rheumatoid complaints).",
    },
  ],
  responseOptions: MRS_RESPONSE_OPTIONS,
  score(responses) {
    if (responses.length < 11) return null;
    let total = 0;
    for (let i = 0; i < 11; i++) {
      const v = responses[i];
      if (typeof v !== "number" || !Number.isFinite(v)) return null;
      if (v < 0 || v > 4) return null;
      total += v;
    }
    return total;
  },
  interpret(score) {
    // Total MRS severity bands per Heinemann 2004.
    if (score <= 4) return "No or very few complaints";
    if (score <= 8) return "Mild complaints";
    if (score <= 16) return "Moderate complaints";
    return "Severe complaints";
  },
};

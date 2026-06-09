/**
 * Interpretation table V1 — versioned, sign-off-ready, provisional.
 *
 * PURPOSE
 *   Static lookup data mapping each instrument's score to a plain-
 *   language band (pill text + headline + explanation). Interpretation
 *   strings are NEVER generated at render time — they come from this
 *   table. The renderer reads `provisional` and adorns the card with
 *   the footnote treatment until a clinician is named via
 *   `lastClinicallyReviewedBy`.
 *
 * VERSIONING
 *   Future revisions ship as `tableV2.ts` with a parallel `lookup`
 *   override. The `version` constant lets the renderer (and any
 *   future export path) disambiguate which strings rendered for a
 *   given session.
 *
 * CITATIONS
 *   Each instrument carries `cutoffSource` with the published reference
 *   for its band cutoffs. Cutoffs are NOT clinical judgment — they're
 *   the peer-reviewed thresholds for each screen. Cutoff edits are
 *   non-trivial and should re-cite.
 *
 * DELTAS folded in from operator review (2026-06-08):
 *   - Epworth uses the official Johns scheme (0–5 / 6–10 / 11–12 /
 *     13–15 / 16–24), NOT the earlier non-standard 0–7 / 8–9 / 10–15
 *     scheme.
 *   - MRS uses Heinemann 2004 (0–4 / 5–8 / 9–15 / 16+); a note in
 *     `cutoffSource` flags the alt 9–16 / 17+ scheme.
 *   - AUDIT-C carries male and female band sets via `sexDependent`.
 *     The lookup applies the female (more sensitive, lower threshold)
 *     bands as fallback for `sex_at_birth ∈ { "unknown", "intersex" }`
 *     and surfaces a short note about the fallback.
 *   - ADAM is binary (positive/negative), not numeric — its bands
 *     carry minScore/maxScore = 0/1 sentinels; the lookup helper
 *     `lookupAdam` consumes the per-item responses directly and
 *     returns the negative band when the rule does not fire.
 *
 * REFERRAL VERB
 *   Held pending operator decision (delta 4). Every string ships with
 *   `provisional: true` and a consistent placeholder phrasing ("Talking
 *   with your doctor could help"). When the verb is locked, replace
 *   in this file only — no renderer change required.
 *
 * ADAM
 *   Per delta 4 from the operator: the positive-screen string MUST NOT
 *   name "testing". It describes the positive screen and routes the
 *   workup to the clinician.
 */

import type { SexAtBirth } from "@/contracts";

/** Stable band identifier — used for telemetry and pill styling. */
export type BandId =
  | "negative"
  | "minimal"
  | "lower-normal"
  | "higher-normal"
  | "mild"
  | "moderate"
  | "moderately-severe"
  | "severe"
  | "lower-risk"
  | "higher-risk"
  | "likely-aud"
  | "positive";

export interface InterpretationBand {
  /** Inclusive min score for this band. */
  minScore: number;
  /** Inclusive max score for this band; Number.POSITIVE_INFINITY allowed. */
  maxScore: number;
  /** Stable id used for the pill color and telemetry. */
  bandId: BandId;
  /** Pill text — calm palette, short noun phrase. */
  pill: string;
  /** Plain-language one-line finding headline shown in the card. */
  headline: string;
  /** One-line explanation under the headline. */
  explanation: string;
  /** True until clinically reviewed; renders an asterisk + footnote. */
  provisional: boolean;
}

export interface InstrumentInterpretation {
  /** Instrument identifier — matches `metadata_json.instrument` from DAL. */
  instrument: string;
  /** LOINC panel code (canonical reference, not used for grouping). */
  loincPanel: string;
  /** Citation for the band cutoffs. */
  cutoffSource: string;
  /**
   * Bands in ascending order, non-overlapping, covering the full range
   * [0, Number.POSITIVE_INFINITY]. Unused for sexDependent instruments
   * (their per-sex bands live in `sexDependent`).
   */
  bands: InterpretationBand[];
  /**
   * When set, the lookup uses the per-sex bands instead of `bands`.
   * `sex_at_birth` falls back to `female` (more-sensitive) for any
   * non-male/non-female value, and the lookup surfaces a note.
   */
  sexDependent?: {
    male: InterpretationBand[];
    female: InterpretationBand[];
  };
}

export interface InterpretationTableV1 {
  /** Semantic version of this table. Provisional until clinical review. */
  version: "1.0.0-provisional";
  /** ISO date the table was clinically reviewed, or null until reviewed. */
  lastClinicallyReviewedAt: string | null;
  /** Reviewer name, or null until reviewed. */
  lastClinicallyReviewedBy: string | null;
  /** Map from instrument id (matches DAL metadata_json.instrument) → bands. */
  instruments: Record<string, InstrumentInterpretation>;
}

// ─── Bands per instrument ────────────────────────────────────────────────

const PHQ2_BANDS: InterpretationBand[] = [
  {
    minScore: 0,
    maxScore: 2,
    bandId: "negative",
    pill: "Negative",
    headline: "Your score of {{score}} is in the negative-screen range.",
    explanation:
      "Your two-question check did not indicate likely depression over the last two weeks.",
    provisional: true,
  },
  {
    minScore: 3,
    maxScore: Number.POSITIVE_INFINITY,
    bandId: "positive",
    pill: "Positive screen",
    headline: "Your score of {{score}} is in the positive-screen range.",
    explanation:
      "Your two-question check suggests it may be worth completing the longer follow-up. Talking with your doctor could help.",
    provisional: true,
  },
];

const PHQ9_BANDS: InterpretationBand[] = [
  {
    minScore: 0,
    maxScore: 4,
    bandId: "minimal",
    pill: "Minimal",
    headline: "Your score of {{score}} is in the minimal range.",
    explanation:
      "Your answers suggest little to no depression symptoms over the last two weeks.",
    provisional: true,
  },
  {
    minScore: 5,
    maxScore: 9,
    bandId: "mild",
    pill: "Mild",
    headline: "Your score of {{score}} is in the mild range.",
    explanation:
      "Your answers suggest mild symptoms over the last two weeks. Talking with your doctor could help.",
    provisional: true,
  },
  {
    minScore: 10,
    maxScore: 14,
    bandId: "moderate",
    pill: "Moderate",
    headline: "Your score of {{score}} is in the moderate range.",
    explanation:
      "Your answers suggest moderate symptoms over the last two weeks. Talking with your doctor could help.",
    provisional: true,
  },
  {
    minScore: 15,
    maxScore: 19,
    bandId: "moderately-severe",
    pill: "Moderately severe",
    headline: "Your score of {{score}} is in the moderately severe range.",
    explanation:
      "Your answers suggest moderately severe symptoms over the last two weeks. Talking with your doctor could help.",
    provisional: true,
  },
  {
    minScore: 20,
    maxScore: Number.POSITIVE_INFINITY,
    bandId: "severe",
    pill: "Severe",
    headline: "Your score of {{score}} is in the severe range.",
    explanation:
      "Your answers suggest severe symptoms over the last two weeks. Talking with your doctor could help.",
    provisional: true,
  },
];

const GAD7_BANDS: InterpretationBand[] = [
  {
    minScore: 0,
    maxScore: 4,
    bandId: "minimal",
    pill: "Minimal",
    headline: "Your score of {{score}} is in the minimal range.",
    explanation:
      "Your answers suggest little to no anxiety over the last two weeks.",
    provisional: true,
  },
  {
    minScore: 5,
    maxScore: 9,
    bandId: "mild",
    pill: "Mild",
    headline: "Your score of {{score}} is in the mild range.",
    explanation:
      "Your answers suggest mild anxiety over the last two weeks. Talking with your doctor could help.",
    provisional: true,
  },
  {
    minScore: 10,
    maxScore: 14,
    bandId: "moderate",
    pill: "Moderate",
    headline: "Your score of {{score}} is in the moderate range.",
    explanation:
      "Your answers suggest moderate anxiety over the last two weeks. Talking with your doctor could help.",
    provisional: true,
  },
  {
    minScore: 15,
    maxScore: Number.POSITIVE_INFINITY,
    bandId: "severe",
    pill: "Severe",
    headline: "Your score of {{score}} is in the severe range.",
    explanation:
      "Your answers suggest severe anxiety over the last two weeks. Talking with your doctor could help.",
    provisional: true,
  },
];

const EPWORTH_BANDS: InterpretationBand[] = [
  {
    minScore: 0,
    maxScore: 5,
    bandId: "lower-normal",
    pill: "Lower normal",
    headline: "Your score of {{score}} is in the lower-normal range.",
    explanation:
      "Your answers suggest you are getting enough restful sleep.",
    provisional: true,
  },
  {
    minScore: 6,
    maxScore: 10,
    bandId: "higher-normal",
    pill: "Higher normal",
    headline: "Your score of {{score}} is in the higher-normal range.",
    explanation:
      "Your answers suggest sleepiness within the normal range, but on the higher side.",
    provisional: true,
  },
  {
    minScore: 11,
    maxScore: 12,
    bandId: "mild",
    pill: "Mild",
    headline: "Your score of {{score}} is in the mild range.",
    explanation:
      "Your answers suggest mild excessive daytime sleepiness. Talking with your doctor could help.",
    provisional: true,
  },
  {
    minScore: 13,
    maxScore: 15,
    bandId: "moderate",
    pill: "Moderate",
    headline: "Your score of {{score}} is in the moderate range.",
    explanation:
      "Your answers suggest moderate excessive daytime sleepiness. Talking with your doctor could help.",
    provisional: true,
  },
  {
    minScore: 16,
    maxScore: Number.POSITIVE_INFINITY,
    bandId: "severe",
    pill: "Severe",
    headline: "Your score of {{score}} is in the severe range.",
    explanation:
      "Your answers suggest severe excessive daytime sleepiness. Talking with your doctor could help.",
    provisional: true,
  },
];

const AUDIT_C_MALE_BANDS: InterpretationBand[] = [
  {
    minScore: 0,
    maxScore: 3,
    bandId: "lower-risk",
    pill: "Lower risk",
    headline: "Your score of {{score}} is in the lower-risk range for drinking.",
    explanation:
      "Your answers suggest a drinking pattern within the lower-risk range.",
    provisional: true,
  },
  {
    minScore: 4,
    maxScore: 5,
    bandId: "higher-risk",
    pill: "Higher risk",
    headline: "Your score of {{score}} is in the higher-risk range for drinking.",
    explanation:
      "Your answers may indicate drinking patterns worth a conversation with your doctor.",
    provisional: true,
  },
  {
    minScore: 6,
    maxScore: Number.POSITIVE_INFINITY,
    bandId: "likely-aud",
    pill: "Likely concern",
    headline: "Your score of {{score}} suggests a likely concern with drinking.",
    explanation:
      "Your answers suggest a level of drinking that often benefits from a conversation with your doctor.",
    provisional: true,
  },
];

const AUDIT_C_FEMALE_BANDS: InterpretationBand[] = [
  {
    minScore: 0,
    maxScore: 2,
    bandId: "lower-risk",
    pill: "Lower risk",
    headline: "Your score of {{score}} is in the lower-risk range for drinking.",
    explanation:
      "Your answers suggest a drinking pattern within the lower-risk range.",
    provisional: true,
  },
  {
    minScore: 3,
    maxScore: 3,
    bandId: "higher-risk",
    pill: "Higher risk",
    headline: "Your score of {{score}} is in the higher-risk range for drinking.",
    explanation:
      "Your answers may indicate drinking patterns worth a conversation with your doctor.",
    provisional: true,
  },
  {
    minScore: 4,
    maxScore: Number.POSITIVE_INFINITY,
    bandId: "likely-aud",
    pill: "Likely concern",
    headline: "Your score of {{score}} suggests a likely concern with drinking.",
    explanation:
      "Your answers suggest a level of drinking that often benefits from a conversation with your doctor.",
    provisional: true,
  },
];

const IPSS_BANDS: InterpretationBand[] = [
  {
    minScore: 0,
    maxScore: 7,
    bandId: "mild",
    pill: "Mild",
    headline: "Your score of {{score}} is in the mild range.",
    explanation:
      "Your answers suggest mild urinary symptoms.",
    provisional: true,
  },
  {
    minScore: 8,
    maxScore: 19,
    bandId: "moderate",
    pill: "Moderate",
    headline: "Your score of {{score}} is in the moderate range.",
    explanation:
      "Your answers suggest moderate urinary symptoms. Talking with your doctor could help.",
    provisional: true,
  },
  {
    minScore: 20,
    maxScore: Number.POSITIVE_INFINITY,
    bandId: "severe",
    pill: "Severe",
    headline: "Your score of {{score}} is in the severe range.",
    explanation:
      "Your answers suggest severe urinary symptoms. Talking with your doctor could help.",
    provisional: true,
  },
];

const MRS_BANDS: InterpretationBand[] = [
  {
    minScore: 0,
    maxScore: 4,
    bandId: "minimal",
    pill: "Minimal",
    headline: "Your score of {{score}} is in the minimal range.",
    explanation:
      "Your answers suggest little to no menopausal symptoms.",
    provisional: true,
  },
  {
    minScore: 5,
    maxScore: 8,
    bandId: "mild",
    pill: "Mild",
    headline: "Your score of {{score}} is in the mild range.",
    explanation:
      "Your answers suggest mild menopausal symptoms.",
    provisional: true,
  },
  {
    minScore: 9,
    maxScore: 15,
    bandId: "moderate",
    pill: "Moderate",
    headline: "Your score of {{score}} is in the moderate range.",
    explanation:
      "Your answers suggest moderate menopausal symptoms. Talking with your doctor could help.",
    provisional: true,
  },
  {
    minScore: 16,
    maxScore: Number.POSITIVE_INFINITY,
    bandId: "severe",
    pill: "Severe",
    headline: "Your score of {{score}} is in the severe range.",
    explanation:
      "Your answers suggest severe menopausal symptoms. Talking with your doctor could help.",
    provisional: true,
  },
];

// ADAM bands use 0 / 1 sentinels — the binary outcome IS the "score" for
// lookup. The renderer computes the outcome via `computeAdamOutcome`
// from per-item responses, then looks up with 0 or 1.
const ADAM_BANDS: InterpretationBand[] = [
  {
    minScore: 0,
    maxScore: 0,
    bandId: "negative",
    pill: "Negative",
    headline: "Your answers are in the negative-screen range.",
    explanation:
      "Your answers did not match the pattern this screen looks for.",
    provisional: true,
  },
  {
    minScore: 1,
    maxScore: 1,
    bandId: "positive",
    pill: "Positive screen",
    headline: "Your answers are in the positive-screen range.",
    explanation:
      "Your answers match the pattern this screen looks for. Talking with your doctor could help.",
    provisional: true,
  },
];

// ─── Table V1 export ──────────────────────────────────────────────────────

export const INTERPRETATION_TABLE_V1: InterpretationTableV1 = {
  version: "1.0.0-provisional",
  lastClinicallyReviewedAt: null,
  lastClinicallyReviewedBy: null,
  instruments: {
    "PHQ-2": {
      instrument: "PHQ-2",
      loincPanel: "55757-9",
      cutoffSource:
        "Kroenke K, Spitzer RL, Williams JBW. The Patient Health Questionnaire-2: validity of a two-item depression screener. Med Care. 2003;41(11):1284-92.",
      bands: PHQ2_BANDS,
    },
    "PHQ-9": {
      instrument: "PHQ-9",
      loincPanel: "44249-1",
      cutoffSource:
        "Kroenke K, Spitzer RL, Williams JBW. The PHQ-9: validity of a brief depression severity measure. J Gen Intern Med. 2001;16(9):606-13.",
      bands: PHQ9_BANDS,
    },
    "GAD-7": {
      instrument: "GAD-7",
      loincPanel: "69737-5",
      cutoffSource:
        "Spitzer RL, Kroenke K, Williams JBW, Löwe B. A brief measure for assessing generalized anxiety disorder: the GAD-7. Arch Intern Med. 2006;166(10):1092-7.",
      bands: GAD7_BANDS,
    },
    Epworth: {
      instrument: "Epworth",
      loincPanel: "85563-1",
      cutoffSource:
        "Johns MW. A new method for measuring daytime sleepiness: the Epworth Sleepiness Scale. Sleep. 1991;14(6):540-5. Bands per the official scheme at epworthsleepinessscale.com (0-5 lower normal / 6-10 higher normal / 11-12 mild / 13-15 moderate / 16-24 severe).",
      bands: EPWORTH_BANDS,
    },
    "AUDIT-C": {
      instrument: "AUDIT-C",
      loincPanel: "75624-7",
      cutoffSource:
        "Bush K, Kivlahan DR, McDonell MB, Fihn SD, Bradley KA. The AUDIT alcohol consumption questions (AUDIT-C): an effective brief screening test for problem drinking. Arch Intern Med. 1998;158(16):1789-95. Sex-specific cutoffs per Bradley KA et al. Alcohol Clin Exp Res. 2007;31(7):1208-17.",
      bands: [], // sex-dependent — see sexDependent below
      sexDependent: {
        male: AUDIT_C_MALE_BANDS,
        female: AUDIT_C_FEMALE_BANDS,
      },
    },
    IPSS: {
      instrument: "IPSS",
      loincPanel: "75636-1",
      cutoffSource:
        "Barry MJ, Fowler FJ Jr, O'Leary MP, et al. The American Urological Association symptom index for benign prostatic hyperplasia. J Urol. 1992;148(5):1549-57.",
      bands: IPSS_BANDS,
    },
    MRS: {
      instrument: "MRS",
      loincPanel: "76494-4",
      cutoffSource:
        "Heinemann LAJ, Potthoff P, Schneider HPG. International versions of the Menopause Rating Scale (MRS). Health Qual Life Outcomes. 2003;1:28. (See also Heinemann et al. validation studies, 2004.) An alternative scheme (9-16 moderate / 17+ severe) exists in some clinical references; the table uses the more-conservative Heinemann scheme.",
      bands: MRS_BANDS,
    },
    ADAM: {
      instrument: "ADAM",
      loincPanel: "77692-2",
      cutoffSource:
        "Morley JE, Charlton E, Patrick P, et al. Validation of a screening questionnaire for androgen deficiency in aging males. Metabolism. 2000;49(9):1239-42.",
      bands: ADAM_BANDS,
    },
  },
};

/** Type guard for the sex-fallback path used by the AUDIT-C lookup. */
export function isSpecificSex(
  s: SexAtBirth | null | undefined,
): s is "male" | "female" {
  return s === "male" || s === "female";
}

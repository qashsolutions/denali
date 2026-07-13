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
 * DELTA — LOINC citation fixes (2026-06-17, v1.3.1, loinc-audit):
 *   - Corrected fabricated `loincPanel` citations, each verified verbatim
 *     against loinc.org: Epworth 85563-1 (nonexistent) → denali.EPWORTH.v1;
 *     IPSS 75636-1 ("Emergency severity index") → denali.IPSS.v1; MRS 76494-4
 *     ("Tacrolimus blood level") → denali.MRS.v1; ADAM 77692-2 ("UPDRS
 *     swallowing scale") → denali.ADAM.v1 (these four instruments have no
 *     verified LOINC and use internal codes); AUDIT-C 75624-7 ("Total score
 *     [AUDIT]", the full 10-item AUDIT) → 75626-2 ("Total score [AUDIT-C]").
 *   - `loincPanel` is a citation only (lookup keys off `instrument` id), so
 *     this is metadata-only — zero render/interpretation/band change.
 *
 * DELTA — trend-chart config (2026-06-09, v1.3.0, Step-3 prompt):
 *   - `scoreRange` added per chartable instrument (definitional maxima,
 *     cited by each entry's existing provenance source): PHQ-2 0–6,
 *     PHQ-9 0–27, GAD-7 0–21, Epworth 0–24, AUDIT-C 0–12, IPSS 0–35,
 *     MRS 0–44. ADAM carries NO scoreRange — binary outcome, excluded
 *     from score-over-time charts; chartability = scoreRange present.
 *   - Optional per-band curated `tint` override (TintClass). Exactly one
 *     override shipped: IPSS "mild" (0–7) → "ok" — AUA's own lowest-band
 *     terminology is "Mild", and amber "watch" styling on a score of 0
 *     misread as attention. Label text "Mild" unchanged.
 *   - ADAM negative-band pill "Negative" → "No signs" (same jargon class
 *     as the PHQ-2 fix). ADAM headlines/explanations still carry
 *     "negative-screen range" phrasing — replacements PROPOSED in the
 *     step report, not changed unilaterally.
 *   - NOTE: the Step-3 prompt numbered this bump 1.1.1→1.2.0; 1.2.0 was
 *     already consumed by the provenance delta below, so this ships as
 *     1.3.0-provisional.
 *
 * DELTA — provenance records (2026-06-09, v1.2.0, operator-approved plan):
 *   - Every InstrumentInterpretation / BiomarkerInterpretation now carries
 *     a structured `provenance` record (src/lib/provenance.ts):
 *     { source, pmid_or_code_system_version, retrieved_at, review_status }.
 *     review_status starts "pending_clinical_review"; only a NAMED human
 *     review clears it. PMIDs/retrieved_at are filled by the
 *     terminology-verifier — null until verified, never invented.
 *   - `cutoffSource` is retained for one version as the human-readable
 *     citation (mirrored into provenance.source) and is deprecated.
 *   - Zero render change: provenance is metadata; lookup output is
 *     byte-identical to v1.1.1.
 *
 * DELTA folded in from operator review (2026-06-09, redesign step 2):
 *   - PHQ-2 negative-band pill was "Negative" — screening jargon that
 *     misreads as "negative mood" on the dashboard card. Replaced with
 *     "Minimal", matching the plain-language lowest-band vocabulary used
 *     by PHQ-9 / GAD-7 / MRS. bandId stays "negative" (stable id —
 *     telemetry + pill styling unaffected). Headline/explanation
 *     unchanged. Version bumped 1.1.0 → 1.1.1. ADAM's "Negative" pill is
 *     flagged for the same review but NOT changed (out of scope).
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
import type { ProvenanceRecord } from "@/lib/provenance";

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
  | "positive"
  // WHO biomarker bands (v1.3, provisional) — BMI + bone-density T-score.
  | "underweight"
  | "healthy-weight"
  | "overweight"
  | "obesity"
  | "severe-obesity"
  | "osteoporosis"
  | "bone-low"
  | "bone-normal";

/**
 * Curated tint classes (v1.3) — the four pill/band treatments from the
 * redesign. A band's tint normally derives from its bandId (see
 * pill.ts); `tint` overrides that mapping for the rare band whose
 * published terminology doesn't match the default severity styling
 * (IPSS "mild" 0–7 is the lone shipped override).
 */
export type TintClass = "ok" | "soft" | "watch" | "alarm";

export interface InterpretationBand {
  /** Inclusive min score for this band. */
  minScore: number;
  /** Inclusive max score for this band; Number.POSITIVE_INFINITY allowed. */
  maxScore: number;
  /** Stable id used for the pill color and telemetry. */
  bandId: BandId;
  /**
   * Optional curated tint override (v1.3). Absent → default
   * bandId→tint mapping in pill.ts applies. Display-only; never
   * changes band membership or label text.
   */
  tint?: TintClass;
  /** Pill text — calm palette, short noun phrase. */
  pill: string;
  /** Plain-language one-line finding headline shown in the card. */
  headline: string;
  /** One-line explanation under the headline. */
  explanation: string;
  /** True until clinically reviewed; renders an asterisk + footnote. */
  provisional: boolean;
}

/**
 * V1.1 — where a band lookup gets its band set FROM. Three kinds,
 * picked per entry so the lookup function knows which dimensions it
 * needs. Adding a new kind is forward-compatible: the lookup falls
 * through to `null` for any entry with a strategy it doesn't know.
 *
 * Increment 1 ships:
 *   - `uniform` for all screeners except AUDIT-C (PHQ-*, GAD-7,
 *     Epworth, IPSS, MRS, ADAM). Validated adult bands — adjusting by
 *     age or sex would invent clinical content.
 *   - `sex-specific` for AUDIT-C only (Bradley 2007).
 *   - `age-sex-specific` declared but UNUSED today; reserved for the
 *     biomarker domain when the clinical reviewer supplies ranges.
 */
export type RangeStrategy =
  | { kind: "uniform"; bands: InterpretationBand[] }
  | {
      kind: "sex-specific";
      // Lookup fallback policy: unknown/intersex/null → female
      // (more-sensitive) bands + surface a fallbackNote.
      bandsBySex: { male: InterpretationBand[]; female: InterpretationBand[] };
    }
  | {
      kind: "age-sex-specific";
      /**
       * Ordered range entries. The lookup picks the first matching
       * (sex, ageYears ∈ [ageMin, ageMax]) and uses its `bands`.
       * Empty array means "no interpretation available yet" — the
       * lookup returns null and the renderer shows the raw value
       * with no band.
       */
      ranges: ReadonlyArray<AgeSexBandSet>;
      /**
       * Optional sex-only fallback for the (sex known, ageYears null)
       * case. When set, the lookup returns the matching band PLUS a
       * `gentleNudge` so the renderer can prompt the user to add
       * their birth year. Missing/empty means: render no band when
       * age unknown — never apply an age-specific range without age.
       */
      sexOnlyFallback?: {
        male: InterpretationBand[];
        female: InterpretationBand[];
      };
    };

/** An age+sex-keyed band set within an `age-sex-specific` strategy. */
export interface AgeSexBandSet {
  sex: "male" | "female";
  /** Inclusive years (e.g. 40..64 covers ages 40 through 64). */
  ageMin: number;
  ageMax: number; // Number.POSITIVE_INFINITY OK
  bands: InterpretationBand[];
  /** Citation for these ranges (provisional until clinical review). */
  rangeSource: string;
}

export interface InstrumentInterpretation {
  /** Instrument identifier — matches `metadata_json.instrument` from DAL. */
  instrument: string;
  /** LOINC panel code (canonical reference, not used for grouping). */
  loincPanel: string;
  /**
   * Citation for the band cutoffs.
   * @deprecated v1.2 — mirrored into `provenance.source`; kept one version
   * for back-compat, removed in v1.3.
   */
  cutoffSource: string;
  /** Structured provenance (v1.2) — see src/lib/provenance.ts lifecycle. */
  provenance: ProvenanceRecord;
  /**
   * Inclusive instrument score domain (v1.3) — the trend chart's Y-axis
   * bounds. Definitional maxima from the instrument's own scoring (cited
   * by this entry's provenance source). ABSENT for non-chartable
   * instruments (ADAM — binary); chartability is keyed on its presence.
   */
  scoreRange?: { min: number; max: number };
  /** How to pick the band set for a given (score, sex, age) input. */
  strategy: RangeStrategy;
  /**
   * Free-form annotations for the clinical reviewer that the render
   * pipeline NEVER auto-applies. e.g. "Gender-affirming hormone
   * therapy may shift ranges 6-12 months after initiation; flag for
   * individual review." The detail screen MAY surface these as a
   * footnote; the dashboard card never does.
   */
  clinicalReviewerNotes?: ReadonlyArray<string>;
}

/**
 * Biomarker (lab / vital / fitness) interpretation entry — keyed by
 * LOINC code rather than instrument id. Same `strategy` field as
 * instruments. Increment 1 ships the type but the table's
 * `biomarkers` map is empty — content awaits the clinical reviewer +
 * guideline-sourced ranges.
 */
export interface BiomarkerInterpretation {
  loinc: string;
  friendlyName: string; // typically reuses LAB_FRIENDLY_NAME entry
  unit: string;
  rangeSource: string;
  /** Structured provenance (v1.2) — see src/lib/provenance.ts lifecycle. */
  provenance: ProvenanceRecord;
  strategy: RangeStrategy;
  clinicalReviewerNotes?: ReadonlyArray<string>;
  /** Educational copy shown when the slot is empty (curated-panel surface). */
  education?: {
    whatItIs: string;
    whyTracked: string;
    provisional: boolean;
  };
}

/**
 * V1.1 table — extended for age+sex strategy + biomarkers + clinical-
 * reviewer annotations. Backwards-compatible at the **lookup** layer:
 * all existing instrument entries migrated from `bands: [...]` to
 * `strategy: { kind: "uniform", bands: [...] }` produce byte-identical
 * lookup output. The exported constant keeps the V1 name so callers
 * don't churn.
 */
export interface InterpretationTableV1_1 {
  /** Semantic version of this table. Provisional until clinical review. */
  version: "1.3.1-provisional";
  /** ISO date the table was clinically reviewed, or null until reviewed. */
  lastClinicallyReviewedAt: string | null;
  /** Reviewer name, or null until reviewed. */
  lastClinicallyReviewedBy: string | null;
  /** Map from instrument id (matches DAL metadata_json.instrument) → entry. */
  instruments: Record<string, InstrumentInterpretation>;
  /**
   * Map from LOINC code → biomarker entry. Empty at increment-1 ship;
   * the schema is in place to receive guideline-sourced ranges once
   * the clinical reviewer's panel arrives.
   */
  biomarkers: Record<string, BiomarkerInterpretation>;
}

/**
 * @deprecated kept as a type alias so existing imports
 * `InterpretationTableV1` keep compiling. Renderer should refer to
 * `InterpretationTableV1_1` going forward.
 */
export type InterpretationTableV1 = InterpretationTableV1_1;

/**
 * Flatten any `RangeStrategy` into a list of bands — used by tests
 * that need to inspect every shipped band's `provisional` flag or
 * walk band ids. Order is implementation-defined; callers should not
 * depend on it.
 */
export function flattenStrategyBands(strategy: RangeStrategy): InterpretationBand[] {
  switch (strategy.kind) {
    case "uniform":
      return [...strategy.bands];
    case "sex-specific":
      return [...strategy.bandsBySex.male, ...strategy.bandsBySex.female];
    case "age-sex-specific":
      return [
        ...strategy.ranges.flatMap((r) => r.bands),
        ...(strategy.sexOnlyFallback
          ? [
              ...strategy.sexOnlyFallback.male,
              ...strategy.sexOnlyFallback.female,
            ]
          : []),
      ];
  }
}

// ─── Bands per instrument ────────────────────────────────────────────────

const PHQ2_BANDS: InterpretationBand[] = [
  {
    minScore: 0,
    maxScore: 2,
    bandId: "negative",
    // 2026-06-09 delta: was "Negative" (screening jargon — misreads as
    // "negative mood"). Plain-language lowest-band vocabulary instead.
    pill: "Minimal",
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

// Epworth / IPSS / MRS / ADAM band + source consts removed (2026-07 licensing
// removal — audit/LICENSING_BRIEF.md). Only public-domain screeners remain.

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

// ─── Provenance (v1.2) ───────────────────────────────────────────────────

/**
 * Every CC-authored entry starts pending clinical review. The
 * terminology-verifier later fills pmid/retrieved_at per entry; a NAMED
 * human review (and only that) flips review_status — see
 * src/lib/provenance.ts.
 */
export function pendingReview(source: string): ProvenanceRecord {
  return {
    source,
    pmid_or_code_system_version: null,
    retrieved_at: null,
    review_status: "pending_clinical_review",
  };
}

// Citation consts — single source string per instrument, mirrored into both
// the deprecated `cutoffSource` and `provenance.source` until v1.3 drops
// the former.
const PHQ2_SOURCE =
  "Kroenke K, Spitzer RL, Williams JBW. The Patient Health Questionnaire-2: validity of a two-item depression screener. Med Care. 2003;41(11):1284-92.";
const PHQ9_SOURCE =
  "Kroenke K, Spitzer RL, Williams JBW. The PHQ-9: validity of a brief depression severity measure. J Gen Intern Med. 2001;16(9):606-13.";
const GAD7_SOURCE =
  "Spitzer RL, Kroenke K, Williams JBW, Löwe B. A brief measure for assessing generalized anxiety disorder: the GAD-7. Arch Intern Med. 2006;166(10):1092-7.";
const AUDIT_C_SOURCE =
  "Bush K, Kivlahan DR, McDonell MB, Fihn SD, Bradley KA. The AUDIT alcohol consumption questions (AUDIT-C): an effective brief screening test for problem drinking. Arch Intern Med. 1998;158(16):1789-95. Sex-specific cutoffs per Bradley KA et al. Alcohol Clin Exp Res. 2007;31(7):1208-17.";

// ─── Table V1 export ──────────────────────────────────────────────────────

// ─── WHO biomarker bands (v1.3, PROVISIONAL — clinical sign-off pending) ───
// These are the only biomarker interpretation entries. Bands are contiguous
// for ONE-DECIMAL values (deriveBmi rounds to 1 dp; T-scores are reported to
// 1 dp); an off-decimal value falls between bands → lookup returns null → the
// renderer shows the raw number with NO band (never a wrong band).

const BMI_SOURCE =
  "World Health Organization (2000) — Obesity: Preventing and Managing the Global Epidemic. WHO Technical Report Series 894 (adult BMI classification: underweight <18.5 / normal 18.5–24.9 / overweight 25.0–29.9 / obese ≥30, with obese class I 30.0–34.9, class II 35.0–39.9, class III ≥40.0).";
const BMI_BANDS: InterpretationBand[] = [
  {
    minScore: Number.NEGATIVE_INFINITY,
    maxScore: 18.4,
    bandId: "underweight",
    pill: "Underweight",
    headline: "A BMI of {{score}} is in the underweight range.",
    explanation:
      "The World Health Organization classifies a BMI below 18.5 as underweight. Talking with your doctor could help.",
    provisional: true,
  },
  {
    minScore: 18.5,
    maxScore: 24.9,
    bandId: "healthy-weight",
    pill: "Healthy range",
    headline: "A BMI of {{score}} is in the healthy weight range.",
    explanation:
      "The World Health Organization classifies a BMI of 18.5 to 24.9 as the healthy weight range.",
    provisional: true,
  },
  {
    minScore: 25.0,
    maxScore: 29.9,
    bandId: "overweight",
    pill: "Overweight",
    headline: "A BMI of {{score}} is in the overweight range.",
    explanation:
      "The World Health Organization classifies a BMI of 25.0 to 29.9 as overweight. Talking with your doctor could help.",
    provisional: true,
  },
  {
    minScore: 30.0,
    maxScore: 39.9,
    bandId: "obesity",
    pill: "Obesity range",
    headline: "A BMI of {{score}} is in the obesity range.",
    explanation:
      "The World Health Organization classifies a BMI of 30.0 to 39.9 as obesity (classes I and II). Talking with your doctor could help.",
    provisional: true,
  },
  {
    minScore: 40.0,
    maxScore: Number.POSITIVE_INFINITY,
    bandId: "severe-obesity",
    pill: "Severe obesity",
    headline: "A BMI of {{score}} is in the severe obesity range.",
    explanation:
      "The World Health Organization classifies a BMI of 40.0 or higher as severe obesity (class III). Talking with your doctor could help.",
    provisional: true,
  },
];

const BONE_DENSITY_SOURCE =
  "World Health Organization — Assessment of fracture risk and its application to screening for postmenopausal osteoporosis (WHO Technical Report Series 843, 1994).";
const BONE_DENSITY_BANDS: InterpretationBand[] = [
  {
    minScore: Number.NEGATIVE_INFINITY,
    maxScore: -2.5,
    bandId: "osteoporosis",
    pill: "Osteoporosis range",
    headline: "A hip T-score of {{score}} is in the osteoporosis range.",
    explanation:
      "The World Health Organization defines a T-score of -2.5 or lower as osteoporosis. Talking with your doctor could help.",
    provisional: true,
  },
  {
    minScore: -2.4,
    maxScore: -1.1,
    bandId: "bone-low",
    pill: "Low bone mass",
    headline: "A hip T-score of {{score}} is in the low bone mass range.",
    explanation:
      "The World Health Organization defines a T-score between -1.0 and -2.5 as low bone mass (osteopenia). Talking with your doctor could help.",
    provisional: true,
  },
  {
    minScore: -1.0,
    maxScore: Number.POSITIVE_INFINITY,
    bandId: "bone-normal",
    pill: "Normal range",
    headline: "A hip T-score of {{score}} is in the normal range.",
    explanation:
      "The World Health Organization defines a T-score of -1.0 or higher as normal bone density.",
    provisional: true,
  },
];

export const INTERPRETATION_TABLE_V1: InterpretationTableV1_1 = {
  version: "1.3.1-provisional",
  lastClinicallyReviewedAt: null,
  lastClinicallyReviewedBy: null,
  instruments: {
    "PHQ-2": {
      instrument: "PHQ-2",
      loincPanel: "55757-9",
      cutoffSource: PHQ2_SOURCE,
      provenance: pendingReview(PHQ2_SOURCE),
      scoreRange: { min: 0, max: 6 },
      strategy: { kind: "uniform", bands: PHQ2_BANDS },
    },
    "PHQ-9": {
      instrument: "PHQ-9",
      loincPanel: "44249-1",
      cutoffSource: PHQ9_SOURCE,
      provenance: pendingReview(PHQ9_SOURCE),
      scoreRange: { min: 0, max: 27 },
      strategy: { kind: "uniform", bands: PHQ9_BANDS },
    },
    "GAD-7": {
      instrument: "GAD-7",
      loincPanel: "69737-5",
      cutoffSource: GAD7_SOURCE,
      provenance: pendingReview(GAD7_SOURCE),
      scoreRange: { min: 0, max: 21 },
      strategy: { kind: "uniform", bands: GAD7_BANDS },
    },
    // Epworth entry removed (2026-07 licensing removal).
    "AUDIT-C": {
      instrument: "AUDIT-C",
      // 75624-7 is "Total score [AUDIT]" (the full 10-item AUDIT), not AUDIT-C.
      // 75626-2 = "Total score [AUDIT-C]" (verified loinc.org), matching the
      // instrument file.
      loincPanel: "75626-2",
      cutoffSource: AUDIT_C_SOURCE,
      provenance: pendingReview(AUDIT_C_SOURCE),
      scoreRange: { min: 0, max: 12 },
      strategy: {
        kind: "sex-specific",
        bandsBySex: {
          male: AUDIT_C_MALE_BANDS,
          female: AUDIT_C_FEMALE_BANDS,
        },
      },
    },
    // IPSS / MRS / ADAM entries removed (2026-07 licensing removal —
    // audit/LICENSING_BRIEF.md). Only public-domain screeners remain.
  },
  /**
   * Increment 1: empty map. Schema is in place; the curated panel +
   * sourced ranges arrive once the clinical reviewer ships them. See
   * `mobile/src/screens/timeline/biomarkers/` for the curated-panel
   * registry shape this complements.
   */
  biomarkers: {
    // BMI (derived value) — WHO adult classification. PROVISIONAL.
    "39156-5": {
      loinc: "39156-5",
      friendlyName: "Body mass index",
      unit: "kg/m²",
      rangeSource: BMI_SOURCE,
      provenance: pendingReview(BMI_SOURCE),
      strategy: { kind: "uniform", bands: BMI_BANDS },
      clinicalReviewerNotes: [
        "WHO also publishes lower cut-offs for adults of South/East-Asian descent (overweight ≥23, obesity ≥27.5) — decide whether to offer a population-specific variant before clearing provisional.",
        "Obesity is split into Obesity (30.0–39.9, classes I+II) and Severe obesity (≥40.0, class III, D29). Further granularity (separating class I 30.0–34.9 from class II 35.0–39.9) remains an option to decide before clearing provisional.",
      ],
    },
    // Bone-density hip T-score — WHO 1994 categories. PROVISIONAL.
    "38264-8": {
      loinc: "38264-8",
      friendlyName: "Bone density (DXA hip T-score)",
      unit: "T-score",
      rangeSource: BONE_DENSITY_SOURCE,
      provenance: pendingReview(BONE_DENSITY_SOURCE),
      strategy: { kind: "uniform", bands: BONE_DENSITY_BANDS },
      clinicalReviewerNotes: [
        "WHO T-score criteria are validated for postmenopausal women and men aged ≥50; younger adults use Z-scores. Consider an age/sex gate before clearing provisional.",
        "Band boundaries assume T-scores reported to one decimal place; off-decimal values fall between bands and render as the raw value.",
      ],
    },
  },
};

/** Type guard for the sex-fallback path used by the AUDIT-C lookup. */
export function isSpecificSex(
  s: SexAtBirth | null | undefined,
): s is "male" | "female" {
  return s === "male" || s === "female";
}

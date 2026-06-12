/**
 * Manual marker-entry catalog — the small set of vitals/labs a user can
 * LOG by hand (parallel to uploading a report).
 *
 * SCOPE / BOUNDARY (read before editing):
 *   - This is a DATA-ENTRY terminology catalog: marker → LOINC code + unit,
 *     so a manually-entered value is coded EXACTLY like an uploaded one
 *     (upload path uses code_system "LOINC", e.g. HbA1c 4548-4). It records
 *     a value the user already has.
 *   - It carries NO interpretation (normal/abnormal ranges) and makes NO
 *     screening recommendation. Those are the reviewer-gated layers
 *     (`interpretation/tableV1.ts` biomarkers map + `biomarkers/registry.ts`
 *     CURATED_PANELS) and stay empty until a clinical reviewer ships them.
 *     A logged value displays raw, same as an uploaded lab does today.
 *   - `plausible` is a TYPO guardrail (physical sanity in the canonical
 *     unit), NOT a clinical normal range — never surfaced as a verdict.
 *   - PROVISIONAL: every entry is `provisional: true`. The LOINC codes were
 *     VERIFIED against the NLM Clinical Tables LOINC API
 *     (clinicaltables.nlm.nih.gov/api/loinc_items) on 2026-06-12 — all nine
 *     matched their marker. Still provisional pending clinical sign-off on
 *     the marker SET, units, plausible bounds, and two coding nuances:
 *     fasting vs random glucose (1558-6 vs 2339-0) and LDL direct-assay
 *     (18262-6) vs calculated (13457-7). Do NOT add interpretation here.
 *
 *     NLM-verified names: 8480-6 Systolic BP · 8462-4 Diastolic BP ·
 *     29463-7 Body weight · 4548-4 Hemoglobin A1c · 1558-6 Fasting glucose ·
 *     2093-3 Cholesterol (total) · 18262-6 LDL (direct) · 2085-9 HDL ·
 *     8867-4 Heart rate.
 *
 * Each marker has one or more numeric `fields` (blood pressure has two:
 * systolic + diastolic); each field commits as its own observation, so the
 * model is identical to the upload path and the future device-sync path.
 */

export type MarkerCategory = "vital" | "biomarker" | "anthropometric";

export interface MarkerUnit {
  /** Unit label shown to the user, e.g. "mg/dL", "lb". */
  unit: string;
  /** Exactly one unit per field is canonical (the stored unit). */
  canonical?: boolean;
  /** Multiply an entered value in THIS unit by this to get the canonical unit. */
  toCanonicalFactor: number;
}

export interface MarkerField {
  /** Standard LOINC code (provisional — verify before un-provisioning). */
  loinc: string;
  /** Field label for multi-field markers (e.g. "Systolic"); omit if single. */
  label?: string;
  /** Selectable units; the first canonical:true is the stored unit. */
  units: ReadonlyArray<MarkerUnit>;
  /** Physical-plausibility bounds in the CANONICAL unit (typo guard only). */
  plausible: { min: number; max: number };
}

export interface MarkerDef {
  /** Stable key (used as the picker id + testIDs). */
  key: string;
  /** Plain-language name shown in the picker. */
  display: string;
  category: MarkerCategory;
  /** One field (single value) or several (blood pressure = 2). */
  fields: ReadonlyArray<MarkerField>;
  /** True until a clinical reviewer verifies the codes/units. */
  provisional: boolean;
  /**
   * Optional data-entry instruction shown on the entry screen — clarifies
   * WHICH reading to enter (data quality), never a clinical recommendation.
   */
  entryHint?: string;
}

const MGDL_TO_MMOL_GLUCOSE = 1 / 18.0156; // glucose molar mass
const MGDL_TO_MMOL_CHOL = 1 / 38.67; // cholesterol molar mass
const LB_TO_KG = 0.45359237;

/**
 * v1 manual-entry set. PROVISIONAL codes — operator/clinical to verify.
 * Canonical units chosen to match common upload conventions.
 */
export const MARKER_CATALOG: ReadonlyArray<MarkerDef> = [
  {
    key: "blood_pressure",
    display: "Blood pressure",
    category: "vital",
    provisional: true,
    fields: [
      {
        loinc: "8480-6",
        label: "Systolic",
        units: [{ unit: "mmHg", canonical: true, toCanonicalFactor: 1 }],
        plausible: { min: 50, max: 300 },
      },
      {
        loinc: "8462-4",
        label: "Diastolic",
        units: [{ unit: "mmHg", canonical: true, toCanonicalFactor: 1 }],
        plausible: { min: 30, max: 200 },
      },
    ],
  },
  {
    key: "weight",
    display: "Weight",
    category: "anthropometric",
    provisional: true,
    fields: [
      {
        loinc: "29463-7",
        units: [
          { unit: "lb", toCanonicalFactor: LB_TO_KG },
          { unit: "kg", canonical: true, toCanonicalFactor: 1 },
        ],
        plausible: { min: 20, max: 360 }, // kg
      },
    ],
  },
  {
    key: "hba1c",
    display: "Hemoglobin A1c",
    category: "biomarker",
    provisional: true,
    fields: [
      {
        loinc: "4548-4",
        units: [{ unit: "%", canonical: true, toCanonicalFactor: 1 }],
        plausible: { min: 3, max: 20 },
      },
    ],
  },
  {
    key: "fasting_glucose",
    display: "Fasting glucose",
    category: "biomarker",
    provisional: true,
    entryHint: "Use a reading taken before eating or drinking.",
    fields: [
      {
        loinc: "1558-6",
        units: [
          { unit: "mg/dL", canonical: true, toCanonicalFactor: 1 },
          { unit: "mmol/L", toCanonicalFactor: 1 / MGDL_TO_MMOL_GLUCOSE },
        ],
        plausible: { min: 20, max: 800 }, // mg/dL
      },
    ],
  },
  {
    key: "total_cholesterol",
    display: "Total cholesterol",
    category: "biomarker",
    provisional: true,
    fields: [
      {
        loinc: "2093-3",
        units: [
          { unit: "mg/dL", canonical: true, toCanonicalFactor: 1 },
          { unit: "mmol/L", toCanonicalFactor: 1 / MGDL_TO_MMOL_CHOL },
        ],
        plausible: { min: 50, max: 500 }, // mg/dL
      },
    ],
  },
  {
    key: "ldl_cholesterol",
    display: "LDL cholesterol",
    category: "biomarker",
    provisional: true,
    fields: [
      {
        loinc: "18262-6",
        units: [
          { unit: "mg/dL", canonical: true, toCanonicalFactor: 1 },
          { unit: "mmol/L", toCanonicalFactor: 1 / MGDL_TO_MMOL_CHOL },
        ],
        plausible: { min: 10, max: 400 }, // mg/dL
      },
    ],
  },
  {
    key: "hdl_cholesterol",
    display: "HDL cholesterol",
    category: "biomarker",
    provisional: true,
    fields: [
      {
        loinc: "2085-9",
        units: [
          { unit: "mg/dL", canonical: true, toCanonicalFactor: 1 },
          { unit: "mmol/L", toCanonicalFactor: 1 / MGDL_TO_MMOL_CHOL },
        ],
        plausible: { min: 5, max: 200 }, // mg/dL
      },
    ],
  },
  {
    key: "resting_heart_rate",
    display: "Resting heart rate",
    category: "vital",
    provisional: true,
    fields: [
      {
        loinc: "8867-4",
        units: [{ unit: "bpm", canonical: true, toCanonicalFactor: 1 }],
        plausible: { min: 20, max: 250 },
      },
    ],
  },
];

/** Look up a marker definition by key. */
export function findMarker(key: string): MarkerDef | undefined {
  return MARKER_CATALOG.find((m) => m.key === key);
}

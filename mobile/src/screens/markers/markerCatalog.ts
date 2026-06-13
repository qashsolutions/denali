/**
 * Manual marker-entry catalog — the vitals/labs a user can LOG by hand
 * (parallel to uploading a report).
 *
 * SCOPE / BOUNDARY (read before editing):
 *   - This is a DATA-ENTRY terminology catalog: marker → LOINC code + unit,
 *     so a manually-entered value is coded EXACTLY like an uploaded one
 *     (upload path uses code_system "LOINC"). It records a value the user
 *     already has.
 *   - It carries NO interpretation (normal/abnormal ranges) and makes NO
 *     screening recommendation. Those are the reviewer-gated layers
 *     (`interpretation/tableV1.ts` biomarkers map + `biomarkers/registry.ts`
 *     CURATED_PANELS, both empty until a clinical reviewer ships them) and
 *     the preventive layer (`@/preventive`, USPSTF-sourced). A logged value
 *     displays raw, same as an uploaded lab does today.
 *   - `plausible` is a TYPO guardrail (physical sanity in the canonical
 *     unit), NOT a clinical normal range — never surfaced as a verdict.
 *   - COHORT gating is by `sex_at_birth` ONLY (mirrors `instrumentsFor`):
 *     sex-specific markers (PSA, testosterone) are male-only. There is no
 *     age gate on the catalog — the cohort is 45+, and age drives
 *     INTERPRETATION ranges + PREVENTIVE cadence, not which marker is
 *     offered. The deeper women's-health markers (bone-density T-score,
 *     mammography/Pap cadence) live in the preventive layer + a future
 *     signed-number entry, NOT here — see docs/design/biomarkers-longitudinal-v1.md.
 *   - PROVISIONAL: every entry is `provisional: true`. All LOINC codes were
 *     VERIFIED against the NLM Clinical Tables LOINC API
 *     (clinicaltables.nlm.nih.gov/api/loinc_items): the original 9 on
 *     2026-06-12, the 12 expansion codes on 2026-06-13. Still provisional
 *     pending clinical sign-off on the marker SET, units, plausible bounds,
 *     sex/age relevance, and coding nuances (fasting vs random glucose
 *     1558-6/2339-0; LDL direct 18262-6 vs calculated 13457-7). Do NOT add
 *     interpretation here.
 *
 * Each marker has one or more numeric `fields` (blood pressure has two);
 * each field commits as its own observation, so the model is identical to
 * the upload path and the future device-sync path.
 */

import type { SexAtBirth } from "@/contracts";

export type MarkerCategory = "vital" | "biomarker" | "anthropometric";

/** Display grouping for the picker (organization only — no clinical meaning). */
export type MarkerGroup =
  | "Heart & cholesterol"
  | "Blood sugar"
  | "Kidney & liver"
  | "Thyroid & nutrients"
  | "Body"
  | "Men's health";

/** Render order for the grouped picker. */
export const MARKER_GROUP_ORDER: ReadonlyArray<MarkerGroup> = [
  "Heart & cholesterol",
  "Blood sugar",
  "Kidney & liver",
  "Thyroid & nutrients",
  "Body",
  "Men's health",
];

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
  /** Picker grouping (organization only). */
  group: MarkerGroup;
  /** One field (single value) or several (blood pressure = 2). */
  fields: ReadonlyArray<MarkerField>;
  /** True until a clinical reviewer verifies the codes/units/set. */
  provisional: boolean;
  /**
   * Sex-at-birth gate. Absent → universal (offered to everyone). Present →
   * offered ONLY to the listed sexes (e.g. PSA → ["male"]). Gating is on
   * sex_at_birth, never gender_identity (clinical-key rule).
   */
  cohort?: { sex: ReadonlyArray<SexAtBirth> };
  /**
   * Optional data-entry instruction shown on the entry screen — clarifies
   * WHICH/HOW reading to enter (data quality), never a clinical recommendation.
   */
  entryHint?: string;
}

const MGDL_TO_MMOL_GLUCOSE = 1 / 18.0156; // glucose molar mass
const MGDL_TO_MMOL_CHOL = 1 / 38.67; // cholesterol molar mass
const MGDL_TO_MMOL_TG = 1 / 88.57; // triglyceride molar mass
const LB_TO_KG = 0.45359237;
const IN_TO_CM = 2.54;

/**
 * Marker set. PROVISIONAL codes — operator/clinical to verify the SET,
 * units, bounds, and sex/age relevance. Canonical units chosen to match
 * common US reporting conventions; the reviewer may add international units
 * (mmol/L, µmol/L, nmol/L) where appropriate.
 */
export const MARKER_CATALOG: ReadonlyArray<MarkerDef> = [
  // ── Heart & cholesterol ──────────────────────────────────────────────
  {
    key: "blood_pressure",
    display: "Blood pressure",
    category: "vital",
    group: "Heart & cholesterol",
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
    key: "resting_heart_rate",
    display: "Resting heart rate",
    category: "vital",
    group: "Heart & cholesterol",
    provisional: true,
    fields: [
      {
        loinc: "8867-4",
        units: [{ unit: "bpm", canonical: true, toCanonicalFactor: 1 }],
        plausible: { min: 20, max: 250 },
      },
    ],
  },
  {
    key: "total_cholesterol",
    display: "Total cholesterol",
    category: "biomarker",
    group: "Heart & cholesterol",
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
    group: "Heart & cholesterol",
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
    group: "Heart & cholesterol",
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
    key: "triglycerides",
    display: "Triglycerides",
    category: "biomarker",
    group: "Heart & cholesterol",
    provisional: true,
    entryHint: "A fasting reading is most accurate.",
    fields: [
      {
        loinc: "2571-8",
        units: [
          { unit: "mg/dL", canonical: true, toCanonicalFactor: 1 },
          { unit: "mmol/L", toCanonicalFactor: 1 / MGDL_TO_MMOL_TG },
        ],
        plausible: { min: 20, max: 5000 }, // mg/dL
      },
    ],
  },
  {
    key: "hs_crp",
    display: "C-reactive protein (hs)",
    category: "biomarker",
    group: "Heart & cholesterol",
    provisional: true,
    fields: [
      {
        loinc: "30522-7",
        units: [{ unit: "mg/L", canonical: true, toCanonicalFactor: 1 }],
        plausible: { min: 0.1, max: 300 },
      },
    ],
  },

  // ── Blood sugar ──────────────────────────────────────────────────────
  {
    key: "hba1c",
    display: "Hemoglobin A1c",
    category: "biomarker",
    group: "Blood sugar",
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
    group: "Blood sugar",
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

  // ── Kidney & liver ───────────────────────────────────────────────────
  {
    key: "creatinine",
    display: "Creatinine",
    category: "biomarker",
    group: "Kidney & liver",
    provisional: true,
    fields: [
      {
        loinc: "2160-0",
        units: [{ unit: "mg/dL", canonical: true, toCanonicalFactor: 1 }],
        plausible: { min: 0.1, max: 20 },
      },
    ],
  },
  {
    key: "egfr",
    display: "Kidney filtration (eGFR)",
    category: "biomarker",
    group: "Kidney & liver",
    provisional: true,
    fields: [
      {
        // CKD-EPI 2021 (race-free) creatinine-based eGFR.
        loinc: "98979-8",
        units: [
          { unit: "mL/min/1.73m²", canonical: true, toCanonicalFactor: 1 },
        ],
        plausible: { min: 1, max: 150 },
      },
    ],
  },
  {
    key: "alt",
    display: "Liver enzyme (ALT)",
    category: "biomarker",
    group: "Kidney & liver",
    provisional: true,
    fields: [
      {
        loinc: "1742-6",
        units: [{ unit: "U/L", canonical: true, toCanonicalFactor: 1 }],
        plausible: { min: 1, max: 2000 },
      },
    ],
  },
  {
    key: "ast",
    display: "Liver enzyme (AST)",
    category: "biomarker",
    group: "Kidney & liver",
    provisional: true,
    fields: [
      {
        loinc: "1920-8",
        units: [{ unit: "U/L", canonical: true, toCanonicalFactor: 1 }],
        plausible: { min: 1, max: 2000 },
      },
    ],
  },

  // ── Thyroid & nutrients ──────────────────────────────────────────────
  {
    key: "tsh",
    display: "Thyroid (TSH)",
    category: "biomarker",
    group: "Thyroid & nutrients",
    provisional: true,
    fields: [
      {
        loinc: "3016-3",
        units: [{ unit: "mIU/L", canonical: true, toCanonicalFactor: 1 }],
        plausible: { min: 0.001, max: 100 },
      },
    ],
  },
  {
    key: "ferritin",
    display: "Ferritin (iron stores)",
    category: "biomarker",
    group: "Thyroid & nutrients",
    provisional: true,
    fields: [
      {
        loinc: "2276-4",
        units: [{ unit: "ng/mL", canonical: true, toCanonicalFactor: 1 }],
        plausible: { min: 1, max: 5000 },
      },
    ],
  },
  {
    key: "vitamin_d",
    display: "Vitamin D (25-OH)",
    category: "biomarker",
    group: "Thyroid & nutrients",
    provisional: true,
    fields: [
      {
        loinc: "62292-8",
        units: [{ unit: "ng/mL", canonical: true, toCanonicalFactor: 1 }],
        plausible: { min: 1, max: 200 },
      },
    ],
  },

  // ── Body ─────────────────────────────────────────────────────────────
  {
    key: "weight",
    display: "Weight",
    category: "anthropometric",
    group: "Body",
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
    key: "waist_circumference",
    display: "Waist circumference",
    category: "anthropometric",
    group: "Body",
    provisional: true,
    entryHint: "Measure at the navel, after breathing out.",
    fields: [
      {
        loinc: "56086-2",
        units: [
          { unit: "cm", canonical: true, toCanonicalFactor: 1 },
          { unit: "in", toCanonicalFactor: IN_TO_CM },
        ],
        plausible: { min: 30, max: 250 }, // cm
      },
    ],
  },

  // ── Men's health (sex_at_birth = male) ───────────────────────────────
  {
    key: "testosterone",
    display: "Testosterone (total)",
    category: "biomarker",
    group: "Men's health",
    provisional: true,
    cohort: { sex: ["male"] },
    entryHint: "Morning readings are most accurate.",
    fields: [
      {
        loinc: "2986-8",
        units: [{ unit: "ng/dL", canonical: true, toCanonicalFactor: 1 }],
        plausible: { min: 1, max: 3000 },
      },
    ],
  },
  {
    key: "psa",
    display: "PSA (prostate)",
    category: "biomarker",
    group: "Men's health",
    provisional: true,
    cohort: { sex: ["male"] },
    fields: [
      {
        loinc: "2857-1",
        units: [{ unit: "ng/mL", canonical: true, toCanonicalFactor: 1 }],
        plausible: { min: 0, max: 200 },
      },
    ],
  },
];

/** Look up a marker definition by key. */
export function findMarker(key: string): MarkerDef | undefined {
  return MARKER_CATALOG.find((m) => m.key === key);
}

/**
 * Markers offered to a given sex_at_birth cohort. Universal markers (no
 * `cohort`) are always included; sex-specific markers only when the sex
 * matches. For null/unknown/intersex, sex-specific markers are excluded
 * (same strictness as `instrumentsFor`) — never guess a sex-gated marker.
 */
export function markersFor(
  sexAtBirth: SexAtBirth | null | undefined,
): ReadonlyArray<MarkerDef> {
  return MARKER_CATALOG.filter((m) => {
    if (m.cohort?.sex == null) return true;
    return sexAtBirth != null && m.cohort.sex.includes(sexAtBirth);
  });
}

export interface TrackedMarker {
  marker: MarkerDef;
  /** Latest observation date (ISO) among the marker's codes. */
  lastLoggedAt: string;
}

/**
 * Markers the user already has DATA for (logged OR uploaded) — a BEHAVIORAL
 * "you're tracking these" signal, NOT a clinical relevance/recommendation
 * claim. Matches the user's observation codes against the cohort-relevant
 * catalog and returns each tracked marker with its latest date, most-recent
 * first. Pure + testable. (Clinical age/sex/risk relevance is a separate,
 * reviewer/USPSTF-sourced layer — see docs/design/biomarkers-longitudinal-v1.md.)
 */
export function trackedMarkers(
  observations: ReadonlyArray<{ code: string; effective_at: string }>,
  sexAtBirth: SexAtBirth | null | undefined,
): TrackedMarker[] {
  const latestByCode = new Map<string, string>();
  for (const o of observations) {
    const prev = latestByCode.get(o.code);
    if (prev == null || o.effective_at > prev) {
      latestByCode.set(o.code, o.effective_at);
    }
  }
  const out: TrackedMarker[] = [];
  for (const m of markersFor(sexAtBirth)) {
    let latest: string | null = null;
    for (const f of m.fields) {
      const t = latestByCode.get(f.loinc);
      if (t != null && (latest == null || t > latest)) latest = t;
    }
    if (latest != null) out.push({ marker: m, lastLoggedAt: latest });
  }
  out.sort((a, b) => (a.lastLoggedAt < b.lastLoggedAt ? 1 : -1));
  return out;
}

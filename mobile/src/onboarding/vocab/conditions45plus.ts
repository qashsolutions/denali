/**
 * Curated condition vocabulary for the 45+ U.S. audience.
 *
 * Each entry maps a plain-language label to an ICD-10 code so the user
 * picks coded data (autocomplete) instead of free text. The list is
 * intentionally short (~25 entries) — covers the conditions common in
 * the 45+ U.S. audience without overwhelming the picker. "Other"
 * fallthrough is handled by the AutocompleteInput's `allowOther` flag,
 * which stores the user's typed text with `isUncoded: true` so an
 * analyst can re-code later.
 *
 * Codes follow the ICD-10-CM convention used by the existing web app
 * (see app/src/lib/tools/* — government-API tools query the same code
 * set). Where ICD-10 distinguishes between sub-codes (e.g. essential
 * hypertension I10 vs. secondary I15.x), we pick the most common code
 * and let the EOB / lab parsing path supply finer-grained codes when
 * they appear in claims.
 *
 * Pure data module — no side effects. Importable from node-env tests.
 */
import type { CodeSystem } from "@/contracts";
import type { ProvenanceRecord } from "@/lib/provenance";

export interface ConditionVocabEntry {
  /** ICD-10-CM code, e.g. "I10". */
  code: string;
  code_system: CodeSystem;
  /** Plain-language display label shown in the picker. */
  display: string;
  /** Alternate spellings / common nicknames the autocomplete should match on. */
  aliases?: ReadonlyArray<string>;
}

/**
 * Curated 45+ condition shortlist. ICD-10-CM codes are widely-used parent
 * codes; sub-classifications are out of scope for self-report onboarding.
 */
export const CONDITIONS_45_PLUS: ReadonlyArray<ConditionVocabEntry> = [
  {
    code: "I10",
    code_system: "ICD10",
    display: "High blood pressure (hypertension)",
    aliases: ["hypertension", "htn", "high bp", "elevated blood pressure"],
  },
  {
    code: "E11.9",
    code_system: "ICD10",
    display: "Type 2 diabetes",
    aliases: ["type 2 diabetes", "t2d", "diabetes mellitus", "diabetes"],
  },
  {
    code: "R73.03",
    code_system: "ICD10",
    display: "Prediabetes",
    aliases: ["prediabetes", "pre-diabetes", "borderline diabetes"],
  },
  {
    code: "E10.9",
    code_system: "ICD10",
    display: "Type 1 diabetes",
    aliases: ["type 1 diabetes", "t1d", "juvenile diabetes"],
  },
  {
    code: "E78.5",
    code_system: "ICD10",
    display: "High cholesterol (dyslipidemia)",
    aliases: [
      "high cholesterol",
      "dyslipidemia",
      "hyperlipidemia",
      "hypercholesterolemia",
      "high triglycerides",
    ],
  },
  {
    code: "I25.10",
    code_system: "ICD10",
    display: "Coronary artery disease",
    aliases: ["cad", "coronary artery disease", "heart disease", "ischemic heart disease"],
  },
  {
    code: "I48.91",
    code_system: "ICD10",
    display: "Atrial fibrillation",
    aliases: ["a-fib", "afib", "atrial fibrillation", "irregular heartbeat"],
  },
  {
    code: "I50.9",
    code_system: "ICD10",
    display: "Heart failure",
    aliases: ["congestive heart failure", "chf", "heart failure"],
  },
  {
    code: "I63.9",
    code_system: "ICD10",
    display: "Stroke (history of)",
    aliases: ["stroke", "cva", "cerebrovascular accident"],
  },
  {
    code: "J45.909",
    code_system: "ICD10",
    display: "Asthma",
    aliases: ["asthma", "reactive airway disease"],
  },
  {
    code: "J44.9",
    code_system: "ICD10",
    display: "COPD",
    aliases: ["copd", "chronic obstructive pulmonary disease", "emphysema", "chronic bronchitis"],
  },
  {
    code: "N18.9",
    code_system: "ICD10",
    display: "Chronic kidney disease",
    aliases: ["ckd", "chronic kidney disease", "kidney disease", "renal disease"],
  },
  {
    code: "M19.90",
    code_system: "ICD10",
    display: "Osteoarthritis",
    aliases: ["osteoarthritis", "oa", "degenerative joint disease", "arthritis"],
  },
  {
    code: "M81.0",
    code_system: "ICD10",
    display: "Osteoporosis",
    aliases: ["osteoporosis", "thinning bones", "low bone density"],
  },
  {
    code: "E03.9",
    code_system: "ICD10",
    display: "Hypothyroidism",
    aliases: ["hypothyroidism", "underactive thyroid", "low thyroid"],
  },
  {
    code: "K21.9",
    code_system: "ICD10",
    display: "GERD (acid reflux)",
    aliases: ["gerd", "acid reflux", "heartburn", "reflux"],
  },
  {
    code: "F32.9",
    code_system: "ICD10",
    display: "Depression",
    aliases: ["depression", "mdd", "major depressive disorder", "depressive disorder"],
  },
  {
    code: "F41.9",
    code_system: "ICD10",
    display: "Anxiety",
    aliases: ["anxiety", "generalized anxiety", "gad", "anxiety disorder"],
  },
  {
    code: "G47.33",
    code_system: "ICD10",
    display: "Sleep apnea",
    aliases: ["sleep apnea", "osa", "obstructive sleep apnea"],
  },
  {
    code: "G43.909",
    code_system: "ICD10",
    display: "Migraine",
    aliases: ["migraine", "migraines", "migraine headache"],
  },
  {
    code: "N40.0",
    code_system: "ICD10",
    display: "Enlarged prostate (BPH)",
    aliases: ["bph", "enlarged prostate", "benign prostatic hyperplasia"],
  },
  {
    code: "N95.1",
    code_system: "ICD10",
    display: "Menopause symptoms",
    aliases: ["menopause", "perimenopause", "menopausal symptoms", "hot flashes"],
  },
  {
    code: "E66.9",
    code_system: "ICD10",
    display: "Obesity",
    aliases: ["obesity", "overweight", "high bmi"],
  },
  {
    code: "C80.1",
    code_system: "ICD10",
    display: "Cancer (history of)",
    aliases: ["cancer", "malignancy", "history of cancer"],
  },
  {
    code: "K70.30",
    code_system: "ICD10",
    display: "Liver disease",
    aliases: ["liver disease", "cirrhosis", "fatty liver", "hepatitis"],
  },
] as const;

/**
 * Vocabulary-level provenance (v1.2 evidence pipeline). The list is a
 * coded ICD-10-CM vocabulary, so provenance is carried per-vocabulary
 * (code-system version), not per-entry — PMIDs don't apply to code
 * picks. `pmid_or_code_system_version` is pinned by the
 * terminology-verifier (e.g. "ICD-10-CM 2026") once the icd10 MCP
 * connector is reachable; the annual drift job re-validates it.
 */
export const CONDITIONS_45_PLUS_PROVENANCE: ProvenanceRecord = {
  source:
    "Curated 45+ condition shortlist; ICD-10-CM parent codes matching the web app's government-API code set (app/src/lib/tools/*).",
  pmid_or_code_system_version: null,
  retrieved_at: null,
  review_status: "pending_clinical_review",
};

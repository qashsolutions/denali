/**
 * EOB Clinical Extraction
 *
 * Extracts diabetes-relevant conditions and medications from EOB claims data.
 * Blue Button 2.0 doesn't provide Observation/Condition/MedicationRequest,
 * but EOB claims contain ICD-10 diagnoses, CPT procedures, and Part D drugs.
 *
 * This module bridges that gap — mining clinical intelligence from claims.
 */

import type { ClaimSummary, DiagnosisSummary, MedicationSummary } from "./transforms";

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/** ICD-10 prefix → diabetes category mapping */
const DIABETES_ICD10_PREFIXES: Array<[string, DiagnosisSummary["category"]]> = [
  ["E10", "type1"],
  ["E11", "type2"],
  ["E13", "other-diabetes"],
  ["R73.03", "pre-diabetic"],
  ["R73.09", "pre-diabetic"],
  ["E66", "obesity"],
];

/** Drug class keywords for diabetes medications */
const DIABETES_DRUG_PATTERNS =
  /metformin|insulin|glipizide|glyburide|glimepiride|pioglitazone|rosiglitazone|sitagliptin|saxagliptin|linagliptin|alogliptin|canagliflozin|dapagliflozin|empagliflozin|ertugliflozin|liraglutide|semaglutide|dulaglutide|exenatide|tirzepatide|acarbose|miglitol|nateglinide|repaglinide|colesevelam|bromocriptine|pramlintide/i;

/** Claims older than this are considered "Completed" rather than "Active" */
const ACTIVE_MEDICATION_MONTHS = 6;

// ─────────────────────────────────────────────────────────────────────────────
// Condition Extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract diabetes/obesity conditions from EOB claim diagnosis codes.
 * Deduplicates by ICD-10 code, keeps most recent service date.
 */
export function extractConditionsFromClaims(claims: ClaimSummary[]): DiagnosisSummary[] {
  const seen = new Map<string, DiagnosisSummary>();

  for (const claim of claims) {
    const codes = claim.diagnosisCodes;
    if (!codes || codes.length === 0) continue;

    for (let i = 0; i < codes.length; i++) {
      const code = codes[i];
      if (!code) continue; // Skip entries without ICD-10 codes
      const display = claim.diagnosis[i] ?? code;

      const match = DIABETES_ICD10_PREFIXES.find(([prefix]) => code.startsWith(prefix));
      if (!match) continue;

      const existing = seen.get(code);
      if (existing) {
        // Keep the most recent date
        if (parseDate(claim.serviceDate) > parseDate(existing.recordedDate)) {
          existing.recordedDate = claim.serviceDate;
        }
      } else {
        seen.set(code, {
          code,
          name: display,
          category: match[1],
          recordedDate: claim.serviceDate,
        });
      }
    }
  }

  return Array.from(seen.values());
}

// ─────────────────────────────────────────────────────────────────────────────
// Medication Extraction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract medications from Part D (prescription) claims.
 * Deduplicates by normalized drug name, marks recent fills as "Active".
 */
export function extractMedicationsFromClaims(claims: ClaimSummary[]): MedicationSummary[] {
  // Filter to Part D claims (PDE type)
  const partDClaims = claims.filter(
    (c) => c.type.includes("Part D") || c.type === "PDE"
  );

  const medMap = new Map<string, MedicationSummary>();
  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - ACTIVE_MEDICATION_MONTHS);

  for (const claim of partDClaims) {
    for (const proc of claim.procedures) {
      if (!proc) continue;

      // Normalize for deduplication (lowercase, trim)
      const normalized = proc.trim().toLowerCase();
      const isDiabetesMed = DIABETES_DRUG_PATTERNS.test(normalized);

      const claimDate = parseDate(claim.serviceDate);
      const isRecent = claimDate >= cutoffDate;

      const existing = medMap.get(normalized);
      if (existing) {
        // Update to most recent date and status
        if (claimDate > parseDate(existing.startDate)) {
          existing.startDate = claim.serviceDate;
          existing.status = isRecent ? "Active" : existing.status;
        }
      } else {
        medMap.set(normalized, {
          name: proc, // Keep original casing
          status: isRecent ? "Active" : "Completed",
          dosage: "", // Not available from EOB
          startDate: claim.serviceDate,
          isDiabetesMed,
        });
      }
    }
  }

  // Diabetes meds first, then alphabetical
  return Array.from(medMap.values()).sort((a, b) => {
    if (a.isDiabetesMed !== b.isDiabetesMed) return a.isDiabetesMed ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseDate(dateStr: string): Date {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

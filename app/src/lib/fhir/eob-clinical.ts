/**
 * EOB Clinical Extraction
 *
 * Extracts diabetes-relevant conditions and medications from EOB claims data.
 * Blue Button 2.0 doesn't provide Observation/Condition/MedicationRequest,
 * but EOB claims contain ICD-10 diagnoses, CPT procedures, and Part D drugs.
 *
 * This module bridges that gap — mining clinical intelligence from claims.
 */

import type {
  ClaimSummary,
  DiagnosisSummary,
  MedicationSummary,
  ScreeningHistory,
  ProviderDetail,
  HospitalizationSummary,
} from "./transforms";

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

/** Drug class keywords for obesity/weight-loss medications (includes GLP-1 dual-use) */
const OBESITY_DRUG_PATTERNS =
  /wegovy|zepbound|saxenda|contrave|qsymia|xenical|orlistat|phentermine|naltrexone.*bupropion|bupropion.*naltrexone|semaglutide|tirzepatide|liraglutide/i;

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
      const isObesityMed = OBESITY_DRUG_PATTERNS.test(normalized);

      const claimDate = parseDate(claim.serviceDate);
      const isRecent = claimDate >= cutoffDate;

      // PDE enrichment from claim data
      const pde = claim.pdeInfo;

      const existing = medMap.get(normalized);
      if (existing) {
        // Update to most recent date and status
        if (claimDate > parseDate(existing.startDate)) {
          existing.startDate = claim.serviceDate;
          existing.lastFillDate = claim.serviceDate;
          existing.status = isRecent ? "Active" : existing.status;
          // Update PDE fields from most recent claim
          if (pde) {
            if (pde.daysSupply != null) existing.daysSupply = pde.daysSupply;
            if (pde.refillNumber != null) existing.refillNumber = pde.refillNumber;
            if (pde.totalRefillsAuthorized != null) existing.totalRefillsAuthorized = pde.totalRefillsAuthorized;
            if (pde.isBrandName != null) existing.isBrandName = pde.isBrandName;
            if (pde.quantityDispensed != null) existing.quantityDispensed = pde.quantityDispensed;
          }
        }
      } else {
        medMap.set(normalized, {
          name: proc, // Keep original casing
          status: isRecent ? "Active" : "Completed",
          dosage: "", // Not available from EOB
          startDate: claim.serviceDate,
          isDiabetesMed,
          isObesityMed,
          daysSupply: pde?.daysSupply,
          refillNumber: pde?.refillNumber,
          totalRefillsAuthorized: pde?.totalRefillsAuthorized,
          quantityDispensed: pde?.quantityDispensed,
          isBrandName: pde?.isBrandName,
          lastFillDate: claim.serviceDate,
        });
      }
    }
  }

  // Compute estimated run-out dates and gap days
  const now = new Date();
  for (const med of medMap.values()) {
    if (med.lastFillDate && med.daysSupply) {
      const fillDate = parseDate(med.lastFillDate);
      const runOut = new Date(fillDate);
      runOut.setDate(runOut.getDate() + med.daysSupply);
      med.estimatedRunOutDate = runOut.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
      const gapMs = now.getTime() - runOut.getTime();
      med.gapDays = Math.floor(gapMs / (1000 * 60 * 60 * 24));
    }
  }

  // Diabetes meds first, obesity meds second, then alphabetical
  return Array.from(medMap.values()).sort((a, b) => {
    if (a.isDiabetesMed !== b.isDiabetesMed) return a.isDiabetesMed ? -1 : 1;
    if (a.isObesityMed !== b.isObesityMed) return a.isObesityMed ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Screening Extraction (P0)
// ─────────────────────────────────────────────────────────────────────────────

interface ScreeningSpec {
  type: ScreeningHistory["screeningType"];
  displayName: string;
  recommendedFrequency: string;
  overdueMonths: number;
}

const SCREENING_CPT_MAP: Record<string, ScreeningSpec> = {
  "83036": { type: "a1c", displayName: "A1C Test", recommendedFrequency: "Every 3-6 months", overdueMonths: 12 },
  "83037": { type: "a1c", displayName: "A1C Test", recommendedFrequency: "Every 3-6 months", overdueMonths: 12 },
  "92250": { type: "eye-exam", displayName: "Diabetic Eye Exam", recommendedFrequency: "Yearly", overdueMonths: 15 },
  "92134": { type: "eye-exam", displayName: "Diabetic Eye Exam", recommendedFrequency: "Yearly", overdueMonths: 15 },
  "92228": { type: "eye-exam", displayName: "Diabetic Eye Exam", recommendedFrequency: "Yearly", overdueMonths: 15 },
  "80053": { type: "metabolic-panel", displayName: "Metabolic Panel", recommendedFrequency: "Yearly", overdueMonths: 15 },
  "80048": { type: "metabolic-panel", displayName: "Metabolic Panel", recommendedFrequency: "Yearly", overdueMonths: 15 },
  "81001": { type: "kidney", displayName: "Kidney Screening", recommendedFrequency: "Yearly", overdueMonths: 15 },
  "81003": { type: "kidney", displayName: "Kidney Screening", recommendedFrequency: "Yearly", overdueMonths: 15 },
  "93000": { type: "ecg", displayName: "ECG/Heart Check", recommendedFrequency: "As recommended", overdueMonths: 24 },
  "93005": { type: "ecg", displayName: "ECG/Heart Check", recommendedFrequency: "As recommended", overdueMonths: 24 },
  "93010": { type: "ecg", displayName: "ECG/Heart Check", recommendedFrequency: "As recommended", overdueMonths: 24 },
  "99213": { type: "office-visit", displayName: "Office Visit", recommendedFrequency: "Every 3-6 months", overdueMonths: 9 },
  "99214": { type: "office-visit", displayName: "Office Visit", recommendedFrequency: "Every 3-6 months", overdueMonths: 9 },
  "97802": { type: "nutrition", displayName: "Nutrition Counseling", recommendedFrequency: "As recommended", overdueMonths: 18 },
  "97803": { type: "nutrition", displayName: "Nutrition Counseling", recommendedFrequency: "As recommended", overdueMonths: 18 },
  "G0108": { type: "dsmt", displayName: "Diabetes Self-Management Training", recommendedFrequency: "Yearly", overdueMonths: 15 },
  "G0109": { type: "dsmt", displayName: "Diabetes Self-Management Training", recommendedFrequency: "Yearly", overdueMonths: 15 },
  // Obesity-specific counseling CPTs (IBT — NCD 210.12)
  "G0447": { type: "obesity-counseling", displayName: "Obesity Behavioral Counseling (IBT)", recommendedFrequency: "Per IBT schedule", overdueMonths: 12 },
  "G0473": { type: "obesity-counseling", displayName: "Obesity Counseling Maintenance", recommendedFrequency: "Monthly (months 7-12)", overdueMonths: 12 },
};

/**
 * Extract screening history from Carrier/Outpatient claims by matching CPT codes.
 * Deduplicates by screening type, keeps most recent date.
 */
export function extractScreeningsFromClaims(claims: ClaimSummary[]): ScreeningHistory[] {
  // Filter to Carrier and Outpatient claims
  const relevantClaims = claims.filter(
    (c) => c.type.includes("Carrier") || c.type.includes("Outpatient")
  );

  const screeningMap = new Map<string, { spec: ScreeningSpec; lastDate: Date; cptCodes: Set<string> }>();
  const now = new Date();

  for (const claim of relevantClaims) {
    const codes = claim.procedureCodes;
    if (!codes || codes.length === 0) continue;
    const claimDate = parseDate(claim.serviceDate);

    for (const code of codes) {
      if (!code) continue;
      const spec = SCREENING_CPT_MAP[code.toUpperCase()];
      if (!spec) continue;

      const existing = screeningMap.get(spec.type);
      if (existing) {
        existing.cptCodes.add(code);
        if (claimDate > existing.lastDate) {
          existing.lastDate = claimDate;
        }
      } else {
        screeningMap.set(spec.type, {
          spec,
          lastDate: claimDate,
          cptCodes: new Set([code]),
        });
      }
    }
  }

  return Array.from(screeningMap.values()).map(({ spec, lastDate, cptCodes }) => {
    const monthsSinceLast = (now.getFullYear() - lastDate.getFullYear()) * 12 + (now.getMonth() - lastDate.getMonth());
    return {
      screeningType: spec.type,
      displayName: spec.displayName,
      lastDate: lastDate.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
      monthsSinceLast,
      isOverdue: monthsSinceLast >= spec.overdueMonths,
      recommendedFrequency: spec.recommendedFrequency,
      cptCodes: [...cptCodes],
    };
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Provider Extraction (P2)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract unique providers from claim care teams.
 * Aggregates by NPI (or name if no NPI), tracks visit count and claim types.
 */
export function extractProvidersFromClaims(claims: ClaimSummary[]): ProviderDetail[] {
  const providerMap = new Map<string, {
    name: string;
    role: string;
    specialty?: string;
    visitCount: number;
    lastSeen: Date;
    claimTypes: Set<string>;
  }>();

  for (const claim of claims) {
    if (!claim.careTeam || claim.careTeam.length === 0) continue;
    const claimDate = parseDate(claim.serviceDate);

    for (const member of claim.careTeam) {
      const key = member.npi ?? member.name;
      const existing = providerMap.get(key);
      if (existing) {
        existing.visitCount++;
        existing.claimTypes.add(claim.type);
        if (claimDate > existing.lastSeen) {
          existing.lastSeen = claimDate;
          // Update specialty if previously unknown
          if (!existing.specialty && member.specialty) {
            existing.specialty = member.specialty;
          }
        }
      } else {
        providerMap.set(key, {
          name: member.name,
          role: member.role,
          specialty: member.specialty,
          visitCount: 1,
          lastSeen: claimDate,
          claimTypes: new Set([claim.type]),
        });
      }
    }
  }

  return Array.from(providerMap.entries())
    .map(([key, p]) => ({
      npi: key.match(/^\d+$/) ? key : "",
      name: p.name,
      role: p.role,
      specialty: p.specialty,
      visitCount: p.visitCount,
      lastSeen: p.lastSeen.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
      claimTypes: [...p.claimTypes],
    }))
    .sort((a, b) => b.visitCount - a.visitCount);
}

// ─────────────────────────────────────────────────────────────────────────────
// Hospitalization Extraction (P3)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Extract hospitalization summaries from Inpatient/SNF claims.
 */
export function extractHospitalizationsFromClaims(claims: ClaimSummary[]): HospitalizationSummary[] {
  const now = new Date();

  return claims
    .filter((c) => {
      const t = c.type.toLowerCase();
      return t.includes("inpatient") || t.includes("snf") || t.includes("skilled nursing");
    })
    .map((claim) => {
      const admDate = parseDate(claim.serviceDate);
      const dischDate = claim.dischargeDate ? parseDate(claim.dischargeDate) : admDate;
      const lengthOfStay = Math.max(1, Math.ceil((dischDate.getTime() - admDate.getTime()) / (1000 * 60 * 60 * 24)));
      const daysSinceDischarge = Math.ceil((now.getTime() - dischDate.getTime()) / (1000 * 60 * 60 * 24));

      return {
        admissionDate: claim.serviceDate,
        dischargeDate: claim.dischargeDate ?? claim.serviceDate,
        lengthOfStay,
        admissionType: claim.admissionType,
        dischargeStatus: claim.dischargeStatus,
        drgDescription: undefined, // DRG code-to-description mapping not included to keep scope minimal
        diagnoses: claim.diagnosis,
        provider: claim.provider,
        totalCharged: claim.totalCharged,
        medicarePaid: claim.medicarePaid,
        youOwe: claim.youOwe,
        daysSinceDischarge,
        needsFollowUp: daysSinceDischarge <= 30 && daysSinceDischarge >= 0,
      };
    })
    .sort((a, b) => parseDate(b.dischargeDate).getTime() - parseDate(a.dischargeDate).getTime());
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseDate(dateStr: string): Date {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

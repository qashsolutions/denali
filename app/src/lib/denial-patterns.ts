/**
 * Medicare Denial Patterns
 *
 * Common denial reasons for Medicare claims and strategies for appeals.
 * Used by the appeal generator to provide targeted guidance.
 */

import type { CPTCode, ICD10Code } from "./medicare-codes";
import { MEDICARE_CONSTANTS } from "@/config";

// =============================================================================
// TYPES
// =============================================================================

export interface DenialPattern {
  /** Denial reason code or description */
  reason: string;
  /** Common denial reason codes from Medicare */
  reasonCodes?: string[];
  /** CPT codes frequently denied for this reason */
  commonCPTs: string[];
  /** ICD-10 codes that often trigger this denial */
  commonDiagnoses?: string[];
  /** Strategy for appealing this type of denial */
  appealStrategy: string;
  /** Key documentation points to emphasize */
  documentationChecklist: string[];
  /** Typical success rate for appeals (estimated) */
  estimatedSuccessRate?: "low" | "medium" | "high";
  /** Time limit for appeal (days from denial) */
  appealDeadlineDays: number;
}

export interface DenialCategory {
  category: string;
  description: string;
  patterns: DenialPattern[];
}

// =============================================================================
// COMMON DENIAL PATTERNS
// =============================================================================

export const DENIAL_PATTERNS: DenialPattern[] = [
  // ---------------------------------------------------------------------------
  // Medical Necessity Denials
  // ---------------------------------------------------------------------------
  {
    reason: "Not medically necessary",
    reasonCodes: ["PR-50", "CO-50", "M62"],
    commonCPTs: [
      "27447", "27130", // Joint replacements
      "72148", "72149", // MRI spine
      "73721", "73722", // MRI knee
      "66984", // Cataract surgery
      "95810", "95811", // Sleep studies
    ],
    appealStrategy:
      "Document functional limitations, failed conservative treatment over adequate time period, and impact on activities of daily living (ADLs). Include specific measurable outcomes.",
    documentationChecklist: [
      "Duration of symptoms (minimum 6 weeks for most procedures)",
      "List of conservative treatments tried and failed",
      "Specific functional limitations (walking distance, stairs, sleep quality)",
      "Impact on daily activities (dressing, bathing, cooking)",
      "Physical examination findings",
      "Relevant imaging or test results",
      "Statement of medical necessity from treating physician",
    ],
    estimatedSuccessRate: "high",
    appealDeadlineDays: MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS,
  },

  {
    reason: "Experimental or investigational",
    reasonCodes: ["PR-96", "CO-96"],
    commonCPTs: [
      "0274T", "0275T", // Newer procedures
      "96413", "96415", // Certain chemotherapy
    ],
    appealStrategy:
      "Provide peer-reviewed literature supporting efficacy. Cite FDA approvals, clinical guidelines from specialty societies, and similar coverage decisions from other MACs.",
    documentationChecklist: [
      "FDA approval documentation if applicable",
      "Peer-reviewed clinical studies",
      "Professional society guidelines recommending the treatment",
      "Evidence that treatment is standard of care",
      "Similar coverage decisions from other Medicare contractors",
    ],
    estimatedSuccessRate: "medium",
    appealDeadlineDays: MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS,
  },

  // ---------------------------------------------------------------------------
  // Documentation Denials
  // ---------------------------------------------------------------------------
  {
    reason: "Insufficient documentation",
    reasonCodes: ["M79", "M86"],
    commonCPTs: [
      "99213", "99214", "99215", // E/M visits
      "97110", "97140", "97530", // Therapy codes
      "G0438", "G0439", // AWV
    ],
    appealStrategy:
      "Submit complete medical records with highlighted relevant sections. Include physician attestation and any missing documentation.",
    documentationChecklist: [
      "Complete history and physical examination",
      "Chief complaint and history of present illness",
      "Review of systems",
      "Physical examination findings",
      "Medical decision-making documentation",
      "Plan of care with specific goals",
      "Physician signature and date",
    ],
    estimatedSuccessRate: "high",
    appealDeadlineDays: MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS,
  },

  {
    reason: "Missing prior authorization",
    reasonCodes: ["CO-15", "N20"],
    commonCPTs: [
      "27447", "27130", // Joint replacements
      "72148", "72149", // MRI spine
      "95810", // Sleep study
      "E0601", // CPAP
    ],
    appealStrategy:
      "If authorization was obtained, submit proof. If not obtained due to urgency, document emergency circumstances. Request retroactive authorization if policy allows.",
    documentationChecklist: [
      "Prior authorization number if obtained",
      "Documentation of authorization request date",
      "Emergency circumstances if applicable",
      "Medical necessity documentation",
      "Request for retroactive authorization",
    ],
    estimatedSuccessRate: "medium",
    appealDeadlineDays: 60,
  },

  // ---------------------------------------------------------------------------
  // Coverage Denials
  // ---------------------------------------------------------------------------
  {
    reason: "Service not covered by Medicare",
    reasonCodes: ["PR-96", "CO-96", "N130"],
    commonCPTs: [
      "99211", // Minimal E/M (often questioned)
      "D0120", // Dental (not covered)
    ],
    commonDiagnoses: ["Z00.00", "Z00.01"], // Routine exams without symptoms
    appealStrategy:
      "Review LCD/NCD to confirm non-coverage. If service should be covered, cite specific policy language. Consider if different coding would be appropriate.",
    documentationChecklist: [
      "Review of applicable LCD/NCD",
      "Documentation showing service meets coverage criteria",
      "Medical necessity for the specific service",
      "Alternative diagnosis codes if appropriate",
    ],
    estimatedSuccessRate: "low",
    appealDeadlineDays: MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS,
  },

  {
    reason: "Frequency limits exceeded",
    reasonCodes: ["PR-119", "CO-119"],
    commonCPTs: [
      "77067", // Mammography
      "G0439", // AWV (once per year)
      "90732", // Pneumococcal vaccine
      "G0105", // Colonoscopy (once per 10 years)
    ],
    appealStrategy:
      "If medically necessary to exceed frequency, document specific clinical circumstances. Cite guidelines supporting more frequent testing for high-risk patients.",
    documentationChecklist: [
      "Date of previous service",
      "Clinical indication for repeat service",
      "Risk factors justifying increased frequency",
      "Specialty society guidelines if applicable",
      "Change in clinical status since last service",
    ],
    estimatedSuccessRate: "medium",
    appealDeadlineDays: MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS,
  },

  // ---------------------------------------------------------------------------
  // Coding Denials
  // ---------------------------------------------------------------------------
  {
    reason: "Diagnosis does not support procedure",
    reasonCodes: ["CO-167", "M51"],
    commonCPTs: [
      "72148", // MRI lumbar - needs specific diagnosis
      "95810", // Sleep study - needs sleep disorder diagnosis
      "93000", // ECG - needs cardiac indication
    ],
    appealStrategy:
      "Review diagnosis codes used. If correct diagnosis was present but not coded, submit corrected claim. If LCD requires specific diagnosis, document that condition.",
    documentationChecklist: [
      "Primary diagnosis supporting medical necessity",
      "Secondary diagnoses if applicable",
      "Documentation of symptoms matching diagnosis",
      "LCD coverage criteria met",
    ],
    estimatedSuccessRate: "high",
    appealDeadlineDays: MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS,
  },

  {
    reason: "Bundled service - included in another code",
    reasonCodes: ["CO-97", "M15"],
    commonCPTs: [
      "36415", // Venipuncture (often bundled)
      "99000", // Specimen handling (often bundled)
      "96360", // IV infusion (bundled with drugs)
    ],
    appealStrategy:
      "Review NCCI edits. If modifier should allow separate payment, resubmit with appropriate modifier. Document that services were distinct.",
    documentationChecklist: [
      "Documentation that services were separate and distinct",
      "Different body sites or sessions if applicable",
      "Appropriate modifier use (59, XE, XS, XP, XU)",
      "Time documentation if relevant",
    ],
    estimatedSuccessRate: "medium",
    appealDeadlineDays: MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS,
  },

  // ---------------------------------------------------------------------------
  // DME Denials
  // ---------------------------------------------------------------------------
  {
    reason: "DME not medically necessary",
    reasonCodes: ["CO-50", "M62"],
    commonCPTs: [
      "E0601", // CPAP
      "E1390", // Oxygen concentrator
      "K0001", "K0010", // Wheelchairs
      "E0260", // Hospital bed
    ],
    appealStrategy:
      "Document functional limitations and how DME addresses them. Include face-to-face evaluation, detailed written order, and proof of delivery.",
    documentationChecklist: [
      "Face-to-face evaluation within required timeframe",
      "Detailed written order (DWO) with all required elements",
      "Medical necessity documentation",
      "Proof of delivery",
      "For CPAP: sleep study results meeting criteria (AHI ≥ 5)",
      "For oxygen: qualifying blood gas or oximetry results",
      "For wheelchairs: mobility examination findings",
    ],
    estimatedSuccessRate: "medium",
    appealDeadlineDays: MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS,
  },

  {
    reason: "DME supplier not enrolled",
    reasonCodes: ["CO-8", "N95"],
    commonCPTs: ["E0601", "E1390", "K0001", "E0260"],
    appealStrategy:
      "Verify supplier enrollment status. If enrolled, submit proof. If beneficiary obtained from non-enrolled supplier unknowingly, document circumstances.",
    documentationChecklist: [
      "Supplier enrollment verification",
      "Proof of DMEPOS accreditation",
      "Documentation of beneficiary's good faith",
    ],
    estimatedSuccessRate: "low",
    appealDeadlineDays: MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS,
  },

  // ---------------------------------------------------------------------------
  // Therapy Denials
  // ---------------------------------------------------------------------------
  {
    reason: "Therapy services not skilled",
    reasonCodes: ["PR-50", "N362"],
    commonCPTs: [
      "97110", "97112", "97116", // Therapeutic exercises
      "97140", "97530", // Manual therapy, activities
      "97161", "97162", "97163", // PT evaluations
    ],
    appealStrategy:
      "Document complexity requiring skilled intervention. Show measurable functional improvements. Explain why maintenance program or unskilled care would not be appropriate.",
    documentationChecklist: [
      "Skilled intervention required (not maintenance)",
      "Complexity of condition requiring professional judgment",
      "Measurable functional goals",
      "Progress toward goals",
      "Objective measurements (ROM, strength, function)",
      "Plan for discharge/transition",
    ],
    estimatedSuccessRate: "medium",
    appealDeadlineDays: MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS,
  },

  {
    reason: "Therapy cap exceeded",
    reasonCodes: ["CO-119", "N362"],
    commonCPTs: ["97110", "97140", "97530", "92507"],
    appealStrategy:
      "Request exceptions process if applicable. Document continued medical necessity and why additional therapy is needed to achieve functional goals.",
    documentationChecklist: [
      "KX modifier attestation documentation",
      "Continued medical necessity",
      "Functional progress to date",
      "Remaining functional goals",
      "Estimated additional visits needed",
    ],
    estimatedSuccessRate: "high",
    appealDeadlineDays: MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS,
  },
];

// =============================================================================
// DENIAL CATEGORIES
// =============================================================================

export const DENIAL_CATEGORIES: DenialCategory[] = [
  {
    category: "Medical Necessity",
    description:
      "Denials based on the service not being medically necessary for the patient's condition",
    patterns: DENIAL_PATTERNS.filter((p) =>
      ["Not medically necessary", "Experimental or investigational"].includes(
        p.reason
      )
    ),
  },
  {
    category: "Documentation",
    description:
      "Denials due to missing or insufficient documentation to support the claim",
    patterns: DENIAL_PATTERNS.filter((p) =>
      ["Insufficient documentation", "Missing prior authorization"].includes(
        p.reason
      )
    ),
  },
  {
    category: "Coverage",
    description:
      "Denials based on the service not being covered under Medicare or frequency limits",
    patterns: DENIAL_PATTERNS.filter((p) =>
      ["Service not covered by Medicare", "Frequency limits exceeded"].includes(
        p.reason
      )
    ),
  },
  {
    category: "Coding",
    description:
      "Denials due to coding errors, mismatches, or bundling issues",
    patterns: DENIAL_PATTERNS.filter((p) =>
      [
        "Diagnosis does not support procedure",
        "Bundled service - included in another code",
      ].includes(p.reason)
    ),
  },
  {
    category: "DME",
    description:
      "Denials specific to durable medical equipment claims",
    patterns: DENIAL_PATTERNS.filter((p) =>
      ["DME not medically necessary", "DME supplier not enrolled"].includes(
        p.reason
      )
    ),
  },
  {
    category: "Therapy",
    description:
      "Denials specific to physical, occupational, and speech therapy services",
    patterns: DENIAL_PATTERNS.filter((p) =>
      ["Therapy services not skilled", "Therapy cap exceeded"].includes(
        p.reason
      )
    ),
  },
];

// =============================================================================
// APPEAL LEVELS
// =============================================================================

export interface AppealLevel {
  level: number;
  name: string;
  description: string;
  timeLimit: string;
  decisionTimeframe: string;
  successRate?: string;
}

export const MEDICARE_APPEAL_LEVELS: AppealLevel[] = [
  {
    level: 1,
    name: "Redetermination",
    description:
      "First level appeal submitted to the Medicare Administrative Contractor (MAC) that processed the original claim",
    timeLimit: "120 days from denial date",
    decisionTimeframe: "60 days",
    successRate: "~40% of denials overturned",
  },
  {
    level: 2,
    name: "Reconsideration",
    description:
      "Second level appeal reviewed by a Qualified Independent Contractor (QIC), separate from the MAC",
    timeLimit: "180 days from redetermination decision",
    decisionTimeframe: "60 days",
    successRate: "~50% of Level 1 upheld denials overturned",
  },
  {
    level: 3,
    name: "Administrative Law Judge (ALJ) Hearing",
    description:
      "Third level appeal heard by an Administrative Law Judge if amount in controversy meets threshold ($180 for 2024)",
    timeLimit: "60 days from reconsideration decision",
    decisionTimeframe: "90 days",
    successRate: "~70% of cases decided in beneficiary's favor",
  },
  {
    level: 4,
    name: "Medicare Appeals Council Review",
    description:
      "Fourth level review by the Medicare Appeals Council within HHS",
    timeLimit: "60 days from ALJ decision",
    decisionTimeframe: "90 days",
  },
  {
    level: 5,
    name: "Federal District Court",
    description:
      "Final level - judicial review in federal court if amount in controversy meets threshold ($1,840 for 2024)",
    timeLimit: "60 days from Appeals Council decision",
    decisionTimeframe: "Varies",
  },
];

// =============================================================================
// LOOKUP FUNCTIONS
// =============================================================================

/**
 * Find denial patterns matching a reason text
 */
export function findDenialPattern(reasonText: string): DenialPattern[] {
  const lower = reasonText.toLowerCase();

  return DENIAL_PATTERNS.filter(
    (pattern) =>
      pattern.reason.toLowerCase().includes(lower) ||
      pattern.reasonCodes?.some((code) =>
        lower.includes(code.toLowerCase())
      ) ||
      pattern.appealStrategy.toLowerCase().includes(lower)
  );
}

/**
 * Get denial patterns for a specific CPT code
 */
export function getDenialPatternsForCPT(cptCode: string): DenialPattern[] {
  return DENIAL_PATTERNS.filter((pattern) =>
    pattern.commonCPTs.includes(cptCode)
  );
}

/**
 * Get denial patterns by category
 */
export function getDenialPatternsByCategory(
  category: string
): DenialPattern[] {
  const cat = DENIAL_CATEGORIES.find(
    (c) => c.category.toLowerCase() === category.toLowerCase()
  );
  return cat?.patterns || [];
}

/**
 * Get appeal strategy for a denial reason and CPT code
 */
export function getAppealStrategy(
  denialReason: string,
  cptCode?: string
): {
  strategy: string;
  checklist: string[];
  estimatedSuccess: string;
  deadline: number;
} | null {
  // First try to match by CPT code
  if (cptCode) {
    const cptPatterns = getDenialPatternsForCPT(cptCode);
    const match = cptPatterns.find((p) =>
      denialReason.toLowerCase().includes(p.reason.toLowerCase())
    );
    if (match) {
      return {
        strategy: match.appealStrategy,
        checklist: match.documentationChecklist,
        estimatedSuccess: match.estimatedSuccessRate || "unknown",
        deadline: match.appealDeadlineDays,
      };
    }
  }

  // Fall back to matching by denial reason
  const patterns = findDenialPattern(denialReason);
  if (patterns.length > 0) {
    const pattern = patterns[0];
    return {
      strategy: pattern.appealStrategy,
      checklist: pattern.documentationChecklist,
      estimatedSuccess: pattern.estimatedSuccessRate || "unknown",
      deadline: pattern.appealDeadlineDays,
    };
  }

  return null;
}

/**
 * Get the appropriate appeal level based on previous appeals
 */
export function getNextAppealLevel(
  previousLevels: number[] = []
): AppealLevel | null {
  const maxLevel = Math.max(0, ...previousLevels);
  const nextLevel = maxLevel + 1;

  return (
    MEDICARE_APPEAL_LEVELS.find((level) => level.level === nextLevel) || null
  );
}

/**
 * Calculate appeal deadline from denial date
 */
export function calculateAppealDeadline(
  denialDate: Date,
  appealLevel: number = 1
): Date {
  const level = MEDICARE_APPEAL_LEVELS.find((l) => l.level === appealLevel);
  if (!level) {
    // Default to standard appeal deadline if level not found
    const deadline = new Date(denialDate);
    deadline.setDate(deadline.getDate() + MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS);
    return deadline;
  }

  // Parse time limit (e.g., "120 days from denial date")
  const daysMatch = level.timeLimit.match(/(\d+)\s*days/i);
  const days = daysMatch ? parseInt(daysMatch[1], 10) : MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS;

  const deadline = new Date(denialDate);
  deadline.setDate(deadline.getDate() + days);
  return deadline;
}

// =============================================================================
// COMMON DENIAL REASON CODES
// =============================================================================

export const DENIAL_REASON_CODES: Record<
  string,
  { code: string; description: string; category: string }
> = {
  "CO-4": {
    code: "CO-4",
    description:
      "The procedure code is inconsistent with the modifier used or a required modifier is missing",
    category: "Coding",
  },
  "CO-8": {
    code: "CO-8",
    description: "The procedure code is not payable at this location",
    category: "Coverage",
  },
  "CO-15": {
    code: "CO-15",
    description:
      "The authorization number is missing, invalid, or does not apply",
    category: "Documentation",
  },
  "CO-16": {
    code: "CO-16",
    description: "Claim/service lacks information needed for adjudication",
    category: "Documentation",
  },
  "CO-50": {
    code: "CO-50",
    description:
      "These are non-covered services because this is not deemed a medical necessity",
    category: "Medical Necessity",
  },
  "CO-96": {
    code: "CO-96",
    description: "Non-covered charge(s)",
    category: "Coverage",
  },
  "CO-97": {
    code: "CO-97",
    description:
      "The benefit for this service is included in the payment/allowance for another service",
    category: "Coding",
  },
  "CO-119": {
    code: "CO-119",
    description:
      "Benefit maximum for this time period or occurrence has been reached",
    category: "Coverage",
  },
  "CO-167": {
    code: "CO-167",
    description:
      "This (these) diagnosis(es) is (are) not covered, missing, or invalid",
    category: "Coding",
  },
  "PR-50": {
    code: "PR-50",
    description: "Non-covered services - not medically necessary (patient responsibility)",
    category: "Medical Necessity",
  },
  "PR-96": {
    code: "PR-96",
    description: "Non-covered charge(s) (patient responsibility)",
    category: "Coverage",
  },
  "PR-119": {
    code: "PR-119",
    description: "Benefit maximum reached (patient responsibility)",
    category: "Coverage",
  },
};

/**
 * Get denial reason details by code
 */
export function getDenialReasonByCode(
  code: string
): { code: string; description: string; category: string } | null {
  return DENIAL_REASON_CODES[code.toUpperCase()] || null;
}

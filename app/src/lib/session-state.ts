/**
 * Session state type and factory.
 *
 * Kept in a separate file (no server imports) so client components can import
 * SessionState and createDefaultSessionState without pulling in the server-only
 * Claude/Bedrock SDK into the browser bundle.
 */

export interface SessionState {
  // Onboarding (NEW - warm personal flow)
  userName: string | null;           // "John" - use in responses!
  userZip: string | null;            // "94305" - use for NPI searches!

  // Medicare type
  medicareType: "original" | "advantage" | "supplement" | null;
  maPlanName?: string;  // Medicare Advantage plan name (from Blue Button)

  // Symptoms
  symptoms: string[];
  duration: string | null;
  severity: string | null;
  priorTreatments: string[];

  // Procedure
  procedureNeeded: string | null;

  // Provider (NPI lookup flow)
  providerName: string | null;       // Doctor name before confirmation
  providerSearchAttempts: number;    // Track NPI search attempts (max 3)
  provider: {
    name: string | null;
    npi: string | null;
    specialty: string | null;
    acceptsMedicare: boolean | null; // Medicare network status
  } | null;

  // Internal codes - NEVER show to user
  diagnosisCodes: string[];
  procedureCodes: string[];

  // Coverage & guidance
  coverageCriteria: string[];
  policyReferences: string[];                  // LCD/NCD policy numbers (e.g., "L35936", "NCD 220.6")
  guidanceGenerated: boolean;
  isAppeal: boolean;
  denialDate: string | null;                   // Date of denial (for appeal deadline calculation)

  // Prior authorization
  priorAuthRequired: boolean | null;           // Whether procedure requires prior auth
  priorAuthSource: "lcd" | "cms_model" | "hardcoded_list" | null;

  // Requirement verification (denial prevention)
  requirementsToVerify: string[];              // List of requirements to ask about
  requirementAnswers: Record<string, boolean>; // User's answers to requirements
  verificationComplete: boolean;               // All requirements asked
  meetsAllRequirements: boolean | null;        // Final determination

  // Red flag symptoms (can expedite approval)
  redFlagsPresent: string[];                   // List of red flags user confirmed
  redFlagsChecked: boolean;                    // Whether red flags have been asked about

  // Prior imaging status
  priorImagingDone: boolean | null;            // Whether prior imaging (X-ray) was done
  priorImagingType: string | null;             // Type of prior imaging (e.g., "X-ray")
  priorImagingDate: string | null;             // When prior imaging was done

  // Specialty validation
  specialtyMismatchWarning: string | null;     // Warning if provider specialty doesn't match procedure

  // Denial codes (CARC/RARC from denial letters)
  denialCodes: string[];                       // CARC/RARC codes mentioned in conversation

  // User identity (set by client from auth context)
  email?: string | null;                       // For outcome followup checks
  userRole?: "patient" | "counselor" | "provider";  // Role from users table

  // Health data (populated from fhir_cache, never from live CMS API)
  healthDataAvailable?: boolean;
  activeCoverage?: string[];                   // e.g., ["Medicare Part A", "Medicare Part B"]
  recentDenials?: Array<{
    serviceDate: string;
    procedure: string;
    denialCode: string;
    denialReason: string;
  }>;
  labs?: Array<{                               // Diabetes-relevant lab results from FHIR Observations
    name: string;
    value: number;
    unit: string;
    date: string;
  }>;
  conditions?: Array<{                          // Diabetes-related diagnoses from FHIR Conditions
    code: string;
    name: string;
    category: string;
  }>;
  medications?: Array<{                         // Medications from FHIR MedicationRequests
    name: string;
    status: string;
    isDiabetesMed: boolean;
    isObesityMed: boolean;
    daysSupply?: number;
    isBrandName?: boolean;
    gapDays?: number;
  }>;
  diabetesClassification?: "diabetic" | "pre-diabetic" | "at-risk" | "none";
  obesityClassification?: "obese" | "at-risk" | "none";

  // Screenings (P0 — from CPT codes in Carrier/Outpatient claims)
  screenings?: Array<{
    screeningType: string;
    displayName: string;
    lastDate: string;
    monthsSinceLast: number;
    isOverdue: boolean;
  }>;

  // Providers (P2 — from care team in claims)
  providers?: Array<{
    name: string;
    specialty?: string;
    visitCount: number;
    lastSeen: string;
  }>;

  // Hospitalizations (P3 — from inpatient claims)
  hospitalizations?: Array<{
    admissionDate: string;
    dischargeDate: string;
    lengthOfStay: number;
    diagnoses: string[];
    provider: string;
    daysSinceDischarge: number;
    needsFollowUp: boolean;
  }>;

  // Recent claims (top 5 most recent for EOB review)
  recentClaims?: Array<{
    serviceDate: string;
    type: string;          // "Outpatient", "Carrier", "Part D", etc.
    provider: string;
    procedures: string[];  // Plain English procedure names
    diagnosis: string[];   // Plain English diagnosis names
    totalCharged: string;
    medicarePaid: string;
    youOwe: string;
    status: string;        // "Paid", "Denied", "Partially Paid"
    denialReasons?: string[];   // Plain English denial reasons (from EOB)
  }>;

  // Lab trends (longitudinal, from diabetes_snapshots)
  labTrends?: Array<{ date: string; value: number; loincCode: string }>;
  // Recent self-reported log summary
  recentLogSummary?: string;

  // Consent (set by client from useConsent hook)
  consentHealthDataAi?: boolean;               // Whether user consents to health data in AI
}

export function createDefaultSessionState(): SessionState {
  return {
    // Onboarding
    userName: null,
    userZip: null,

    // Medicare type
    medicareType: null,

    // Symptoms
    symptoms: [],
    duration: null,
    severity: null,
    priorTreatments: [],

    // Procedure
    procedureNeeded: null,

    // Provider
    providerName: null,
    providerSearchAttempts: 0,
    provider: null,

    // Internal codes
    diagnosisCodes: [],
    procedureCodes: [],

    // Coverage & guidance
    coverageCriteria: [],
    policyReferences: [],
    guidanceGenerated: false,
    isAppeal: false,
    denialDate: null,

    // Prior authorization
    priorAuthRequired: null,
    priorAuthSource: null,

    // Requirement verification
    requirementsToVerify: [],
    requirementAnswers: {},
    verificationComplete: false,
    meetsAllRequirements: null,

    // Red flag symptoms
    redFlagsPresent: [],
    redFlagsChecked: false,

    // Prior imaging status
    priorImagingDone: null,
    priorImagingType: null,
    priorImagingDate: null,

    // Specialty validation
    specialtyMismatchWarning: null,

    // Denial codes
    denialCodes: [],
  };
}

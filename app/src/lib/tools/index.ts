/**
 * Tool Definitions and Executors
 *
 * Defines the tools available to Claude for Medicare coverage assistance.
 * Each tool has a definition (schema) and an executor (implementation).
 */

import type { ToolDefinition, ToolResult, ToolExecutor } from "../claude";
import { MEDICARE_CONSTANTS } from "@/config";
import {
  searchCPT,
  searchICD10,
  getCPTCode,
  getICD10Code,
  getCPTsForCondition,
  getICD10sForCondition,
  getRelatedDiagnoses,
  getRelatedProcedures,
  isPreventiveCode,
  commonlyRequiresPriorAuth,
} from "../medicare-lookup";
import {
  checkSADList,
  getCoverageByRoute,
  explainCoverage,
  searchDrugs,
} from "../sad-list";
import {
  npiCache,
  pubmedCache,
} from "../cache";
import {
  createRateLimitedFetcher,
  CircuitOpenError,
  RateLimitError,
} from "../rate-limiter";
// Note: geo-utils is available if needed for location-based lookups
// import { getLocationInfo } from "../geo-utils";

// =============================================================================
// CMS COVERAGE - Now handled via Claude's MCP integration
// =============================================================================
//
// NOTE: CMS Coverage MCP (LCDs, NCDs) is now accessed DIRECTLY by Claude
// via the mcp_servers parameter in the beta API. See claude.ts MCP_SERVERS.
//
// Claude can use these MCP tools directly:
// - cms-coverage: search_lcds, search_ncds, get_coverage_requirements
// - npi-registry: search providers
// - icd10-codes: search diagnosis codes
//
// Our local tools below serve as fallbacks and for operations the MCP doesn't cover.

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // ICD-10 Search Tool
  {
    name: "search_icd10",
    description:
      "Search for ICD-10 diagnosis codes based on symptoms or conditions. Use this to map patient symptoms to diagnosis codes. NEVER show codes to users - use internally only.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The symptom or condition to search for (e.g., 'low back pain', 'dizziness', 'shortness of breath')",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 10)",
        },
      },
      required: ["query"],
    },
  },

  // CPT Search Tool
  {
    name: "search_cpt",
    description:
      "Search for CPT procedure codes based on procedure descriptions. Use this to map procedures to billing codes. NEVER show codes to users - use internally only.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "The procedure or service to search for (e.g., 'MRI lumbar', 'knee replacement', 'physical therapy')",
        },
        limit: {
          type: "number",
          description: "Maximum number of results to return (default: 10)",
        },
      },
      required: ["query"],
    },
  },

  // Get related diagnoses for a procedure
  {
    name: "get_related_diagnoses",
    description:
      "Get ICD-10 diagnosis codes commonly paired with a CPT procedure code. Useful for understanding what diagnoses support a procedure.",
    input_schema: {
      type: "object",
      properties: {
        cpt_code: {
          type: "string",
          description: "The CPT code to find related diagnoses for",
        },
      },
      required: ["cpt_code"],
    },
  },

  // Get related procedures for a diagnosis
  {
    name: "get_related_procedures",
    description:
      "Get CPT procedure codes commonly used for an ICD-10 diagnosis. Useful for understanding what procedures are typically ordered.",
    input_schema: {
      type: "object",
      properties: {
        icd10_code: {
          type: "string",
          description: "The ICD-10 code to find related procedures for",
        },
      },
      required: ["icd10_code"],
    },
  },

  // Check if code requires prior auth
  {
    name: "check_prior_auth",
    description:
      "Check if a CPT code commonly requires prior authorization from Medicare.",
    input_schema: {
      type: "object",
      properties: {
        cpt_code: {
          type: "string",
          description: "The CPT code to check",
        },
      },
      required: ["cpt_code"],
    },
  },

  // Check if code is preventive
  {
    name: "check_preventive",
    description:
      "Check if a CPT code is a preventive service (usually covered without cost-sharing under Medicare).",
    input_schema: {
      type: "object",
      properties: {
        cpt_code: {
          type: "string",
          description: "The CPT code to check",
        },
      },
      required: ["cpt_code"],
    },
  },

  // Get coverage requirements from NCD/LCD policies
  {
    name: "get_coverage_requirements",
    description:
      "Get Medicare coverage requirements for a specific procedure and diagnosis combination. Returns documentation requirements and coverage criteria from National Coverage Determinations (NCDs) and Local Coverage Determinations (LCDs).",
    input_schema: {
      type: "object",
      properties: {
        procedure: {
          type: "string",
          description:
            "The procedure description or CPT code (e.g., 'lumbar MRI', '72148')",
        },
        diagnosis: {
          type: "string",
          description:
            "The diagnosis description or ICD-10 code (e.g., 'low back pain', 'M54.5')",
        },
      },
      required: ["procedure"],
    },
  },

  // NOTE: search_ncd and search_lcd are now provided by Claude's MCP connection
  // See claude.ts MCP_SERVERS - the cms-coverage MCP provides these tools directly
  // Claude will automatically have access to real LCD/NCD data from CMS

  // NPI Registry lookup
  {
    name: "search_npi",
    description:
      "Search the NPI Registry to find healthcare providers. Two search modes: (1) By NAME: search_npi({ name: 'Dr. Smith', postal_code: '90035' }) to find specific doctor. (2) By SPECIALTY: search_npi({ specialty: 'Orthopedic Surgery', postal_code: '90035' }) to find nearby specialists. IMPORTANT: If name search returns no results, ALWAYS do a specialty search as fallback to give users actual doctor options. NEVER tell users to go to Medicare.gov - find doctors for them!",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Provider's name (first and/or last name). Use for finding a specific doctor.",
        },
        specialty: {
          type: "string",
          description: "Medical specialty to search for (e.g., 'Orthopedic Surgery', 'Pain Management', 'Neurology', 'Cardiology', 'Physical Medicine'). Use this when user wants to find doctors or when name search fails.",
        },
        postal_code: {
          type: "string",
          description: "5-digit ZIP code. ALWAYS include this - it's essential for finding nearby providers.",
        },
        state: {
          type: "string",
          description: "Two-letter state code (e.g., 'CA', 'NY'). Optional if postal_code provided.",
        },
        city: {
          type: "string",
          description: "City name. Optional.",
        },
        npi: {
          type: "string",
          description: "Specific NPI number to look up.",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 10, max: 20). Use 5 for specialty searches.",
        },
      },
      required: [],
    },
  },

  // PubMed search for clinical evidence
  {
    name: "search_pubmed",
    description:
      "Search PubMed for clinical evidence and medical literature. Use this to find studies supporting medical necessity for procedures.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query (e.g., 'MRI lumbar radiculopathy diagnosis')",
        },
        condition: {
          type: "string",
          description: "Medical condition being researched",
        },
        intervention: {
          type: "string",
          description: "Treatment or procedure being researched",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 5)",
        },
      },
      required: ["query"],
    },
  },

  // Generate appeal letter
  {
    name: "generate_appeal_letter",
    description:
      "Generate a Medicare appeal letter based on the denial reason, procedure, diagnosis, and supporting evidence. Returns a formatted letter ready for submission.",
    input_schema: {
      type: "object",
      properties: {
        denial_reason: {
          type: "string",
          description: "The reason given for the denial",
        },
        procedure_description: {
          type: "string",
          description: "Plain English description of the denied procedure",
        },
        diagnosis_description: {
          type: "string",
          description: "Plain English description of the diagnosis",
        },
        patient_history: {
          type: "string",
          description: "Relevant patient history and symptoms",
        },
        prior_treatments: {
          type: "array",
          items: { type: "string" },
          description: "List of prior treatments attempted",
        },
        provider_name: {
          type: "string",
          description: "Name of the ordering physician",
        },
        denial_date: {
          type: "string",
          description: "Date of the denial (YYYY-MM-DD format)",
        },
      },
      required: ["denial_reason", "procedure_description", "diagnosis_description"],
    },
  },

  // SAD List Check (Part B vs Part D)
  {
    name: "check_sad_list",
    description:
      "Check if a medication/drug is covered under Medicare Part B (physician-administered) or Part D (self-administered). Uses the Self-Administered Drug (SAD) exclusion list to determine coverage.",
    input_schema: {
      type: "object",
      properties: {
        drug_name: {
          type: "string",
          description: "Name of the drug or medication (generic or brand name)",
        },
        route: {
          type: "string",
          description: "Route of administration (e.g., 'oral', 'IV', 'subcutaneous', 'injection')",
        },
      },
      required: ["drug_name"],
    },
  },
];

// =============================================================================
// TOOL EXECUTORS
// =============================================================================

const searchICD10Executor: ToolExecutor = async (input) => {
  try {
    const query = input.query as string;
    const limit = (input.limit as number) || 10;

    console.log("[Tool:search_icd10] Searching for:", query, "limit:", limit);

    // First try condition-based lookup
    let results = getICD10sForCondition(query);

    // If no results, fall back to search
    if (results.length === 0) {
      results = searchICD10(query, limit);
    } else {
      results = results.slice(0, limit);
    }

    console.log("[Tool:search_icd10] Found", results.length, "codes:", results.map(r => r.code).join(", "));

    return {
      success: true,
      data: {
        codes: results.map((code) => ({
          code: code.code,
          description: code.description,
          category: code.category,
        })),
        count: results.length,
      },
    };
  } catch (error) {
    console.error("[Tool:search_icd10] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to search ICD-10 codes",
    };
  }
};

const searchCPTExecutor: ToolExecutor = async (input) => {
  try {
    const query = input.query as string;
    const limit = (input.limit as number) || 10;

    console.log("[Tool:search_cpt] Searching for:", query, "limit:", limit);

    // First try condition-based lookup
    let results = getCPTsForCondition(query);

    // If no results, fall back to search
    if (results.length === 0) {
      results = searchCPT(query, limit);
    } else {
      results = results.slice(0, limit);
    }

    console.log("[Tool:search_cpt] Found", results.length, "codes:", results.map(r => r.code).join(", "));

    return {
      success: true,
      data: {
        codes: results.map((code) => ({
          code: code.code,
          description: code.description,
          category: code.category,
          medicareNotes: code.medicareNotes,
        })),
        count: results.length,
      },
    };
  } catch (error) {
    console.error("[Tool:search_cpt] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to search CPT codes",
    };
  }
};

const getRelatedDiagnosesExecutor: ToolExecutor = async (input) => {
  try {
    const cptCode = input.cpt_code as string;
    const results = getRelatedDiagnoses(cptCode);

    return {
      success: true,
      data: {
        cpt_code: cptCode,
        related_diagnoses: results.map((code) => ({
          code: code.code,
          description: code.description,
        })),
        count: results.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get related diagnoses",
    };
  }
};

const getRelatedProceduresExecutor: ToolExecutor = async (input) => {
  try {
    const icd10Code = input.icd10_code as string;
    const results = getRelatedProcedures(icd10Code);

    return {
      success: true,
      data: {
        icd10_code: icd10Code,
        related_procedures: results.map((code) => ({
          code: code.code,
          description: code.description,
        })),
        count: results.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get related procedures",
    };
  }
};

const checkPriorAuthExecutor: ToolExecutor = async (input) => {
  try {
    const cptCode = input.cpt_code as string;
    const requiresAuth = commonlyRequiresPriorAuth(cptCode);
    const codeDetails = getCPTCode(cptCode);

    return {
      success: true,
      data: {
        cpt_code: cptCode,
        description: codeDetails?.description || "Unknown procedure",
        commonly_requires_prior_auth: requiresAuth,
        recommendation: requiresAuth
          ? "Prior authorization is commonly required. The provider should submit the request before the service."
          : "Prior authorization is typically not required, but coverage depends on medical necessity.",
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to check prior auth",
    };
  }
};

const checkPreventiveExecutor: ToolExecutor = async (input) => {
  try {
    const cptCode = input.cpt_code as string;
    const isPreventive = isPreventiveCode(cptCode);
    const codeDetails = getCPTCode(cptCode);

    return {
      success: true,
      data: {
        cpt_code: cptCode,
        description: codeDetails?.description || "Unknown service",
        is_preventive: isPreventive,
        cost_sharing: isPreventive
          ? "Covered with no cost-sharing (no deductible or coinsurance) when performed by a participating provider."
          : "Standard Medicare cost-sharing applies (deductible and 20% coinsurance).",
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to check preventive status",
    };
  }
};

// Coverage requirements - comprehensive patterns based on actual Medicare LCD/NCD criteria
const COVERAGE_REQUIREMENTS: Record<
  string,
  {
    requirements: string[];
    documentation: string[];
    duration?: string;
    priorTreatment?: string[];
    priorImaging?: string[];
    redFlags?: string[];
    ageConsiderations?: string[];
    contraindications?: string[];
  }
> = {
  // MRI Spine patterns (based on LCD L35036 and similar)
  mri_spine: {
    requirements: [
      "Symptom duration of 4-6 weeks (unless red flags present)",
      "Failed conservative treatment (PT, NSAIDs, activity modification)",
      "X-ray completed before MRI (unless red flags present)",
      "Neurological symptoms documented if present (radiculopathy, weakness, numbness)",
      "Functional limitation affecting daily activities",
      "Physical examination findings documented",
    ],
    documentation: [
      "Date of symptom onset and duration",
      "Specific conservative treatments tried with dates and outcomes",
      "X-ray results and date performed",
      "Neurological exam findings (motor strength, reflexes, sensation)",
      "Functional assessment (ADL limitations, work impact)",
      "Medical necessity statement explaining why MRI is needed now",
    ],
    duration: "4-6 weeks (immediate if red flags)",
    priorTreatment: [
      "Physical therapy (specify number of sessions)",
      "NSAIDs or anti-inflammatory medication (specify drug and duration)",
      "Activity modification or rest",
      "Home exercise program",
    ],
    priorImaging: [
      "X-ray of affected spine region",
    ],
    redFlags: [
      "History of cancer - may indicate metastatic disease",
      "Unexplained weight loss >10 lbs - cancer screening",
      "Bowel or bladder dysfunction - cauda equina syndrome (emergency)",
      "Progressive motor weakness - urgent neurological concern",
      "Fever with back pain - possible infection",
      "Recent significant trauma - fracture risk",
      "Age >50 with new onset pain - higher cancer risk",
      "IV drug use history - infection risk",
      "Immunocompromised status - infection risk",
      "Osteoporosis with new pain - compression fracture",
    ],
    ageConsiderations: [
      "Age >50: Cancer screening red flags more relevant",
      "Age >65: Fall risk and trauma history important",
    ],
    contraindications: [
      "Pacemaker or defibrillator (unless MRI-conditional)",
      "Cochlear implants",
      "Certain metallic implants",
      "Severe claustrophobia (may need open MRI or sedation)",
    ],
  },

  // Generic MRI patterns (for non-spine MRI)
  mri: {
    requirements: [
      "Symptom duration typically 4-6 weeks",
      "Failed conservative treatment (PT, medication)",
      "Prior imaging if applicable (X-ray before MRI)",
      "Neurological symptoms if present (numbness, weakness)",
      "Physical exam findings documented",
      "Clear medical necessity statement",
    ],
    documentation: [
      "Duration of symptoms with onset date",
      "Prior treatments attempted with specific dates and results",
      "Physical examination findings",
      "Prior imaging results if any",
      "Medical necessity statement",
    ],
    duration: "4-6 weeks",
    priorTreatment: [
      "Physical therapy",
      "Anti-inflammatory medication",
      "Activity modification",
    ],
    priorImaging: [
      "X-ray of affected area (recommended before MRI)",
    ],
    redFlags: [
      "History of cancer",
      "Progressive neurological symptoms",
      "Fever or signs of infection",
      "Recent trauma",
    ],
  },

  // CT patterns
  ct: {
    requirements: [
      "Clinical indication clearly documented",
      "Prior imaging reviewed if applicable",
      "Medical necessity established",
      "Explanation why CT preferred over other imaging",
    ],
    documentation: [
      "Reason for study and clinical question being answered",
      "Relevant symptoms and duration",
      "Prior imaging results if any",
      "Why CT is appropriate for this indication",
    ],
    redFlags: [
      "Acute trauma - CT often first-line",
      "Suspected fracture - CT provides bone detail",
      "Acute abdominal pain - CT often indicated",
    ],
  },

  // Joint replacement patterns (based on LCD L33632 and similar)
  joint_replacement: {
    requirements: [
      "Documented arthritis or significant joint damage on imaging",
      "Failed conservative treatment for 3-6 months minimum",
      "Significant functional limitation documented",
      "X-ray evidence of joint space narrowing or damage",
      "Pain despite medication management",
      "Quality of life significantly impacted",
    ],
    documentation: [
      "X-ray or MRI showing joint damage (with date)",
      "Duration and severity of symptoms",
      "Comprehensive list of conservative treatments tried with dates",
      "Functional assessment using standardized tools",
      "BMI documentation (obesity may affect surgical risk)",
      "Surgical clearance if comorbidities present",
    ],
    duration: "3-6 months of conservative treatment",
    priorTreatment: [
      "Physical therapy (minimum 4-6 weeks)",
      "Weight management if overweight",
      "NSAIDs or anti-inflammatory medication",
      "Cortisone injections (typically 1-3 attempts)",
      "Viscosupplementation (hyaluronic acid injections)",
      "Assistive devices (cane, brace)",
    ],
    priorImaging: [
      "Weight-bearing X-ray of affected joint",
      "MRI if soft tissue evaluation needed",
    ],
    ageConsiderations: [
      "Age <50: More scrutiny, longer conservative treatment expected",
      "Age 50-75: Standard criteria apply",
      "Age >75: Medical clearance and risk assessment important",
    ],
  },

  // Physical therapy patterns (based on Medicare therapy guidelines)
  physical_therapy: {
    requirements: [
      "Physician order or referral with diagnosis",
      "Therapy plan of care with specific goals",
      "Skilled therapy services required (not maintenance)",
      "Reasonable expectation of improvement",
      "Regular progress notes documenting improvement",
      "Recertification every 90 days if ongoing",
    ],
    documentation: [
      "Diagnosis requiring skilled therapy",
      "Baseline functional assessment",
      "Measurable treatment goals with timeframes",
      "Expected duration of treatment",
      "Progress measurements at each visit",
      "Discharge plan and criteria",
    ],
    duration: "Varies by condition, typically 4-12 weeks",
    ageConsiderations: [
      "Therapy cap exceptions available for medical necessity",
      "KX modifier required if exceeding therapy cap",
    ],
  },

  // DME patterns (based on Medicare DME guidelines)
  dme: {
    requirements: [
      "Face-to-face examination within required timeframe",
      "Medical necessity clearly documented",
      "Written order from treating physician",
      "Specific equipment prescribed with features needed",
      "Trial of lesser equipment if applicable",
    ],
    documentation: [
      "Diagnosis requiring equipment",
      "Specific functional limitations",
      "How equipment addresses the medical need",
      "Expected duration of need",
      "Training provided on equipment use",
      "Supplier certification if required",
    ],
    priorTreatment: [
      "Trial of less expensive alternatives if applicable",
    ],
  },

  // CPAP/BiPAP patterns (based on LCD L33718)
  cpap: {
    requirements: [
      "Sleep study (polysomnography) showing sleep apnea",
      "AHI ≥15 OR AHI 5-14 with symptoms or comorbidities",
      "Face-to-face evaluation with treating physician",
      "Initial 90-day trial period compliance",
    ],
    documentation: [
      "Sleep study results with AHI score",
      "Symptoms: excessive daytime sleepiness, snoring, witnessed apneas",
      "Comorbidities: hypertension, heart disease, stroke history",
      "Face-to-face evaluation note",
      "CPAP compliance data after 90 days (≥4 hours/night, 70% of nights)",
    ],
    duration: "Ongoing if compliance demonstrated at 90 days",
  },

  // Colonoscopy patterns
  colonoscopy: {
    requirements: [
      "Appropriate indication (screening, symptoms, surveillance)",
      "Screening: age 45+ for average risk",
      "Appropriate interval since last colonoscopy",
      "Bowel prep instructions provided",
    ],
    documentation: [
      "Indication for procedure",
      "Risk factors (family history, personal history)",
      "Date of last colonoscopy if applicable",
      "Findings and pathology results",
    ],
    ageConsiderations: [
      "Age 45-75: Routine screening recommended",
      "Age 76-85: Individual decision based on health status",
      "Age 85+: Screening generally not recommended",
    ],
  },

  // Default pattern
  default: {
    requirements: [
      "Medical necessity clearly documented",
      "Diagnosis supports the service requested",
      "Service is appropriate and reasonable for condition",
      "Less intensive options considered if applicable",
    ],
    documentation: [
      "Diagnosis with ICD-10 code",
      "Clinical indication and symptoms",
      "Expected benefit from service",
      "Why this service vs. alternatives",
    ],
  },
};

const getCoverageRequirementsExecutor: ToolExecutor = async (input) => {
  try {
    const procedure = (input.procedure as string).toLowerCase();
    const diagnosis = input.diagnosis as string | undefined;

    console.log("[Tool:get_coverage_requirements] Procedure:", procedure, "Diagnosis:", diagnosis);

    // Search for related codes using local database
    const cptResults = searchCPT(procedure, 3);
    const icd10Results = diagnosis ? searchICD10(diagnosis, 3) : [];

    console.log("[Tool:get_coverage_requirements] CPT results:", cptResults.length, "ICD-10 results:", icd10Results.length);

    // NOTE: Real LCD/NCD data now comes from Claude's direct MCP access
    // See claude.ts MCP_SERVERS - Claude can call cms-coverage MCP directly
    // This local tool provides fallback patterns based on common LCD requirements

    // Use local patterns based on common LCD requirements
    let pattern = "default";

    // More specific pattern matching
    if (procedure.includes("mri") || procedure.includes("magnetic resonance")) {
      // Check if it's spine-specific MRI
      if (
        procedure.includes("spine") ||
        procedure.includes("lumbar") ||
        procedure.includes("cervical") ||
        procedure.includes("thoracic") ||
        procedure.includes("back") ||
        procedure.includes("neck")
      ) {
        pattern = "mri_spine";
      } else {
        pattern = "mri";
      }
    } else if (procedure.includes("ct") || procedure.includes("computed tomography") || procedure.includes("cat scan")) {
      pattern = "ct";
    } else if (
      procedure.includes("replacement") ||
      procedure.includes("arthroplasty") ||
      procedure.includes("joint")
    ) {
      pattern = "joint_replacement";
    } else if (
      procedure.includes("physical therapy") ||
      procedure.includes("pt") ||
      procedure.includes("therapy")
    ) {
      pattern = "physical_therapy";
    } else if (procedure.includes("cpap") || procedure.includes("bipap") || procedure.includes("sleep apnea")) {
      pattern = "cpap";
    } else if (procedure.includes("colonoscopy") || procedure.includes("colon screening")) {
      pattern = "colonoscopy";
    } else if (
      procedure.includes("dme") ||
      procedure.includes("equipment") ||
      procedure.includes("wheelchair") ||
      procedure.includes("walker") ||
      procedure.includes("hospital bed")
    ) {
      pattern = "dme";
    }

    const requirements = COVERAGE_REQUIREMENTS[pattern];

    return {
      success: true,
      data: {
        procedure,
        diagnosis: diagnosis || "Not specified",
        source: "local_patterns",
        pattern,
        coverage_likely: true,
        requirements: requirements.requirements,
        documentation_needed: requirements.documentation,
        duration_requirement: requirements.duration || null,
        prior_treatments_typically_required: requirements.priorTreatment || [],
        prior_imaging_required: requirements.priorImaging || [],
        red_flag_symptoms: requirements.redFlags || [],
        age_considerations: requirements.ageConsiderations || [],
        contraindications: requirements.contraindications || [],
        related_cpt_codes: cptResults.map((c) => ({
          code: c.code,
          description: c.description,
        })),
        related_icd10_codes: icd10Results.map((c) => ({
          code: c.code,
          description: c.description,
        })),
        verification_questions: [
          "Has the patient had these symptoms for at least 4-6 weeks?",
          "Has the patient tried conservative treatments (PT, medication)?",
          requirements.priorImaging?.length ? "Has prior imaging (X-ray) been completed?" : null,
          "Are there any red flag symptoms (cancer history, bowel/bladder issues, progressive weakness)?",
          "Does the condition affect daily activities?",
          "Are there any neurological symptoms (numbness, tingling, weakness)?",
        ].filter(Boolean),
        note: "Coverage requirements based on Medicare LCD/NCD patterns. Red flag symptoms may expedite approval. Prior imaging is typically required before advanced imaging like MRI.",
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get coverage requirements",
    };
  }
};

// =============================================================================
// NCD/LCD SEARCH - Now handled by Claude's MCP connection
// =============================================================================
//
// NOTE: search_ncd and search_lcd are now provided directly by the
// cms-coverage MCP server. Claude calls these tools directly via MCP.
// See claude.ts MCP_SERVERS configuration.

// =============================================================================
// NPI REGISTRY EXECUTOR
// =============================================================================

// Rate-limited fetch for NPI Registry
const npiFetch = createRateLimitedFetcher("NPI");

const searchNPIExecutor: ToolExecutor = async (input) => {
  try {
    console.log("[Tool:search_npi] Input:", JSON.stringify(input));

    const params = new URLSearchParams();
    params.append("version", "2.1");

    // Build search parameters
    if (input.npi) {
      params.append("number", input.npi as string);
    }
    if (input.name) {
      const name = input.name as string;
      // Try to split into first/last name
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        params.append("first_name", parts[0]);
        params.append("last_name", parts.slice(1).join(" "));
      } else {
        params.append("last_name", name);
      }
    }
    if (input.state) {
      params.append("state", (input.state as string).toUpperCase());
    }
    if (input.city) {
      params.append("city", input.city as string);
    }
    // Add postal_code support for location-based searches
    if (input.postal_code) {
      params.append("postal_code", (input.postal_code as string).substring(0, 5));
      console.log("[Tool:search_npi] Using postal_code:", input.postal_code);
    }
    if (input.specialty) {
      params.append("taxonomy_description", input.specialty as string);
    }

    const limit = Math.min((input.limit as number) || 10, 20);
    params.append("limit", limit.toString());

    console.log("[Tool:search_npi] API URL params:", params.toString());

    // Check cache first
    const cacheKey = { type: "npi", params: params.toString() };
    const cached = npiCache.get(cacheKey);
    if (cached) {
      console.log("[Tool:search_npi] Cache hit");
      return cached as ToolResult;
    }

    console.log("[Tool:search_npi] Calling NPI Registry API...");
    const response = await npiFetch(
      `https://npiregistry.cms.hhs.gov/api/?${params.toString()}`
    );

    console.log("[Tool:search_npi] Response status:", response.status);

    if (!response.ok) {
      throw new Error(`NPI Registry API error: ${response.status}`);
    }

    const data = await response.json();
    console.log("[Tool:search_npi] Result count:", data.result_count);

    if (data.result_count === 0) {
      return {
        success: true,
        data: {
          providers: [],
          count: 0,
          message: "No providers found matching your criteria",
        },
      };
    }

    console.log("[Tool:search_npi] Processing", data.results.length, "providers");
    const providers = data.results.map((result: Record<string, unknown>) => {
      const basic = result.basic as Record<string, unknown> || {};
      const addresses = result.addresses as Array<Record<string, unknown>> || [];
      const taxonomies = result.taxonomies as Array<Record<string, unknown>> || [];
      const otherIdentifiers = result.other_provider_identifiers as Array<Record<string, unknown>> || [];
      const practiceAddress = addresses.find((a) => a.address_purpose === "LOCATION") || addresses[0] || {};
      const primaryTaxonomy = taxonomies.find((t) => t.primary === true) || taxonomies[0] || {};

      // Extract Medicare participation status from other_provider_identifiers
      // Medicare identifiers have issuer "CMS" and identifier type "MEDICARE"
      const medicareIdentifier = otherIdentifiers.find(
        (id) => {
          const issuer = (id.issuer as string || "").toUpperCase();
          const idType = (id.identifier_type as string || "").toUpperCase();
          const state = id.state as string || "";
          return issuer === "CMS" || idType.includes("MEDICARE") || state !== "";
        }
      );

      // Check if provider has Medicare PECOS enrollment indicator
      // Providers with Medicare identifiers are typically enrolled
      const hasMedicareId = medicareIdentifier !== undefined || otherIdentifiers.length > 0;

      return {
        npi: result.number,
        name: {
          first: basic.first_name || "",
          last: basic.last_name || "",
          credential: basic.credential || "",
          full: `${basic.first_name || ""} ${basic.last_name || ""}${basic.credential ? ", " + basic.credential : ""}`.trim(),
        },
        specialty: {
          primary: primaryTaxonomy.desc || "Not specified",
          code: primaryTaxonomy.code || "",
        },
        address: {
          line1: practiceAddress.address_1 || "",
          line2: practiceAddress.address_2 || "",
          city: practiceAddress.city || "",
          state: practiceAddress.state || "",
          zip: practiceAddress.postal_code || "",
        },
        phone: practiceAddress.telephone_number || "",
        enumeration_date: basic.enumeration_date || "",
        last_updated: basic.last_updated || "",
        // Medicare participation info
        medicare_participation: {
          has_medicare_identifiers: hasMedicareId,
          status: hasMedicareId ? "likely_enrolled" : "unknown",
          note: hasMedicareId
            ? "Provider appears to be enrolled in Medicare. Verify with provider's office."
            : "Medicare enrollment status unknown. Verify with provider's office.",
        },
      };
    });

    const result: ToolResult = {
      success: true,
      data: {
        providers,
        count: data.result_count,
        searched_postal_code: input.postal_code || null,
      },
    };

    // Cache the result
    npiCache.set(cacheKey, result);

    return result;
  } catch (error) {
    // Handle circuit breaker and rate limit errors
    if (error instanceof CircuitOpenError) {
      return {
        success: false,
        error: "NPI Registry service is temporarily unavailable. Please try again later.",
      };
    }
    if (error instanceof RateLimitError) {
      return {
        success: false,
        error: `Rate limit reached. Please wait ${Math.ceil(error.retryAfterMs / 1000)} seconds.`,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to search NPI registry",
    };
  }
};

// =============================================================================
// PUBMED SEARCH EXECUTOR
// =============================================================================

// Rate-limited fetch for PubMed (NCBI is strict: 3 requests/second)
const pubmedFetch = createRateLimitedFetcher("PUBMED");

const searchPubMedExecutor: ToolExecutor = async (input) => {
  try {
    const query = input.query as string;
    const condition = input.condition as string | undefined;
    const intervention = input.intervention as string | undefined;
    const limit = Math.min((input.limit as number) || 5, 10);

    // Build search term
    let searchTerm = query;
    if (condition && intervention) {
      searchTerm = `${condition} AND ${intervention}`;
    }

    // Add Medicare/coverage relevance terms
    searchTerm += " AND (Medicare OR coverage OR medical necessity OR clinical evidence)";

    // Check cache first
    const cacheKey = { type: "pubmed", searchTerm, limit };
    const cached = pubmedCache.get(cacheKey);
    if (cached) {
      return cached as ToolResult;
    }

    // Search PubMed using E-utilities
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchTerm)}&retmax=${limit}&retmode=json&sort=relevance`;

    const searchResponse = await pubmedFetch(searchUrl);
    if (!searchResponse.ok) {
      throw new Error(`PubMed search error: ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();
    const ids = searchData.esearchresult?.idlist || [];

    if (ids.length === 0) {
      const result: ToolResult = {
        success: true,
        data: {
          articles: [],
          count: 0,
          message: "No articles found matching your search",
        },
      };
      pubmedCache.set(cacheKey, result);
      return result;
    }

    // Fetch article details (also rate-limited)
    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&id=${ids.join(",")}&retmode=json`;

    const fetchResponse = await pubmedFetch(fetchUrl);
    if (!fetchResponse.ok) {
      throw new Error(`PubMed fetch error: ${fetchResponse.status}`);
    }

    const fetchData = await fetchResponse.json();
    const results = fetchData.result || {};

    const articles = ids.map((id: string) => {
      const article = results[id] || {};
      const authors = article.authors || [];

      return {
        pmid: id,
        title: article.title || "Untitled",
        authors: authors.slice(0, 3).map((a: { name: string }) => a.name),
        journal: article.source || "",
        year: article.pubdate?.split(" ")[0] || "",
        doi: article.elocationid || "",
        url: `https://pubmed.ncbi.nlm.nih.gov/${id}/`,
        citation: `${authors[0]?.name || "Unknown"} et al. ${article.title}. ${article.source}. ${article.pubdate?.split(" ")[0] || ""}.`,
      };
    });

    const result: ToolResult = {
      success: true,
      data: {
        articles,
        count: articles.length,
        search_term: searchTerm,
      },
    };

    // Cache the result
    pubmedCache.set(cacheKey, result);

    return result;
  } catch (error) {
    // Handle circuit breaker and rate limit errors
    if (error instanceof CircuitOpenError) {
      return {
        success: false,
        error: "PubMed service is temporarily unavailable. Please try again later.",
      };
    }
    if (error instanceof RateLimitError) {
      return {
        success: false,
        error: `Rate limit reached. Please wait ${Math.ceil(error.retryAfterMs / 1000)} seconds.`,
      };
    }
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to search PubMed",
    };
  }
};

// =============================================================================
// APPEAL LETTER GENERATOR
// =============================================================================

const generateAppealLetterExecutor: ToolExecutor = async (input) => {
  try {
    const denialReason = input.denial_reason as string;
    const procedureDescription = input.procedure_description as string;
    const diagnosisDescription = input.diagnosis_description as string;
    const patientHistory = (input.patient_history as string) || "";
    const priorTreatments = (input.prior_treatments as string[]) || [];
    const providerName = (input.provider_name as string) || "[Provider Name]";
    const denialDate = (input.denial_date as string) || new Date().toISOString().split("T")[0];

    // Calculate appeal deadline
    const denialDateObj = new Date(denialDate);
    const deadlineDate = new Date(denialDateObj);
    deadlineDate.setDate(deadlineDate.getDate() + MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS);
    const deadlineStr = deadlineDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    // Search for supporting codes
    const diagnosisCodes = searchICD10(diagnosisDescription, 3);
    const procedureCodes = searchCPT(procedureDescription, 3);

    // Get coverage requirements
    let coveragePattern = "default";
    const procLower = procedureDescription.toLowerCase();
    if (procLower.includes("mri")) coveragePattern = "mri";
    else if (procLower.includes("ct")) coveragePattern = "ct";
    else if (procLower.includes("replacement")) coveragePattern = "joint_replacement";
    else if (procLower.includes("therapy")) coveragePattern = "physical_therapy";

    const requirements = COVERAGE_REQUIREMENTS[coveragePattern] || COVERAGE_REQUIREMENTS.default;

    // Generate letter content
    const letter = `
MEDICARE APPEAL REQUEST
Level 1 Redetermination

Date: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}

To: Medicare Administrative Contractor
Re: Appeal of Denied Claim

Beneficiary Name: [PATIENT NAME]
Medicare Number: [MEDICARE NUMBER]
Date of Service: [DATE OF SERVICE]
Claim Number: [CLAIM NUMBER]

Dear Medicare Appeals Department,

I am writing to formally appeal the denial of coverage for ${procedureDescription} that was denied on ${new Date(denialDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}.

REASON FOR APPEAL:

The denial stated: "${denialReason}"

I respectfully disagree with this determination for the following reasons:

1. MEDICAL NECESSITY

The patient has been diagnosed with ${diagnosisDescription}. ${patientHistory ? `The patient's history includes: ${patientHistory}.` : ""}

${priorTreatments.length > 0 ? `Prior conservative treatments attempted include:
${priorTreatments.map((t) => `• ${t}`).join("\n")}

Despite these treatments, the patient's condition has not adequately improved, necessitating ${procedureDescription}.` : ""}

2. CLINICAL EVIDENCE

The requested ${procedureDescription} is supported by:
${requirements.requirements.map((r) => `• ${r}`).join("\n")}

3. MEDICARE COVERAGE CRITERIA

According to Medicare guidelines, this service is covered when medically necessary and properly documented. The documentation in the medical record supports coverage.

${diagnosisCodes.length > 0 ? `Relevant diagnosis codes:
${diagnosisCodes.map((c) => `• ${c.code} - ${c.description}`).join("\n")}` : ""}

${procedureCodes.length > 0 ? `Procedure codes:
${procedureCodes.map((c) => `• ${c.code} - ${c.description}`).join("\n")}` : ""}

REQUESTED ACTION:

I respectfully request that you reverse the denial and approve coverage for ${procedureDescription} as medically necessary for this patient's condition.

Enclosed please find:
□ Copy of the denial notice
□ Relevant medical records
□ Physician's order/referral
□ Supporting documentation

If you require additional information, please contact the ordering physician:
${providerName}

Sincerely,

[SIGNATURE]
[PATIENT NAME OR AUTHORIZED REPRESENTATIVE]
[PHONE NUMBER]
[ADDRESS]

---
IMPORTANT: This appeal must be submitted by ${deadlineStr} (${MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS} days from denial date).
`.trim();

    return {
      success: true,
      data: {
        letter,
        denial_date: denialDate,
        appeal_deadline: deadlineStr,
        diagnosis_codes: diagnosisCodes.map((c) => ({ code: c.code, description: c.description })),
        procedure_codes: procedureCodes.map((c) => ({ code: c.code, description: c.description })),
        requirements: requirements.requirements,
        instructions: [
          "Fill in the bracketed fields with patient information",
          "Attach a copy of the denial notice",
          "Include relevant medical records",
          "Have the patient or authorized representative sign",
          `Mail to the address on the denial notice by ${deadlineStr}`,
        ],
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to generate appeal letter",
    };
  }
};

// =============================================================================
// SAD LIST CHECK EXECUTOR
// =============================================================================

const checkSADListExecutor: ToolExecutor = async (input) => {
  try {
    const drugName = input.drug_name as string;
    const route = input.route as string | undefined;

    // Check the SAD list
    const sadResult = checkSADList(drugName);

    // If route is provided and drug wasn't found, use route-based determination
    let routeInfo = null;
    if (route) {
      routeInfo = getCoverageByRoute(route);
    }

    // Generate plain English explanation
    const explanation = explainCoverage(drugName);

    return {
      success: true,
      data: {
        drug_name: drugName,
        found_in_database: sadResult.found,
        part_b_covered: sadResult.partB,
        part_d_covered: sadResult.partD,
        route_of_administration: sadResult.route || route || "Not specified",
        reason: sadResult.reason,
        hcpcs_code: sadResult.hcpcsCode || null,
        brand_names: sadResult.brandNames || [],
        exception: sadResult.exception || null,
        route_based_determination: routeInfo,
        plain_english_explanation: explanation,
        guidance: sadResult.partB
          ? "This medication is typically covered under Medicare Part B when administered by a healthcare provider. Check with your doctor's office about coverage."
          : sadResult.partD
          ? "This medication is typically covered under Medicare Part D (your prescription drug plan). Check your plan's formulary for coverage details and costs."
          : "Coverage depends on how the medication is administered. Ask your doctor or pharmacist for guidance.",
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to check SAD list",
    };
  }
};

// =============================================================================
// TOOL EXECUTOR MAP
// =============================================================================

export function createToolExecutorMap(): Map<string, ToolExecutor> {
  const executors = new Map<string, ToolExecutor>();

  // Local tools with our own executors
  executors.set("search_icd10", searchICD10Executor);
  executors.set("search_cpt", searchCPTExecutor);
  executors.set("get_related_diagnoses", getRelatedDiagnosesExecutor);
  executors.set("get_related_procedures", getRelatedProceduresExecutor);
  executors.set("check_prior_auth", checkPriorAuthExecutor);
  executors.set("check_preventive", checkPreventiveExecutor);
  executors.set("get_coverage_requirements", getCoverageRequirementsExecutor);
  executors.set("search_npi", searchNPIExecutor);
  executors.set("search_pubmed", searchPubMedExecutor);
  executors.set("generate_appeal_letter", generateAppealLetterExecutor);
  executors.set("check_sad_list", checkSADListExecutor);

  // NOTE: search_ncd and search_lcd are now provided by MCP
  // Claude calls these directly via the cms-coverage MCP server

  return executors;
}

// Get all tool definitions
export function getToolDefinitions(): ToolDefinition[] {
  return TOOL_DEFINITIONS;
}

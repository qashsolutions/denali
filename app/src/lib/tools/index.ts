/**
 * Tool Definitions and Executors
 *
 * Defines the tools available to Claude for Medicare coverage assistance.
 * Each tool has a definition (schema) and an executor (implementation).
 */

import type { ToolDefinition, ToolResult, ToolExecutor } from "../claude";
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
  cacheManager,
  npiCache,
  pubmedCache,
  ncdCache,
  lcdCache,
} from "../cache";
import {
  withRetry,
  createRateLimitedFetcher,
  CircuitOpenError,
  RateLimitError,
} from "../rate-limiter";
import { API_CONFIG } from "@/config";

// =============================================================================
// CMS COVERAGE MCP CLIENT
// =============================================================================

const CMS_COVERAGE_MCP_URL = API_CONFIG.mcp.cmsCoverage;

interface MCPRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: "2.0";
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface NCDResult {
  ncd_id: string;
  title: string;
  effective_date: string;
  coverage_summary: string;
  indications: string[];
  limitations: string[];
  documentation_requirements: string[];
  url?: string;
}

interface LCDResult {
  lcd_id: string;
  title: string;
  contractor: string;
  effective_date: string;
  coverage_summary: string;
  covered_codes: string[];
  indications: string[];
  limitations: string[];
  documentation_requirements: string[];
  url?: string;
}

// Rate-limited fetch for CMS MCP
const cmsMcpFetch = createRateLimitedFetcher("CMS_MCP");

/**
 * Call the CMS Coverage MCP server with rate limiting and retry
 */
async function callCMSCoverageMCP(
  method: string,
  params: Record<string, unknown>
): Promise<MCPResponse> {
  const requestId = `req_${Date.now()}`;

  const request: MCPRequest = {
    jsonrpc: "2.0",
    id: requestId,
    method,
    params,
  };

  try {
    const response = await cmsMcpFetch(CMS_COVERAGE_MCP_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      throw new Error(`MCP server error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    // Handle circuit breaker and rate limit errors gracefully
    if (error instanceof CircuitOpenError || error instanceof RateLimitError) {
      console.warn(`CMS MCP temporarily unavailable: ${error.message}`);
    }

    // Return error in MCP format
    return {
      jsonrpc: "2.0",
      id: requestId,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : "Failed to call CMS Coverage MCP",
      },
    };
  }
}

/**
 * Search NCDs via MCP with caching
 */
async function searchNCDsViaMCP(
  query: string,
  cptCode?: string,
  limit: number = 5
): Promise<NCDResult[]> {
  // Check cache first
  const cacheKey = { type: "ncd", query, cptCode, limit };
  const cached = ncdCache.get(cacheKey);
  if (cached) {
    return cached as NCDResult[];
  }

  const response = await callCMSCoverageMCP("tools/call", {
    name: "search_ncds",
    arguments: {
      query,
      cpt_code: cptCode,
      limit,
    },
  });

  if (response.error) {
    console.error("NCD search error:", response.error);
    return [];
  }

  const result = response.result as { content?: Array<{ text?: string }> };
  if (result?.content?.[0]?.text) {
    try {
      const ncds = JSON.parse(result.content[0].text);
      // Cache the result
      ncdCache.set(cacheKey, ncds);
      return ncds;
    } catch {
      return [];
    }
  }

  return [];
}

/**
 * Search LCDs via MCP with caching
 */
async function searchLCDsViaMCP(
  query: string,
  cptCode?: string,
  state?: string,
  limit: number = 5
): Promise<LCDResult[]> {
  // Check cache first
  const cacheKey = { type: "lcd", query, cptCode, state, limit };
  const cached = lcdCache.get(cacheKey);
  if (cached) {
    return cached as LCDResult[];
  }

  const response = await callCMSCoverageMCP("tools/call", {
    name: "search_lcds",
    arguments: {
      query,
      cpt_code: cptCode,
      state,
      limit,
    },
  });

  if (response.error) {
    console.error("LCD search error:", response.error);
    return [];
  }

  const result = response.result as { content?: Array<{ text?: string }> };
  if (result?.content?.[0]?.text) {
    try {
      const lcds = JSON.parse(result.content[0].text);
      // Cache the result
      lcdCache.set(cacheKey, lcds);
      return lcds;
    } catch {
      return [];
    }
  }

  return [];
}

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

  // Search NCD policies
  {
    name: "search_ncd",
    description:
      "Search National Coverage Determinations (NCDs) for Medicare coverage policies. NCDs are nationwide coverage decisions made by CMS.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for NCD policies (e.g., 'MRI', 'knee replacement', 'CPAP')",
        },
        cpt_code: {
          type: "string",
          description: "Specific CPT code to find NCDs for",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 5)",
        },
      },
      required: ["query"],
    },
  },

  // Search LCD policies
  {
    name: "search_lcd",
    description:
      "Search Local Coverage Determinations (LCDs) for Medicare coverage policies. LCDs are regional coverage decisions made by Medicare Administrative Contractors (MACs).",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Search query for LCD policies (e.g., 'MRI spine', 'physical therapy')",
        },
        cpt_code: {
          type: "string",
          description: "Specific CPT code to find LCDs for",
        },
        state: {
          type: "string",
          description: "Two-letter state code to find regional LCDs (e.g., 'CA', 'NY')",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 5)",
        },
      },
      required: ["query"],
    },
  },

  // NPI Registry lookup
  {
    name: "search_npi",
    description:
      "Search the NPI Registry to find and validate healthcare providers. Use this to look up doctors, verify their specialties, and confirm they accept Medicare.",
    input_schema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "Provider's name (first and/or last name)",
        },
        state: {
          type: "string",
          description: "Two-letter state code (e.g., 'CA', 'NY')",
        },
        city: {
          type: "string",
          description: "City name",
        },
        specialty: {
          type: "string",
          description: "Medical specialty (e.g., 'Orthopedic Surgery', 'Family Medicine')",
        },
        npi: {
          type: "string",
          description: "Specific NPI number to look up",
        },
        limit: {
          type: "number",
          description: "Maximum results to return (default: 10, max: 20)",
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

    // First try condition-based lookup
    let results = getICD10sForCondition(query);

    // If no results, fall back to search
    if (results.length === 0) {
      results = searchICD10(query, limit);
    } else {
      results = results.slice(0, limit);
    }

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

    // First try condition-based lookup
    let results = getCPTsForCondition(query);

    // If no results, fall back to search
    if (results.length === 0) {
      results = searchCPT(query, limit);
    } else {
      results = results.slice(0, limit);
    }

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

// Coverage requirements - common patterns for Medicare
const COVERAGE_REQUIREMENTS: Record<
  string,
  {
    requirements: string[];
    documentation: string[];
    duration?: string;
    priorTreatment?: string[];
  }
> = {
  // MRI patterns
  mri: {
    requirements: [
      "Symptom duration typically 6+ weeks",
      "Failed conservative treatment (PT, medication)",
      "Neurological symptoms if present (numbness, weakness)",
      "Physical exam findings documented",
    ],
    documentation: [
      "Duration of symptoms",
      "Prior treatments attempted and results",
      "Physical examination findings",
      "Medical necessity statement",
    ],
    duration: "6+ weeks",
    priorTreatment: ["Physical therapy", "Anti-inflammatory medication", "Activity modification"],
  },

  // CT patterns
  ct: {
    requirements: [
      "Clinical indication documented",
      "Prior imaging reviewed if applicable",
      "Medical necessity established",
    ],
    documentation: [
      "Reason for study",
      "Relevant symptoms",
      "Prior imaging results if any",
    ],
  },

  // Joint replacement patterns
  joint_replacement: {
    requirements: [
      "Documented arthritis or joint damage",
      "Failed conservative treatment (3-6 months)",
      "Functional limitation documentation",
      "X-ray evidence of joint damage",
    ],
    documentation: [
      "Imaging showing joint damage",
      "Duration and severity of symptoms",
      "Conservative treatments tried",
      "Functional assessment",
    ],
    duration: "3-6 months conservative treatment",
    priorTreatment: [
      "Physical therapy",
      "Weight management",
      "Anti-inflammatory medication",
      "Cortisone injections",
    ],
  },

  // Physical therapy patterns
  physical_therapy: {
    requirements: [
      "Physician order/referral",
      "Therapy plan of care",
      "Functional goals documented",
      "Regular progress notes",
    ],
    documentation: [
      "Diagnosis requiring therapy",
      "Treatment goals",
      "Expected duration",
      "Progress measurements",
    ],
  },

  // DME patterns
  dme: {
    requirements: [
      "Medical necessity documentation",
      "Face-to-face examination",
      "Written order from physician",
    ],
    documentation: [
      "Diagnosis requiring equipment",
      "How equipment will be used",
      "Expected duration of need",
    ],
  },

  // Default pattern
  default: {
    requirements: [
      "Medical necessity documented",
      "Diagnosis supports the service",
      "Service is appropriate for condition",
    ],
    documentation: [
      "Diagnosis",
      "Clinical indication",
      "Expected benefit",
    ],
  },
};

const getCoverageRequirementsExecutor: ToolExecutor = async (input) => {
  try {
    const procedure = (input.procedure as string).toLowerCase();
    const diagnosis = input.diagnosis as string | undefined;

    // Search for related codes
    const cptResults = searchCPT(procedure, 3);
    const icd10Results = diagnosis ? searchICD10(diagnosis, 3) : [];

    // Get the primary CPT code for NCD/LCD lookup
    const primaryCPT = cptResults[0]?.code;

    // Search for NCDs and LCDs via MCP
    const [ncds, lcds] = await Promise.all([
      searchNCDsViaMCP(procedure, primaryCPT, 3),
      searchLCDsViaMCP(procedure, primaryCPT, undefined, 3),
    ]);

    // If we got real coverage data from MCP, use it
    if (ncds.length > 0 || lcds.length > 0) {
      // Aggregate documentation requirements from policies
      const allDocRequirements = new Set<string>();
      const allIndications = new Set<string>();
      const allLimitations = new Set<string>();

      ncds.forEach((ncd) => {
        ncd.documentation_requirements?.forEach((r) => allDocRequirements.add(r));
        ncd.indications?.forEach((i) => allIndications.add(i));
        ncd.limitations?.forEach((l) => allLimitations.add(l));
      });

      lcds.forEach((lcd) => {
        lcd.documentation_requirements?.forEach((r) => allDocRequirements.add(r));
        lcd.indications?.forEach((i) => allIndications.add(i));
        lcd.limitations?.forEach((l) => allLimitations.add(l));
      });

      return {
        success: true,
        data: {
          procedure,
          diagnosis: diagnosis || "Not specified",
          source: "cms_coverage_mcp",
          coverage_likely: true,
          ncds: ncds.map((ncd) => ({
            id: ncd.ncd_id,
            title: ncd.title,
            summary: ncd.coverage_summary,
            url: ncd.url,
          })),
          lcds: lcds.map((lcd) => ({
            id: lcd.lcd_id,
            title: lcd.title,
            contractor: lcd.contractor,
            summary: lcd.coverage_summary,
            url: lcd.url,
          })),
          documentation_requirements: Array.from(allDocRequirements),
          covered_indications: Array.from(allIndications),
          limitations: Array.from(allLimitations),
          related_cpt_codes: cptResults.map((c) => ({
            code: c.code,
            description: c.description,
          })),
          related_icd10_codes: icd10Results.map((c) => ({
            code: c.code,
            description: c.description,
          })),
          note: "Coverage based on National and Local Coverage Determinations. Requirements may vary by MAC region.",
        },
      };
    }

    // Fallback to local patterns if MCP didn't return results
    let pattern = "default";

    if (procedure.includes("mri") || procedure.includes("magnetic resonance")) {
      pattern = "mri";
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
    } else if (
      procedure.includes("dme") ||
      procedure.includes("equipment") ||
      procedure.includes("cpap") ||
      procedure.includes("wheelchair")
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
        duration_requirement: requirements.duration,
        prior_treatments_typically_required: requirements.priorTreatment,
        related_cpt_codes: cptResults.map((c) => ({
          code: c.code,
          description: c.description,
        })),
        related_icd10_codes: icd10Results.map((c) => ({
          code: c.code,
          description: c.description,
        })),
        note: "Coverage requirements based on general patterns. For authoritative coverage criteria, consult specific NCD/LCD policies.",
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
// NCD SEARCH EXECUTOR
// =============================================================================

const searchNCDExecutor: ToolExecutor = async (input) => {
  try {
    const query = input.query as string;
    const cptCode = input.cpt_code as string | undefined;
    const limit = (input.limit as number) || 5;

    const ncds = await searchNCDsViaMCP(query, cptCode, limit);

    if (ncds.length === 0) {
      return {
        success: true,
        data: {
          ncds: [],
          count: 0,
          message: "No National Coverage Determinations found for this query. Try searching for specific procedure names or CPT codes.",
        },
      };
    }

    return {
      success: true,
      data: {
        ncds: ncds.map((ncd) => ({
          id: ncd.ncd_id,
          title: ncd.title,
          effective_date: ncd.effective_date,
          coverage_summary: ncd.coverage_summary,
          indications: ncd.indications,
          limitations: ncd.limitations,
          documentation_requirements: ncd.documentation_requirements,
          url: ncd.url,
        })),
        count: ncds.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to search NCDs",
    };
  }
};

// =============================================================================
// LCD SEARCH EXECUTOR
// =============================================================================

const searchLCDExecutor: ToolExecutor = async (input) => {
  try {
    const query = input.query as string;
    const cptCode = input.cpt_code as string | undefined;
    const state = input.state as string | undefined;
    const limit = (input.limit as number) || 5;

    const lcds = await searchLCDsViaMCP(query, cptCode, state, limit);

    if (lcds.length === 0) {
      return {
        success: true,
        data: {
          lcds: [],
          count: 0,
          message: "No Local Coverage Determinations found for this query. LCDs vary by Medicare Administrative Contractor region.",
        },
      };
    }

    return {
      success: true,
      data: {
        lcds: lcds.map((lcd) => ({
          id: lcd.lcd_id,
          title: lcd.title,
          contractor: lcd.contractor,
          effective_date: lcd.effective_date,
          coverage_summary: lcd.coverage_summary,
          covered_codes: lcd.covered_codes,
          indications: lcd.indications,
          limitations: lcd.limitations,
          documentation_requirements: lcd.documentation_requirements,
          url: lcd.url,
        })),
        count: lcds.length,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to search LCDs",
    };
  }
};

// =============================================================================
// NPI REGISTRY EXECUTOR
// =============================================================================

// Rate-limited fetch for NPI Registry
const npiFetch = createRateLimitedFetcher("NPI");

const searchNPIExecutor: ToolExecutor = async (input) => {
  try {
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
    if (input.specialty) {
      params.append("taxonomy_description", input.specialty as string);
    }

    const limit = Math.min((input.limit as number) || 10, 20);
    params.append("limit", limit.toString());

    // Check cache first
    const cacheKey = { type: "npi", params: params.toString() };
    const cached = npiCache.get(cacheKey);
    if (cached) {
      return cached as ToolResult;
    }

    const response = await npiFetch(
      `https://npiregistry.cms.hhs.gov/api/?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error(`NPI Registry API error: ${response.status}`);
    }

    const data = await response.json();

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

    const providers = data.results.map((result: Record<string, unknown>) => {
      const basic = result.basic as Record<string, unknown> || {};
      const addresses = result.addresses as Array<Record<string, unknown>> || [];
      const taxonomies = result.taxonomies as Array<Record<string, unknown>> || [];
      const practiceAddress = addresses.find((a) => a.address_purpose === "LOCATION") || addresses[0] || {};
      const primaryTaxonomy = taxonomies.find((t) => t.primary === true) || taxonomies[0] || {};

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
      };
    });

    const result: ToolResult = {
      success: true,
      data: {
        providers,
        count: data.result_count,
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

    // Calculate appeal deadline (120 days from denial)
    const denialDateObj = new Date(denialDate);
    const deadlineDate = new Date(denialDateObj);
    deadlineDate.setDate(deadlineDate.getDate() + 120);
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
IMPORTANT: This appeal must be submitted by ${deadlineStr} (120 days from denial date).
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

  executors.set("search_icd10", searchICD10Executor);
  executors.set("search_cpt", searchCPTExecutor);
  executors.set("get_related_diagnoses", getRelatedDiagnosesExecutor);
  executors.set("get_related_procedures", getRelatedProceduresExecutor);
  executors.set("check_prior_auth", checkPriorAuthExecutor);
  executors.set("check_preventive", checkPreventiveExecutor);
  executors.set("get_coverage_requirements", getCoverageRequirementsExecutor);
  executors.set("search_ncd", searchNCDExecutor);
  executors.set("search_lcd", searchLCDExecutor);
  executors.set("search_npi", searchNPIExecutor);
  executors.set("search_pubmed", searchPubMedExecutor);
  executors.set("generate_appeal_letter", generateAppealLetterExecutor);
  executors.set("check_sad_list", checkSADListExecutor);

  return executors;
}

// Get all tool definitions
export function getToolDefinitions(): ToolDefinition[] {
  return TOOL_DEFINITIONS;
}

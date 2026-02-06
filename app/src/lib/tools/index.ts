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
  getCPTsForCondition,
  getRelatedDiagnoses,
  getRelatedProcedures,
  isPreventiveCode,
  commonlyRequiresPriorAuth,
} from "../medicare-lookup";
import {
  checkSADList,
  getCoverageByRoute,
  explainCoverage,
} from "../sad-list";
import { pubmedCache } from "../cache";
import {
  createRateLimitedFetcher,
  CircuitOpenError,
  RateLimitError,
} from "../rate-limiter";
import {
  getAppealStrategyForCARC,
  getDenialPatternsForCPT,
} from "../denial-patterns";
import { createClient } from "../supabase";

// =============================================================================
// MCP SERVERS PROVIDE CORE DATA (No local fallbacks)
// =============================================================================
//
// Claude accesses these MCP servers DIRECTLY via the beta API.
// See claude.ts MCP_SERVERS configuration.
//
// MCP servers (NO local fallbacks - if MCP fails, surface the error):
// - cms-coverage: LCDs, NCDs, get_coverage_requirements
// - npi-registry: search providers (replaces local search_npi)
// - icd10-codes: search diagnosis codes (replaces local search_icd10)
//
// Local tools below are for operations MCP doesn't cover (CPT, PubMed, etc.)

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // =============================================================================
  // NOTE: MCP Servers provide these tools directly (NO local fallbacks):
  // - icd10-codes MCP: diagnosis code lookup (replaces search_icd10)
  // - npi-registry MCP: provider validation (replaces search_npi)
  // - cms-coverage MCP: LCDs, NCDs, coverage requirements (replaces get_coverage_requirements)
  //
  // Claude calls MCP tools directly via the beta API. See claude.ts MCP_SERVERS.
  // =============================================================================

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

  // NOTE: get_coverage_requirements, search_npi, and search_icd10 are now
  // provided by MCP servers. Claude calls them directly via the beta API.
  // See claude.ts MCP_SERVERS configuration.

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
        policy_references: {
          type: "array",
          items: { type: "string" },
          description: "LCD/NCD policy numbers and text from coverage lookup (e.g., 'LCD L35936 - MRI of the Spine'). Include relevant coverage criteria text.",
        },
        pubmed_citations: {
          type: "array",
          items: { type: "string" },
          description: "PubMed citations supporting medical necessity (from search_pubmed results)",
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

  // Denial Code Lookup (CARC/RARC)
  {
    name: "lookup_denial_code",
    description:
      "Look up a Medicare denial reason code (CARC or RARC) to get its meaning in plain English, plus the appeal strategy if available. Use when a patient mentions a denial code from their EOB or denial letter. Can also search by description or EOB code.",
    input_schema: {
      type: "object",
      properties: {
        code: {
          type: "string",
          description: "CARC or RARC code (e.g., 'CO-50', '50', 'N362', 'M86')",
        },
        description_search: {
          type: "string",
          description: "Free-text search of denial code descriptions (e.g., 'medically necessary', 'documentation')",
        },
        eob_code: {
          type: "string",
          description: "EOB code from patient's Explanation of Benefits document",
        },
      },
    },
  },

  // Common Denials for a Procedure
  {
    name: "get_common_denials",
    description:
      "Get the most common denial reasons for a specific procedure. Use this proactively after coverage guidance to warn patients about common pitfalls and what to make sure their doctor documents.",
    input_schema: {
      type: "object",
      properties: {
        procedure_description: {
          type: "string",
          description: "Plain English procedure description (e.g., 'lumbar MRI', 'knee replacement', 'sleep study')",
        },
        cpt_code: {
          type: "string",
          description: "CPT code if known",
        },
      },
      required: ["procedure_description"],
    },
  },
];

// =============================================================================
// TOOL EXECUTORS
// =============================================================================
//
// NOTE: search_icd10, search_npi, and get_coverage_requirements executors removed.
// These are now provided by MCP servers that Claude accesses directly.
// See claude.ts MCP_SERVERS configuration.
// =============================================================================

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
        source: requiresAuth ? "CMS Prior Authorization Model / common list" : "common list (not found)",
        recommendation: requiresAuth
          ? "Prior authorization is commonly required. The provider should submit the request BEFORE scheduling the service."
          : "Prior authorization is typically not required, but the provider should confirm with the MAC. Coverage depends on medical necessity.",
        timeline: requiresAuth
          ? "Submit 10-14 business days before the service date."
          : null,
        action_for_patient: requiresAuth
          ? "Ask your doctor's office: 'Has the prior authorization been submitted for my procedure?'"
          : "No action needed — your doctor can schedule directly.",
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

// =============================================================================
// NOTE: Coverage requirements (get_coverage_requirements) removed.
// Now provided by cms-coverage MCP server. Claude accesses real LCD/NCD data
// directly via MCP. See claude.ts MCP_SERVERS configuration.
// =============================================================================

// =============================================================================
// NOTE: NPI Registry (search_npi) executor removed.
// Now provided by npi-registry MCP server. Claude accesses the NPI Registry
// directly via MCP. See claude.ts MCP_SERVERS configuration.
// =============================================================================

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

// Minimal coverage requirements for appeal letter generation
// (Full LCD/NCD data comes from MCP servers, this is just for letter formatting)
const COVERAGE_REQUIREMENTS: Record<string, { requirements: string[] }> = {
  mri: {
    requirements: [
      "Medical necessity clearly documented",
      "Symptom duration of 4-6 weeks documented",
      "Conservative treatment attempted and documented",
      "Physical examination findings documented",
    ],
  },
  ct: {
    requirements: [
      "Medical necessity clearly documented",
      "Clinical indication documented",
      "Prior imaging reviewed if applicable",
    ],
  },
  joint_replacement: {
    requirements: [
      "Failed conservative treatment documented",
      "Imaging showing joint damage",
      "Functional limitation documented",
    ],
  },
  physical_therapy: {
    requirements: [
      "Physician order with diagnosis",
      "Skilled therapy required",
      "Reasonable expectation of improvement",
    ],
  },
  default: {
    requirements: [
      "Medical necessity clearly documented",
      "Diagnosis supports the service requested",
      "Service is appropriate and reasonable for condition",
    ],
  },
};

const generateAppealLetterExecutor: ToolExecutor = async (input) => {
  try {
    const denialReason = input.denial_reason as string;
    const procedureDescription = input.procedure_description as string;
    const diagnosisDescription = input.diagnosis_description as string;
    const patientHistory = (input.patient_history as string) || "";
    const priorTreatments = (input.prior_treatments as string[]) || [];
    const providerName = (input.provider_name as string) || "[Provider Name]";
    const denialDate = (input.denial_date as string) || new Date().toISOString().split("T")[0];
    const policyReferences = (input.policy_references as string[]) || [];
    const pubmedCitations = (input.pubmed_citations as string[]) || [];

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

${policyReferences.length > 0 ? `According to the following Medicare coverage policies, this service is covered when medically necessary:
${policyReferences.map((ref) => `• ${ref}`).join("\n")}

The documentation in the medical record demonstrates that the patient meets the coverage criteria outlined in these policies.` : "According to Medicare guidelines, this service is covered when medically necessary and properly documented. The documentation in the medical record supports coverage."}

${diagnosisCodes.length > 0 ? `Relevant diagnosis codes:
${diagnosisCodes.map((c) => `• ${c.code} - ${c.description}`).join("\n")}` : ""}

${procedureCodes.length > 0 ? `Procedure codes:
${procedureCodes.map((c) => `• ${c.code} - ${c.description}`).join("\n")}` : ""}

${pubmedCitations.length > 0 ? `4. SUPPORTING CLINICAL EVIDENCE

The medical necessity of ${procedureDescription} for this patient's condition is further supported by peer-reviewed literature:
${pubmedCitations.map((cite) => `• ${cite}`).join("\n")}` : ""}

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
// DENIAL CODE LOOKUP EXECUTOR
// =============================================================================

const lookupDenialCodeExecutor: ToolExecutor = async (input) => {
  try {
    const code = input.code as string | undefined;
    const descriptionSearch = input.description_search as string | undefined;
    const eobCode = input.eob_code as string | undefined;

    if (!code && !descriptionSearch && !eobCode) {
      return {
        success: false,
        error: "Provide at least one of: code, description_search, or eob_code",
      };
    }

    const supabase = createClient();

    // If EOB code provided, look up via mapping table
    if (eobCode) {
      const { data: mappings, error } = await supabase
        .from("eob_denial_mappings_latest")
        .select("*")
        .eq("eob_code", eobCode.trim())
        .limit(5);

      if (error) {
        console.error("[Tool:lookup_denial_code] EOB lookup error:", error);
      }

      if (mappings && mappings.length > 0) {
        // Get CARC details for each mapping
        const results = [];
        for (const mapping of mappings) {
          const { data: carc } = await supabase
            .from("carc_codes_latest")
            .select("*")
            .eq("code", mapping.carc_code!)
            .single();

          let rarc = null;
          if (mapping.rarc_code) {
            const { data: rarcData } = await supabase
              .from("rarc_codes_latest")
              .select("*")
              .eq("code", mapping.rarc_code)
              .single();
            rarc = rarcData;
          }

          const appealStrategy = await getAppealStrategyForCARC(mapping.carc_code!);

          results.push({
            eob_code: mapping.eob_code,
            eob_description: mapping.eob_description,
            carc_code: mapping.carc_code,
            carc_description: carc?.description || "Unknown",
            carc_category: carc?.category || null,
            carc_plain_english: carc?.plain_english || null,
            rarc_code: mapping.rarc_code,
            rarc_description: rarc?.description || null,
            appeal_strategy: appealStrategy,
          });
        }

        return {
          success: true,
          data: { type: "eob_lookup", results, count: results.length },
        };
      }
    }

    // If code provided, look up directly
    if (code) {
      // Normalize code: strip prefix like "CO-", "PR-" for CARC lookup
      const normalized = code.replace(/^(CO|PR|OA|CR|PI)-?/i, "").trim();

      // Try CARC first
      const { data: carc } = await supabase
        .from("carc_codes_latest")
        .select("*")
        .eq("code", normalized)
        .single();

      if (carc) {
        const appealStrategy = await getAppealStrategyForCARC(normalized);
        return {
          success: true,
          data: {
            type: "CARC",
            code: carc.code,
            description: carc.description,
            category: carc.category,
            plain_english: carc.plain_english,
            appeal_strategy: appealStrategy,
          },
        };
      }

      // Try RARC
      const { data: rarc } = await supabase
        .from("rarc_codes_latest")
        .select("*")
        .eq("code", code.trim())
        .single();

      if (rarc) {
        return {
          success: true,
          data: {
            type: "RARC",
            code: rarc.code,
            description: rarc.description,
            category: rarc.category,
            plain_english: rarc.plain_english,
          },
        };
      }

      return {
        success: true,
        data: { type: "not_found", code, message: "Code not found in CARC or RARC database" },
      };
    }

    // Free-text search
    if (descriptionSearch) {
      const { data: results } = await supabase
        .rpc("search_denial_codes", { search_text: descriptionSearch });

      if (results && results.length > 0) {
        const enriched = await Promise.all(
          results.slice(0, 10).map(async (r: { code_type: string; code: string; description: string; category: string | null; plain_english: string | null }) => ({
            ...r,
            appeal_strategy: r.code_type === "CARC" ? await getAppealStrategyForCARC(r.code) : null,
          }))
        );

        return {
          success: true,
          data: { type: "search", results: enriched, count: enriched.length },
        };
      }

      return {
        success: true,
        data: { type: "search", results: [], count: 0, message: "No matching denial codes found" },
      };
    }

    return { success: false, error: "No valid search criteria provided" };
  } catch (error) {
    console.error("[Tool:lookup_denial_code] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to look up denial code",
    };
  }
};

// =============================================================================
// COMMON DENIALS EXECUTOR
// =============================================================================

const getCommonDenialsExecutor: ToolExecutor = async (input) => {
  try {
    const procedureDescription = input.procedure_description as string;
    const cptCode = input.cpt_code as string | undefined;

    // Search for CPT codes matching the procedure
    let cptCodes: string[] = [];
    if (cptCode) {
      cptCodes = [cptCode];
    } else {
      const searchResults = searchCPT(procedureDescription, 3);
      cptCodes = searchResults.map((r) => r.code);
    }

    // Get denial patterns for each CPT code
    const denialPatterns = new Map<string, { pattern: Awaited<ReturnType<typeof getDenialPatternsForCPT>>[0]; cptCodes: string[] }>();

    for (const code of cptCodes) {
      const patterns = await getDenialPatternsForCPT(code);
      for (const pattern of patterns) {
        const key = pattern.reason;
        if (denialPatterns.has(key)) {
          denialPatterns.get(key)!.cptCodes.push(code);
        } else {
          denialPatterns.set(key, { pattern, cptCodes: [code] });
        }
      }
    }

    // Enrich with CARC code descriptions from Supabase
    const supabase = createClient();
    const results = [];

    for (const [, { pattern }] of denialPatterns) {
      const carcCodes = (pattern.reasonCodes || [])
        .map((rc: string) => rc.replace(/^(CO|PR|OA)-?/i, "").trim());

      // Fetch CARC descriptions
      let carcDescriptions: { code: string; plain_english: string | null }[] = [];
      if (carcCodes.length > 0) {
        const { data } = await supabase
          .from("carc_codes_latest")
          .select("code, plain_english")
          .in("code", carcCodes);
        carcDescriptions = (data || []).map((d) => ({ code: d.code!, plain_english: d.plain_english }));
      }

      results.push({
        denial_reason: pattern.reason,
        carc_codes: pattern.reasonCodes || [],
        plain_english: carcDescriptions.find((c) => c.plain_english)?.plain_english || null,
        prevention_tip: pattern.documentationChecklist.slice(0, 3).join("; "),
        appeal_success_rate: pattern.estimatedSuccessRate || "unknown",
        appeal_deadline_days: pattern.appealDeadlineDays,
      });
    }

    // If no results from CPT matching, fetch top 3 general denial patterns from Supabase
    if (results.length === 0) {
      const { data: fallbackPatterns } = await supabase
        .from("denial_patterns_latest")
        .select("*")
        .in("category", ["Medical Necessity", "Documentation", "Coding"])
        .limit(3);

      if (fallbackPatterns && fallbackPatterns.length > 0) {
        // Deduplicate by category, taking the first from each
        const seen = new Set<string>();
        const generalDenials = fallbackPatterns
          .filter((p) => {
            if (seen.has(p.category!)) return false;
            seen.add(p.category!);
            return true;
          })
          .map((p) => ({
            denial_reason: p.reason,
            carc_codes: p.reason_codes || [],
            plain_english: null as string | null,
            prevention_tip: (p.documentation_checklist || []).slice(0, 3).join("; "),
            appeal_success_rate: p.estimated_success_rate || "unknown",
            appeal_deadline_days: p.appeal_deadline_days,
          }));

        // Enrich with CARC plain english
        for (const denial of generalDenials) {
          const firstCarc = (denial.carc_codes[0] || "").replace(/^(CO|PR|OA)-?/i, "").trim();
          if (firstCarc) {
            const { data: carcData } = await supabase
              .from("carc_codes_latest")
              .select("plain_english")
              .eq("code", firstCarc)
              .single();
            denial.plain_english = carcData?.plain_english || null;
          }
        }

        return {
          success: true,
          data: {
            procedure: procedureDescription,
            cpt_codes_checked: cptCodes,
            common_denials: generalDenials,
            count: generalDenials.length,
            note: "These are the most common denial reasons across Medicare claims.",
          },
        };
      }
    }

    return {
      success: true,
      data: {
        procedure: procedureDescription,
        cpt_codes_checked: cptCodes,
        common_denials: results,
        count: results.length,
      },
    };
  } catch (error) {
    console.error("[Tool:get_common_denials] Error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to get common denials",
    };
  }
};

// =============================================================================
// TOOL EXECUTOR MAP
// =============================================================================

export function createToolExecutorMap(): Map<string, ToolExecutor> {
  const executors = new Map<string, ToolExecutor>();

  // =============================================================================
  // Local tools with our own executors
  // NOTE: search_icd10, search_npi, get_coverage_requirements are now MCP-only
  // Claude accesses these via MCP servers. See claude.ts MCP_SERVERS.
  // =============================================================================
  executors.set("search_cpt", searchCPTExecutor);
  executors.set("get_related_diagnoses", getRelatedDiagnosesExecutor);
  executors.set("get_related_procedures", getRelatedProceduresExecutor);
  executors.set("check_prior_auth", checkPriorAuthExecutor);
  executors.set("check_preventive", checkPreventiveExecutor);
  executors.set("search_pubmed", searchPubMedExecutor);
  executors.set("generate_appeal_letter", generateAppealLetterExecutor);
  executors.set("check_sad_list", checkSADListExecutor);
  executors.set("lookup_denial_code", lookupDenialCodeExecutor);
  executors.set("get_common_denials", getCommonDenialsExecutor);

  return executors;
}

// Get all tool definitions
export function getToolDefinitions(): ToolDefinition[] {
  return TOOL_DEFINITIONS;
}

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
import { query } from "../db";

// Helper: latest-row filter (same pattern as the _latest views)
const latestFilter = (table: string) =>
  `effective_date = (SELECT MAX(effective_date) FROM ${table})`;

// All tools are local — ICD-10, CMS Coverage, and NPI call public APIs directly.
// (Replaced MCP server approach to support AWS Bedrock which doesn't support MCP.)

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  // =============================================================================
  // ICD-10 DIAGNOSIS CODE SEARCH (local, calls NLM Clinical Tables API)
  // =============================================================================
  {
    name: "search_icd10",
    description:
      "Search for ICD-10-CM diagnosis codes by description or symptoms. Use this to map patient symptoms and conditions to billing codes. NEVER show codes to users.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Description of the condition or symptom to search for (e.g., 'type 2 diabetes', 'low back pain')",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 10, max: 20)",
        },
      },
      required: ["query"],
    },
  },

  // =============================================================================
  // CMS COVERAGE TOOLS (local, calls CMS Coverage Database API)
  // =============================================================================
  {
    name: "search_local_coverage",
    description:
      "Search Medicare Local Coverage Determinations (LCDs) for coverage requirements and medical necessity criteria. Use this to find whether a specific procedure or service is covered in a patient's area.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The procedure, service, or condition to search coverage for (e.g., 'MRI lumbar spine', 'CPAP')",
        },
        contractor_id: {
          type: "string",
          description: "Medicare Administrative Contractor ID for geographic filtering (optional)",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "search_national_coverage",
    description:
      "Search Medicare National Coverage Determinations (NCDs) — policies that apply to all Medicare beneficiaries nationwide.",
    input_schema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The procedure, service, or condition to search coverage for",
        },
        limit: {
          type: "number",
          description: "Maximum number of results (default: 10)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "get_coverage_document",
    description:
      "Get the full text of a specific LCD or NCD coverage document by ID. Use the document ID from search results.",
    input_schema: {
      type: "object",
      properties: {
        document_id: {
          type: "string",
          description: "The LCD or NCD document ID (e.g., 'L33788' for LCD, or NCD tracking number)",
        },
        document_type: {
          type: "string",
          description: "Type of document: 'lcd' or 'ncd'",
          enum: ["lcd", "ncd"],
        },
      },
      required: ["document_id", "document_type"],
    },
  },

  // =============================================================================
  // NPI REGISTRY TOOLS (local, calls NPPES API)
  // =============================================================================
  {
    name: "npi_search",
    description:
      "Search the NPI Registry to find healthcare providers by name, specialty, and location. Use this to verify a provider is enrolled in Medicare.",
    input_schema: {
      type: "object",
      properties: {
        first_name: {
          type: "string",
          description: "Provider first name",
        },
        last_name: {
          type: "string",
          description: "Provider last name",
        },
        organization_name: {
          type: "string",
          description: "Organization or practice name (use instead of first/last for groups)",
        },
        city: {
          type: "string",
          description: "City where the provider practices",
        },
        state: {
          type: "string",
          description: "Two-letter state abbreviation",
        },
        taxonomy_description: {
          type: "string",
          description: "Provider specialty (e.g., 'Internal Medicine', 'Orthopedic Surgery')",
        },
        limit: {
          type: "number",
          description: "Maximum results (default: 10, max: 200)",
        },
      },
    },
  },
  {
    name: "npi_lookup",
    description:
      "Look up a specific provider by their 10-digit NPI number. Returns full credentials, address, and specialty.",
    input_schema: {
      type: "object",
      properties: {
        npi_number: {
          type: "string",
          description: "The 10-digit NPI number to look up",
        },
      },
      required: ["npi_number"],
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
        patient_name: {
          type: "string",
          description: "Patient's first name (from conversation)",
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
        medicare_type: {
          type: "string",
          description: "Medicare type: 'original' or 'advantage'. If advantage, letter addresses the plan.",
        },
        plan_name: {
          type: "string",
          description: "Medicare Advantage plan name (e.g., 'Humana Gold Plus'). Used when medicare_type is 'advantage'.",
        },
        appeal_level: {
          type: "number",
          description: "Medicare appeal level (1-5). Default: 1. Level 2: QIC/IRE reconsideration. Level 3: ALJ hearing. Level 4-5: informational only.",
        },
        prior_appeal_date: {
          type: "string",
          description: "Date of prior level's denial decision (for Level 2+ deadline calculation). YYYY-MM-DD format.",
        },
        amount_in_controversy: {
          type: "number",
          description: "Dollar amount at stake. Required for Level 3 (ALJ) and Level 5 (Federal Court) threshold check.",
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

// =============================================================================
// ICD-10 SEARCH — calls NLM Clinical Tables API (free, public)
// =============================================================================
const searchICD10Executor: ToolExecutor = async (input) => {
  try {
    const query = (input.query as string).trim();
    const limit = Math.min((input.limit as number) || 10, 20);
    console.log("[Tool:search_icd10] Searching:", query);

    const url = new URL("https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search");
    url.searchParams.set("terms", query);
    url.searchParams.set("maxList", String(limit));
    url.searchParams.set("sf", "code,name");
    url.searchParams.set("df", "code,name");

    const resp = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!resp.ok) throw new Error(`NLM API error: ${resp.status}`);
    const json = await resp.json() as [number, string[], null, string[][]];

    const [total, , , rows] = json;
    const codes = (rows || []).map(([code, name]) => ({ code, name }));
    return { success: true, data: { query, total, codes } };
  } catch (error) {
    console.error("[Tool:search_icd10] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "ICD-10 search failed" };
  }
};

// =============================================================================
// CMS COVERAGE TOOLS — calls CMS Coverage Database API (free, public)
// =============================================================================
const CMS_COVERAGE_API = "https://api.coverage-finder.medicare.gov/api/v1";

const searchLocalCoverageExecutor: ToolExecutor = async (input) => {
  try {
    const query = (input.query as string).trim();
    const limit = (input.limit as number) || 10;
    console.log("[Tool:search_local_coverage] Searching LCDs:", query);

    const url = new URL(`${CMS_COVERAGE_API}/lcd`);
    url.searchParams.set("keyword", query);
    url.searchParams.set("pageSize", String(limit));
    if (input.contractor_id) url.searchParams.set("contractorId", input.contractor_id as string);

    const resp = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!resp.ok) throw new Error(`CMS Coverage API error: ${resp.status}`);
    const json = await resp.json() as { totalCount?: number; items?: unknown[] };

    return {
      success: true,
      data: {
        query,
        total: json.totalCount ?? 0,
        documents: json.items ?? [],
        note: "LCD = Local Coverage Determination. These are regional Medicare coverage policies.",
      },
    };
  } catch (error) {
    console.error("[Tool:search_local_coverage] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "LCD search failed" };
  }
};

const searchNationalCoverageExecutor: ToolExecutor = async (input) => {
  try {
    const query = (input.query as string).trim();
    const limit = (input.limit as number) || 10;
    console.log("[Tool:search_national_coverage] Searching NCDs:", query);

    const url = new URL(`${CMS_COVERAGE_API}/ncd`);
    url.searchParams.set("keyword", query);
    url.searchParams.set("pageSize", String(limit));

    const resp = await fetch(url.toString(), { headers: { Accept: "application/json" } });
    if (!resp.ok) throw new Error(`CMS Coverage API error: ${resp.status}`);
    const json = await resp.json() as { totalCount?: number; items?: unknown[] };

    return {
      success: true,
      data: {
        query,
        total: json.totalCount ?? 0,
        documents: json.items ?? [],
        note: "NCD = National Coverage Determination. These apply to all Medicare beneficiaries.",
      },
    };
  } catch (error) {
    console.error("[Tool:search_national_coverage] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "NCD search failed" };
  }
};

const getCoverageDocumentExecutor: ToolExecutor = async (input) => {
  try {
    const documentId = (input.document_id as string).trim();
    const documentType = (input.document_type as string).toLowerCase();
    console.log("[Tool:get_coverage_document] Fetching:", documentType, documentId);

    const path = documentType === "lcd" ? "lcd" : "ncd";
    const url = `${CMS_COVERAGE_API}/${path}/${encodeURIComponent(documentId)}`;

    const resp = await fetch(url, { headers: { Accept: "application/json" } });
    if (!resp.ok) throw new Error(`CMS Coverage API error: ${resp.status} for ${documentId}`);
    const json = await resp.json();

    return { success: true, data: json };
  } catch (error) {
    console.error("[Tool:get_coverage_document] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Coverage document fetch failed" };
  }
};

// =============================================================================
// NPI REGISTRY TOOLS — calls NPPES API (free, public)
// =============================================================================
const NPPES_API = "https://npiregistry.cms.hhs.gov/api";

const npiSearchExecutor: ToolExecutor = async (input) => {
  try {
    console.log("[Tool:npi_search] Searching:", JSON.stringify(input));
    const params = new URLSearchParams({ version: "2.1" });
    if (input.first_name) params.set("first_name", input.first_name as string);
    if (input.last_name) params.set("last_name", input.last_name as string);
    if (input.organization_name) params.set("organization_name", input.organization_name as string);
    if (input.city) params.set("city", input.city as string);
    if (input.state) params.set("state", input.state as string);
    if (input.taxonomy_description) params.set("taxonomy_description", input.taxonomy_description as string);
    params.set("limit", String(Math.min((input.limit as number) || 10, 200)));

    const resp = await fetch(`${NPPES_API}/?${params}`, { headers: { Accept: "application/json" } });
    if (!resp.ok) throw new Error(`NPPES API error: ${resp.status}`);
    const json = await resp.json() as { result_count?: number; results?: unknown[] };

    return {
      success: true,
      data: {
        result_count: json.result_count ?? 0,
        providers: json.results ?? [],
        note: "NPI results show provider credentials, address, and Medicare enrollment status.",
      },
    };
  } catch (error) {
    console.error("[Tool:npi_search] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "NPI search failed" };
  }
};

const npiLookupExecutor: ToolExecutor = async (input) => {
  try {
    const npiNumber = (input.npi_number as string).trim();
    console.log("[Tool:npi_lookup] Looking up NPI:", npiNumber);

    const resp = await fetch(`${NPPES_API}/?version=2.1&number=${encodeURIComponent(npiNumber)}`, {
      headers: { Accept: "application/json" },
    });
    if (!resp.ok) throw new Error(`NPPES API error: ${resp.status}`);
    const json = await resp.json() as { result_count?: number; results?: unknown[] };

    if (!json.results || json.results.length === 0) {
      return { success: false, error: `No provider found for NPI ${npiNumber}` };
    }
    return { success: true, data: json.results[0] };
  } catch (error) {
    console.error("[Tool:npi_lookup] Error:", error);
    return { success: false, error: error instanceof Error ? error.message : "NPI lookup failed" };
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

    // Determine source detail for CMS PA Model vs general list
    const CMS_PA_MODEL_CODES = [
      "15820", "15821", "15822", "15823",  // Blepharoplasty
      "64615",                              // Botulinum toxin
      "22551", "22552", "22554",            // Cervical fusion
      "64490", "64491", "64492", "64493", "64494", "64495",  // Facet joint
      "27130", "27132", "27447",            // Hip/knee replacement
      "63650", "63685", "63688",            // Spinal neurostimulators
    ];
    const isCmsModel = CMS_PA_MODEL_CODES.includes(cptCode);
    const sourceDetail = requiresAuth
      ? (isCmsModel ? "CMS Prior Authorization Model" : "Common prior auth list")
      : "Not on prior auth lists";

    return {
      success: true,
      data: {
        cpt_code: cptCode,
        description: codeDetails?.description || "Unknown procedure",
        commonly_requires_prior_auth: requiresAuth,
        source: requiresAuth ? "CMS Prior Authorization Model / common list" : "common list (not found)",
        source_detail: sourceDetail,
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

    // Search PubMed using E-utilities (15s timeout per fetch to prevent long hangs)
    const fetchWithTimeout = (url: string) =>
      Promise.race([
        pubmedFetch(url),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("PubMed request timed out after 15s")), 15000)
        ),
      ]);

    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${encodeURIComponent(searchTerm)}&retmax=${limit}&retmode=json&sort=relevance`;

    const searchResponse = await fetchWithTimeout(searchUrl);
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

    const fetchResponse = await fetchWithTimeout(fetchUrl);
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
    // Pre-flight validation: denial_date and denial_reason are required for accurate letters
    if (!input.denial_date) {
      return {
        success: false,
        error: "denial_date is required. Ask the user: 'When did you receive the denial letter?' The date is on their Explanation of Benefits (EOB) or denial notice. This is needed to calculate the appeal deadline.",
      };
    }
    const denialReason = input.denial_reason as string;
    if (!denialReason || denialReason.trim().length < 5) {
      return {
        success: false,
        error: "denial_reason is required and must be descriptive. Ask the user: 'What reason did they give for the denial?' It's usually on the denial letter or EOB — something like 'not medically necessary' or 'missing documentation'.",
      };
    }

    const procedureDescription = input.procedure_description as string;
    const diagnosisDescription = input.diagnosis_description as string;
    const patientHistory = (input.patient_history as string) || "";
    const priorTreatments = (input.prior_treatments as string[]) || [];
    const patientName = (input.patient_name as string) || "";
    const providerName = (input.provider_name as string) || "[Provider Name]";
    const denialDate = input.denial_date as string;
    const policyReferences = (input.policy_references as string[]) || [];
    const pubmedCitations = (input.pubmed_citations as string[]) || [];
    const medicareType = (input.medicare_type as string) || "original";
    const planName = (input.plan_name as string) || "";
    const isMA = medicareType === "advantage";
    const appealLevel = (input.appeal_level as number) || 1;
    const priorAppealDate = (input.prior_appeal_date as string) || "";
    const amountInControversy = input.amount_in_controversy as number | undefined;

    // --- Level 4-5: Informational only (no letter) ---
    if (appealLevel === 4) {
      return {
        success: true,
        data: {
          letter: null,
          informational: true,
          appeal_level: 4,
          level_name: "Medicare Appeals Council Review",
          guidance: "Filed with the Departmental Appeals Board (DAB) within HHS. This is a paper review — no hearing. The Council can review, reverse, or remand the ALJ decision. Legal representation is strongly recommended at this level.",
          deadline_days: 60,
          next_steps: [
            "Gather the ALJ decision letter and all prior denial notices",
            "Write a brief statement explaining why the ALJ decision was wrong",
            "Contact your State Health Insurance Assistance Program (SHIP) for free help: 1-877-839-2675",
            "Consider consulting a Medicare rights attorney",
            "File within 60 days of the ALJ decision",
          ],
        },
      };
    }
    if (appealLevel === 5) {
      const t = MEDICARE_CONSTANTS.getCurrentThresholds();
      return {
        success: true,
        data: {
          letter: null,
          informational: true,
          appeal_level: 5,
          level_name: "Federal District Court Review",
          guidance: `This is a lawsuit filed in Federal District Court. The ${t.year} amount-in-controversy threshold is $${t.FEDERAL_COURT_THRESHOLD.toLocaleString()}. You have 60 days from the Appeals Council decision to file. An attorney is required.`,
          deadline_days: 60,
          threshold: t.FEDERAL_COURT_THRESHOLD,
          threshold_year: t.year,
          next_steps: [
            `Verify the amount in controversy exceeds $${t.FEDERAL_COURT_THRESHOLD.toLocaleString()} (${t.year} threshold)`,
            "Consult a healthcare or Medicare appeals attorney",
            "Contact SHIP for referrals: 1-877-839-2675",
            "File within 60 days of the Appeals Council decision",
          ],
        },
      };
    }

    // --- Level 3: Amount-in-controversy gate ---
    if (appealLevel >= 3) {
      const thresholds = MEDICARE_CONSTANTS.getCurrentThresholds();
      const required = thresholds.ALJ_THRESHOLD;
      if (!amountInControversy) {
        return {
          success: false,
          error: `Amount in controversy is required for Level ${appealLevel} appeals. Ask the user: "What is the total dollar amount of the denied service(s)?" The ${thresholds.year} ALJ hearing threshold is $${required}.`,
        };
      }
      if (amountInControversy < required) {
        // Warn but don't block — user may combine claims to meet threshold
        console.warn(`[generate_appeal_letter] Amount $${amountInControversy} below ALJ threshold $${required}. Proceeding with warning.`);
      }
    }

    // --- Calculate deadline based on level ---
    // Level 1: denial_date + 120/60 days (FFS/MA)
    // Level 2: prior_appeal_date + 180 days
    // Level 3: prior_appeal_date + 60 days
    const deadlineDays = appealLevel === 1
      ? MEDICARE_CONSTANTS.getAppealDeadlineDays(medicareType)
      : appealLevel === 2 ? 180 : 60;
    const baseDate = appealLevel === 1 ? denialDate : (priorAppealDate || denialDate);

    const baseDateObj = new Date(baseDate);
    const deadlineDate = new Date(baseDateObj);
    deadlineDate.setDate(deadlineDate.getDate() + deadlineDays);
    const deadlineStr = deadlineDate.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadlineDate.setHours(0, 0, 0, 0);
    const daysRemaining = Math.ceil((deadlineDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const deadlineExpired = daysRemaining < 0;

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

    // --- Generate letter based on level ---
    const beneficiaryLine = patientName
      ? `Beneficiary Name: ${patientName} _______________`
      : "Beneficiary Name: _______________";

    const todayStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
    const denialDateFormatted = new Date(denialDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    let letter: string;

    if (appealLevel === 2) {
      // --- Level 2: QIC/IRE Reconsideration ---
      const letterTitle = isMA ? "Request for Independent Review" : "Request for Reconsideration";
      const addressee = isMA
        ? "Independent Review Entity (IRE)"
        : "Qualified Independent Contractor (QIC)";
      const legalCitation = isMA ? "42 CFR §422.590" : "42 CFR §405.960";
      const priorAppealDateFormatted = priorAppealDate
        ? new Date(priorAppealDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : "[Date of Level 1 Decision]";

      letter = `IMPORTANT: This is a DRAFT letter generated by AI. It is NOT legal advice.
Review all details carefully before submitting. Verify dates, codes, and
facts with your healthcare provider. Fill in all blank fields before mailing.
─────────────────────────────────────────────────────────────────────────

MEDICARE APPEAL REQUEST
${letterTitle}
(Level 2 — ${legalCitation})

Date: ${todayStr}

To: ${addressee}
Re: Request for Reconsideration of Level 1 Denial

${beneficiaryLine}
Medicare Number: _______________
Date of Service: _______________
Claim Number: _______________
Level 1 Decision Date: ${priorAppealDateFormatted}

Dear ${addressee},

I am writing to request reconsideration of the Level 1 ${isMA ? "Organization Determination" : "Redetermination"} decision dated ${priorAppealDateFormatted}, which upheld the denial of coverage for ${procedureDescription}.

The original denial on ${denialDateFormatted} stated: "${denialReason}"

The Level 1 review did not adequately consider the following:

1. MEDICAL NECESSITY

The patient has been diagnosed with ${diagnosisDescription}. ${patientHistory ? `The patient's history includes: ${patientHistory}.` : ""}

${priorTreatments.length > 0 ? `Prior conservative treatments attempted include:
${priorTreatments.map((t) => `• ${t}`).join("\n")}

Despite these treatments, the patient's condition has not adequately improved, necessitating ${procedureDescription}.` : ""}
${isMA ? `
Under federal law (42 CFR §422.101), Medicare Advantage plans must cover all services that Original Medicare covers when medically necessary.
` : ""}
2. ADDITIONAL EVIDENCE

${pubmedCitations.length > 0 ? `The following peer-reviewed evidence supports the medical necessity of this service:
${pubmedCitations.map((cite) => `• ${cite}`).join("\n")}` : "I am submitting additional clinical evidence and documentation that was not fully considered in the Level 1 review."}

3. COVERAGE CRITERIA

${policyReferences.length > 0 ? `The following Medicare coverage policies support coverage:
${policyReferences.map((ref) => `• ${ref}`).join("\n")}` : "Medicare coverage guidelines support this service when medically necessary."}

${diagnosisCodes.length > 0 ? `Diagnosis codes: ${diagnosisCodes.map((c) => `${c.code} (${c.description})`).join(", ")}` : ""}
${procedureCodes.length > 0 ? `Procedure codes: ${procedureCodes.map((c) => `${c.code} (${c.description})`).join(", ")}` : ""}

REQUESTED ACTION:

I respectfully request that you reverse the Level 1 decision and approve coverage for ${procedureDescription}.

Enclosed please find:
□ Copy of the Level 1 denial decision
□ Copy of the original denial notice
□ Relevant medical records
□ Additional supporting documentation
□ Physician's letter of medical necessity

If you require additional information, please contact the ordering physician:
${providerName}

Sincerely,

_______________
${patientName || "_______________"}`.trim();

    } else if (appealLevel === 3) {
      // --- Level 3: ALJ Hearing ---
      const thresholds = MEDICARE_CONSTANTS.getCurrentThresholds();
      const addressee = "Office of Medicare Hearings and Appeals (OMHA)";
      const legalCitation = isMA ? "42 CFR §422.600" : "42 CFR §405.1000";

      const priorAppealDateFormatted = priorAppealDate
        ? new Date(priorAppealDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })
        : "[Date of Level 2 Decision]";

      const amountWarning = amountInControversy && amountInControversy < thresholds.ALJ_THRESHOLD
        ? `\nNOTE: The amount in controversy ($${amountInControversy.toLocaleString()}) is below the ${thresholds.year} threshold of $${thresholds.ALJ_THRESHOLD}. You may need to combine claims or aggregate amounts to meet the threshold.\n`
        : "";

      letter = `IMPORTANT: This is a DRAFT letter generated by AI. It is NOT legal advice.
Review all details carefully before submitting. Verify dates, codes, and
facts with your healthcare provider. Fill in all blank fields before mailing.
─────────────────────────────────────────────────────────────────────────
${amountWarning}
MEDICARE APPEAL REQUEST
Request for Administrative Law Judge (ALJ) Hearing
(Level 3 — ${legalCitation})

Date: ${todayStr}

To: ${addressee}
Re: Request for ALJ Hearing — Denied Claim

${beneficiaryLine}
Medicare Number: _______________
Date of Service: _______________
Claim Number: _______________
Level 2 Decision Date: ${priorAppealDateFormatted}
Amount in Controversy: $${amountInControversy ? amountInControversy.toLocaleString() : "_______________"} (${thresholds.year} threshold: $${thresholds.ALJ_THRESHOLD})

Hearing Preference: □ In-person  □ Telephone  □ Video

Dear Administrative Law Judge,

I am writing to request a hearing before an Administrative Law Judge regarding the denial of coverage for ${procedureDescription}, which was upheld at both Level 1 and Level 2 of the Medicare appeals process.

Original denial date: ${denialDateFormatted}
Denial reason: "${denialReason}"
Level 2 (${isMA ? "IRE" : "QIC"}) decision date: ${priorAppealDateFormatted}

STATEMENT OF THE CASE:

1. MEDICAL NECESSITY

The patient has been diagnosed with ${diagnosisDescription}. ${patientHistory ? `Patient history: ${patientHistory}.` : ""}

${priorTreatments.length > 0 ? `Conservative treatments attempted:
${priorTreatments.map((t) => `• ${t}`).join("\n")}

These treatments were insufficient, making ${procedureDescription} medically necessary.` : ""}

2. ERRORS IN PRIOR DECISIONS

The Level 1 and Level 2 reviews failed to adequately consider the clinical evidence supporting medical necessity for this service.

3. SUPPORTING EVIDENCE

${policyReferences.length > 0 ? `Medicare coverage policies supporting this service:
${policyReferences.map((ref) => `• ${ref}`).join("\n")}` : ""}

${pubmedCitations.length > 0 ? `Peer-reviewed clinical evidence:
${pubmedCitations.map((cite) => `• ${cite}`).join("\n")}` : ""}

${diagnosisCodes.length > 0 ? `Diagnosis codes: ${diagnosisCodes.map((c) => `${c.code} (${c.description})`).join(", ")}` : ""}
${procedureCodes.length > 0 ? `Procedure codes: ${procedureCodes.map((c) => `${c.code} (${c.description})`).join(", ")}` : ""}

REQUESTED RELIEF:

I respectfully request that the ALJ reverse the prior denials and approve coverage for ${procedureDescription}.

Enclosed please find:
□ Copy of the Level 1 denial decision
□ Copy of the Level 2 (${isMA ? "IRE" : "QIC"}) denial decision
□ Original denial notice
□ Relevant medical records
□ Physician's letter of medical necessity
□ Supporting clinical evidence

If you require additional information, please contact the ordering physician:
${providerName}

Sincerely,

_______________
${patientName || "_______________"}`.trim();

    } else {
      // --- Level 1: Original letter (Redetermination / Organization Determination) ---
      const letterTitle = isMA ? "Organization Determination Appeal" : "Level 1 Redetermination";
      const addressee = isMA
        ? `${planName || "Medicare Advantage Plan"} Appeals Department`
        : "Medicare Administrative Contractor";

      letter = `IMPORTANT: This is a DRAFT letter generated by AI. It is NOT legal advice.
Review all details carefully before submitting. Verify dates, codes, and
facts with your healthcare provider. Fill in all blank fields before mailing.
─────────────────────────────────────────────────────────────────────────

MEDICARE APPEAL REQUEST
${letterTitle}

Date: ${todayStr}

To: ${addressee}
Re: Appeal of Denied Claim

${beneficiaryLine}
Medicare Number: _______________
Date of Service: _______________
Claim Number: _______________

Dear ${addressee},

I am writing to formally appeal the denial of coverage for ${procedureDescription} that was denied on ${denialDateFormatted}.

REASON FOR APPEAL:

The denial stated: "${denialReason}"

I respectfully disagree with this determination for the following reasons:

1. MEDICAL NECESSITY

The patient has been diagnosed with ${diagnosisDescription}. ${patientHistory ? `The patient's history includes: ${patientHistory}.` : ""}

${priorTreatments.length > 0 ? `Prior conservative treatments attempted include:
${priorTreatments.map((t) => `• ${t}`).join("\n")}

Despite these treatments, the patient's condition has not adequately improved, necessitating ${procedureDescription}.` : ""}
${isMA ? `
Under federal law (42 CFR §422.101), Medicare Advantage plans must cover all services that Original Medicare covers when medically necessary. This plan is obligated to provide coverage for medically necessary services.
` : ""}
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

_______________
${patientName || "_______________"}`.trim();
    }

    // Build level-specific instructions
    const levelInstructions = [
      `Write in your ${patientName ? "last name, " : ""}Medicare number, claim number, and date of service on the blank lines`,
      "Sign and date the letter",
      "Add your phone number and mailing address below your signature",
    ];

    if (appealLevel === 1) {
      levelInstructions.push(
        "Attach a copy of the denial notice",
        "Include relevant medical records and physician's notes",
        isMA
          ? `Mail to the appeals address on your denial notice or the back of your ${planName || "plan"} card`
          : `Mail to the address on your denial notice by ${deadlineStr}`,
      );
    } else if (appealLevel === 2) {
      levelInstructions.push(
        "Attach a copy of the Level 1 denial decision",
        "Attach the original denial notice",
        "Include any new medical records or evidence",
        isMA
          ? "The IRE address will be on your Level 1 decision letter"
          : `Mail to the QIC address on your Level 1 decision by ${deadlineStr}`,
      );
    } else if (appealLevel === 3) {
      levelInstructions.push(
        "Attach copies of BOTH the Level 1 and Level 2 denial decisions",
        "Include the original denial notice",
        "Include all supporting medical records",
        "Choose your hearing preference (in-person, telephone, or video)",
        `Mail to OMHA by ${deadlineStr}`,
        "Consider getting help from a SHIP counselor (free): 1-877-839-2675",
      );
    }

    return {
      success: true,
      data: {
        letter,
        appeal_level: appealLevel,
        denial_date: denialDate,
        appeal_deadline: deadlineStr,
        days_remaining: daysRemaining,
        deadline_expired: deadlineExpired,
        deadline_warning: deadlineExpired
          ? `WARNING: The ${deadlineDays}-day appeal deadline passed ${Math.abs(daysRemaining)} days ago. The beneficiary may still file with "good cause" for late filing, but success is less likely. Inform the user clearly.`
          : daysRemaining <= 14
            ? `URGENT: Only ${daysRemaining} days remaining to file this appeal. The user must act immediately.`
            : null,
        diagnosis_codes: diagnosisCodes.map((c) => ({ code: c.code, description: c.description })),
        procedure_codes: procedureCodes.map((c) => ({ code: c.code, description: c.description })),
        requirements: requirements.requirements,
        instructions: levelInstructions,
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

    // If EOB code provided, look up via mapping table
    if (eobCode) {
      type EobRow = { eob_code: string; eob_description: string | null; carc_code: string | null; rarc_code: string | null };
      type CarcRow = { code: string; description: string | null; category: string | null; plain_english: string | null };
      type RarcRow = { code: string; description: string | null; category: string | null; plain_english: string | null };

      const mappingsResult = await query<EobRow>(
        `SELECT * FROM eob_denial_mappings WHERE ${latestFilter("eob_denial_mappings")} AND eob_code = $1 LIMIT 5`,
        [eobCode.trim()]
      );
      const mappings = mappingsResult.rows;

      if (mappings.length > 0) {
        const results = [];
        for (const mapping of mappings) {
          const carcResult = await query<CarcRow>(
            `SELECT * FROM carc_codes WHERE ${latestFilter("carc_codes")} AND code = $1 LIMIT 1`,
            [mapping.carc_code!]
          );
          const carc = carcResult.rows[0] ?? null;

          let rarc: RarcRow | null = null;
          if (mapping.rarc_code) {
            const rarcResult = await query<RarcRow>(
              `SELECT * FROM rarc_codes WHERE ${latestFilter("rarc_codes")} AND code = $1 LIMIT 1`,
              [mapping.rarc_code]
            );
            rarc = rarcResult.rows[0] ?? null;
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
      type CarcRow = { code: string; description: string | null; category: string | null; plain_english: string | null };
      type RarcRow = { code: string; description: string | null; category: string | null; plain_english: string | null };

      // Try CARC first
      const carcResult = await query<CarcRow>(
        `SELECT * FROM carc_codes WHERE ${latestFilter("carc_codes")} AND code = $1 LIMIT 1`,
        [normalized]
      );
      const carc = carcResult.rows[0] ?? null;

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
      const rarcResult = await query<RarcRow>(
        `SELECT * FROM rarc_codes WHERE ${latestFilter("rarc_codes")} AND code = $1 LIMIT 1`,
        [code.trim()]
      );
      const rarc = rarcResult.rows[0] ?? null;

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
      type SearchRow = { code_type: string; code: string; description: string; category: string | null; plain_english: string | null };
      const searchResult = await query<SearchRow>(
        `SELECT * FROM search_denial_codes($1)`,
        [descriptionSearch]
      );
      const results = searchResult.rows;

      if (results.length > 0) {
        const enriched = await Promise.all(
          results.slice(0, 10).map(async (r) => ({
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

    // Enrich with CARC code descriptions from RDS
    type CarcDescRow = { code: string; plain_english: string | null };
    const results = [];

    for (const [, { pattern }] of denialPatterns) {
      const carcCodes = (pattern.reasonCodes || [])
        .map((rc: string) => rc.replace(/^(CO|PR|OA)-?/i, "").trim());

      // Fetch CARC descriptions
      let carcDescriptions: { code: string; plain_english: string | null }[] = [];
      if (carcCodes.length > 0) {
        const carcResult = await query<CarcDescRow>(
          `SELECT code, plain_english FROM carc_codes WHERE ${latestFilter("carc_codes")} AND code = ANY($1::text[])`,
          [carcCodes]
        );
        carcDescriptions = carcResult.rows;
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

    // If no results from CPT matching, fetch top 3 general denial patterns from RDS
    if (results.length === 0) {
      type PatternRow = { reason: string | null; category: string | null; reason_codes: string[] | null; documentation_checklist: string[] | null; estimated_success_rate: string | null; appeal_deadline_days: number | null };
      const fallbackResult = await query<PatternRow>(
        `SELECT * FROM denial_patterns WHERE ${latestFilter("denial_patterns")} AND category = ANY($1::text[]) LIMIT 3`,
        [["Medical Necessity", "Documentation", "Coding"]]
      );
      const fallbackPatterns = fallbackResult.rows;

      if (fallbackPatterns.length > 0) {
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
            const carcDataResult = await query<{ plain_english: string | null }>(
              `SELECT plain_english FROM carc_codes WHERE ${latestFilter("carc_codes")} AND code = $1 LIMIT 1`,
              [firstCarc]
            );
            denial.plain_english = carcDataResult.rows[0]?.plain_english || null;
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

  // ICD-10, CMS Coverage, NPI — local implementations (replaced MCP servers)
  executors.set("search_icd10", searchICD10Executor);
  executors.set("search_local_coverage", searchLocalCoverageExecutor);
  executors.set("search_national_coverage", searchNationalCoverageExecutor);
  executors.set("get_coverage_document", getCoverageDocumentExecutor);
  executors.set("npi_search", npiSearchExecutor);
  executors.set("npi_lookup", npiLookupExecutor);

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

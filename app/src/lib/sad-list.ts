/**
 * SAD (Self-Administered Drug) List Check
 *
 * Determines whether a drug/biologic is covered under Medicare Part B
 * (physician-administered) or Part D (self-administered).
 *
 * Part B covers drugs that are:
 * - Administered by a physician in an office/clinic
 * - Not usually self-administered
 * - Certain vaccines and biologics
 *
 * Part D covers drugs that are:
 * - Self-administered (oral, topical, self-injection)
 * - On the SAD exclusion list
 */

// SAD Exclusion List - drugs explicitly excluded from Part B (covered under Part D)
// Based on CMS Medicare Benefit Policy Manual, Chapter 15, Section 50
const SAD_EXCLUSION_LIST: Record<string, SADExclusion> = {
  // Oral medications (always Part D)
  "methotrexate_oral": {
    genericName: "methotrexate",
    route: "oral",
    partB: false,
    partD: true,
    reason: "Oral formulation - self-administered",
  },
  "capecitabine": {
    genericName: "capecitabine",
    route: "oral",
    partB: false,
    partD: true,
    reason: "Oral chemotherapy - self-administered",
  },
  "lenalidomide": {
    genericName: "lenalidomide",
    route: "oral",
    partB: false,
    partD: true,
    reason: "Oral medication - self-administered",
  },
  "pomalidomide": {
    genericName: "pomalidomide",
    route: "oral",
    partB: false,
    partD: true,
    reason: "Oral medication - self-administered",
  },

  // Self-injectable medications (Part D unless physician-administered)
  "insulin": {
    genericName: "insulin",
    route: "subcutaneous",
    partB: false,
    partD: true,
    reason: "Self-administered injection",
    exception: "Part B covers insulin pump supplies",
  },
  "epinephrine_autoinjector": {
    genericName: "epinephrine",
    route: "subcutaneous",
    partB: false,
    partD: true,
    reason: "Self-administered emergency injection",
  },
  "sumatriptan_injection": {
    genericName: "sumatriptan",
    route: "subcutaneous",
    partB: false,
    partD: true,
    reason: "Self-administered injection for migraines",
  },
  "enoxaparin": {
    genericName: "enoxaparin",
    route: "subcutaneous",
    partB: false,
    partD: true,
    reason: "Self-administered anticoagulant injection",
  },
  "dalteparin": {
    genericName: "dalteparin",
    route: "subcutaneous",
    partB: false,
    partD: true,
    reason: "Self-administered anticoagulant injection",
  },

  // Growth hormones (usually Part D)
  "somatropin": {
    genericName: "somatropin",
    route: "subcutaneous",
    partB: false,
    partD: true,
    reason: "Self-administered growth hormone",
  },

  // Fertility drugs (not covered by Medicare)
  "follitropin": {
    genericName: "follitropin",
    route: "subcutaneous",
    partB: false,
    partD: false,
    reason: "Fertility treatment - not covered by Medicare",
  },
};

// Part B Covered Drugs - physician-administered or special exceptions
const PART_B_COVERED: Record<string, PartBCoverage> = {
  // Chemotherapy (IV/infusion - physician administered)
  "rituximab": {
    genericName: "rituximab",
    brandNames: ["Rituxan"],
    route: "intravenous",
    partB: true,
    hcpcsCode: "J9312",
    reason: "IV infusion - physician administered",
  },
  "pembrolizumab": {
    genericName: "pembrolizumab",
    brandNames: ["Keytruda"],
    route: "intravenous",
    partB: true,
    hcpcsCode: "J9271",
    reason: "IV infusion - physician administered",
  },
  "nivolumab": {
    genericName: "nivolumab",
    brandNames: ["Opdivo"],
    route: "intravenous",
    partB: true,
    hcpcsCode: "J9299",
    reason: "IV infusion - physician administered",
  },
  "trastuzumab": {
    genericName: "trastuzumab",
    brandNames: ["Herceptin"],
    route: "intravenous",
    partB: true,
    hcpcsCode: "J9355",
    reason: "IV infusion - physician administered",
  },
  "bevacizumab": {
    genericName: "bevacizumab",
    brandNames: ["Avastin"],
    route: "intravenous",
    partB: true,
    hcpcsCode: "J9035",
    reason: "IV infusion - physician administered",
  },

  // Biologics for autoimmune conditions (infusion)
  "infliximab": {
    genericName: "infliximab",
    brandNames: ["Remicade"],
    route: "intravenous",
    partB: true,
    hcpcsCode: "J1745",
    reason: "IV infusion - physician administered",
  },
  "tocilizumab": {
    genericName: "tocilizumab",
    brandNames: ["Actemra"],
    route: "intravenous",
    partB: true,
    hcpcsCode: "J3262",
    reason: "IV infusion - physician administered",
  },
  "abatacept": {
    genericName: "abatacept",
    brandNames: ["Orencia"],
    route: "intravenous",
    partB: true,
    hcpcsCode: "J0129",
    reason: "IV infusion - physician administered",
  },

  // Osteoporosis (physician-administered injections)
  "denosumab": {
    genericName: "denosumab",
    brandNames: ["Prolia", "Xgeva"],
    route: "subcutaneous",
    partB: true,
    hcpcsCode: "J0897",
    reason: "Physician-administered injection for osteoporosis",
  },
  "zoledronic_acid": {
    genericName: "zoledronic acid",
    brandNames: ["Reclast", "Zometa"],
    route: "intravenous",
    partB: true,
    hcpcsCode: "J3489",
    reason: "IV infusion - physician administered",
  },

  // Vaccines (Part B covered)
  "influenza_vaccine": {
    genericName: "influenza vaccine",
    brandNames: ["Fluzone", "Fluad"],
    route: "intramuscular",
    partB: true,
    hcpcsCode: "90686",
    reason: "Preventive vaccine - Part B covered",
  },
  "pneumococcal_vaccine": {
    genericName: "pneumococcal vaccine",
    brandNames: ["Prevnar", "Pneumovax"],
    route: "intramuscular",
    partB: true,
    hcpcsCode: "90670",
    reason: "Preventive vaccine - Part B covered",
  },
  "hepatitis_b_vaccine": {
    genericName: "hepatitis B vaccine",
    brandNames: ["Engerix-B", "Recombivax"],
    route: "intramuscular",
    partB: true,
    hcpcsCode: "90746",
    reason: "Preventive vaccine - Part B covered for high-risk",
  },
  "covid19_vaccine": {
    genericName: "COVID-19 vaccine",
    brandNames: ["Pfizer", "Moderna", "Novavax"],
    route: "intramuscular",
    partB: true,
    hcpcsCode: "91300",
    reason: "Preventive vaccine - Part B covered",
  },

  // Blood products
  "immune_globulin": {
    genericName: "immune globulin",
    brandNames: ["Gammagard", "Privigen"],
    route: "intravenous",
    partB: true,
    hcpcsCode: "J1459",
    reason: "IV infusion - physician administered",
  },

  // ESAs for ESRD
  "epoetin_alfa": {
    genericName: "epoetin alfa",
    brandNames: ["Epogen", "Procrit"],
    route: "intravenous",
    partB: true,
    hcpcsCode: "J0885",
    reason: "ESRD treatment - Part B covered",
  },
  "darbepoetin": {
    genericName: "darbepoetin alfa",
    brandNames: ["Aranesp"],
    route: "intravenous",
    partB: true,
    hcpcsCode: "J0881",
    reason: "ESRD treatment - Part B covered",
  },

  // Macular degeneration
  "ranibizumab": {
    genericName: "ranibizumab",
    brandNames: ["Lucentis"],
    route: "intravitreal",
    partB: true,
    hcpcsCode: "J2778",
    reason: "Physician-administered injection",
  },
  "aflibercept": {
    genericName: "aflibercept",
    brandNames: ["Eylea"],
    route: "intravitreal",
    partB: true,
    hcpcsCode: "J0178",
    reason: "Physician-administered injection",
  },

  // Anti-emetics for chemotherapy
  "ondansetron_iv": {
    genericName: "ondansetron",
    brandNames: ["Zofran"],
    route: "intravenous",
    partB: true,
    hcpcsCode: "J2405",
    reason: "IV - administered with chemotherapy",
  },
  "palonosetron": {
    genericName: "palonosetron",
    brandNames: ["Aloxi"],
    route: "intravenous",
    partB: true,
    hcpcsCode: "J2469",
    reason: "IV - administered with chemotherapy",
  },
};

// Types
export interface SADExclusion {
  genericName: string;
  route: string;
  partB: boolean;
  partD: boolean;
  reason: string;
  exception?: string;
}

export interface PartBCoverage {
  genericName: string;
  brandNames: string[];
  route: string;
  partB: boolean;
  hcpcsCode?: string;
  reason: string;
}

export interface SADCheckResult {
  found: boolean;
  drugName: string;
  partB: boolean;
  partD: boolean;
  route?: string;
  reason: string;
  hcpcsCode?: string;
  brandNames?: string[];
  exception?: string;
}

/**
 * Check if a drug is on the SAD exclusion list (Part D) or Part B covered
 */
export function checkSADList(drugName: string): SADCheckResult {
  const normalizedName = drugName.toLowerCase().trim();

  // Check SAD exclusion list first
  for (const [key, drug] of Object.entries(SAD_EXCLUSION_LIST)) {
    if (
      normalizedName.includes(drug.genericName.toLowerCase()) ||
      key.toLowerCase().includes(normalizedName)
    ) {
      return {
        found: true,
        drugName: drug.genericName,
        partB: drug.partB,
        partD: drug.partD,
        route: drug.route,
        reason: drug.reason,
        exception: drug.exception,
      };
    }
  }

  // Check Part B covered list
  for (const [key, drug] of Object.entries(PART_B_COVERED)) {
    if (
      normalizedName.includes(drug.genericName.toLowerCase()) ||
      key.toLowerCase().includes(normalizedName) ||
      drug.brandNames.some((brand) =>
        normalizedName.includes(brand.toLowerCase())
      )
    ) {
      return {
        found: true,
        drugName: drug.genericName,
        partB: drug.partB,
        partD: false,
        route: drug.route,
        reason: drug.reason,
        hcpcsCode: drug.hcpcsCode,
        brandNames: drug.brandNames,
      };
    }
  }

  // Not found - provide general guidance
  return {
    found: false,
    drugName: drugName,
    partB: false,
    partD: false,
    reason: "Drug not found in SAD list. Coverage depends on administration method.",
  };
}

/**
 * Determine coverage based on route of administration
 */
export function getCoverageByRoute(route: string): {
  likelyPartB: boolean;
  likelyPartD: boolean;
  explanation: string;
} {
  const normalizedRoute = route.toLowerCase().trim();

  // IV/Infusion routes - typically Part B
  if (
    normalizedRoute.includes("intravenous") ||
    normalizedRoute.includes("iv") ||
    normalizedRoute.includes("infusion")
  ) {
    return {
      likelyPartB: true,
      likelyPartD: false,
      explanation:
        "IV/infusion medications are typically covered under Part B when administered by a healthcare provider.",
    };
  }

  // Intramuscular/intravitreal - typically Part B
  if (
    normalizedRoute.includes("intramuscular") ||
    normalizedRoute.includes("im") ||
    normalizedRoute.includes("intravitreal")
  ) {
    return {
      likelyPartB: true,
      likelyPartD: false,
      explanation:
        "Injections administered by a healthcare provider are typically covered under Part B.",
    };
  }

  // Oral medications - always Part D
  if (
    normalizedRoute.includes("oral") ||
    normalizedRoute.includes("tablet") ||
    normalizedRoute.includes("capsule") ||
    normalizedRoute.includes("liquid")
  ) {
    return {
      likelyPartB: false,
      likelyPartD: true,
      explanation:
        "Oral medications are covered under Part D (prescription drug coverage).",
    };
  }

  // Subcutaneous - depends on who administers
  if (
    normalizedRoute.includes("subcutaneous") ||
    normalizedRoute.includes("subq") ||
    normalizedRoute.includes("sc")
  ) {
    return {
      likelyPartB: false,
      likelyPartD: true,
      explanation:
        "Self-administered subcutaneous injections are typically Part D. Physician-administered may be Part B.",
    };
  }

  // Topical - typically Part D
  if (
    normalizedRoute.includes("topical") ||
    normalizedRoute.includes("cream") ||
    normalizedRoute.includes("ointment") ||
    normalizedRoute.includes("patch")
  ) {
    return {
      likelyPartB: false,
      likelyPartD: true,
      explanation:
        "Topical medications are self-administered and covered under Part D.",
    };
  }

  // Inhaled - typically Part D
  if (
    normalizedRoute.includes("inhaled") ||
    normalizedRoute.includes("nebulized") ||
    normalizedRoute.includes("inhalation")
  ) {
    return {
      likelyPartB: false,
      likelyPartD: true,
      explanation:
        "Inhaled medications are typically self-administered and covered under Part D.",
    };
  }

  // Default - unknown
  return {
    likelyPartB: false,
    likelyPartD: false,
    explanation:
      "Coverage depends on whether the medication is self-administered (Part D) or physician-administered (Part B).",
  };
}

/**
 * Get all Part B covered drugs in a category
 */
export function getPartBDrugsByCategory(category: string): PartBCoverage[] {
  const normalizedCategory = category.toLowerCase();
  const results: PartBCoverage[] = [];

  for (const drug of Object.values(PART_B_COVERED)) {
    if (
      drug.reason.toLowerCase().includes(normalizedCategory) ||
      drug.genericName.toLowerCase().includes(normalizedCategory)
    ) {
      results.push(drug);
    }
  }

  return results;
}

/**
 * Search for drugs by name (generic or brand)
 */
export function searchDrugs(
  query: string
): Array<SADExclusion | PartBCoverage> {
  const normalizedQuery = query.toLowerCase().trim();
  const results: Array<SADExclusion | PartBCoverage> = [];

  // Search SAD list
  for (const drug of Object.values(SAD_EXCLUSION_LIST)) {
    if (drug.genericName.toLowerCase().includes(normalizedQuery)) {
      results.push(drug);
    }
  }

  // Search Part B list
  for (const drug of Object.values(PART_B_COVERED)) {
    if (
      drug.genericName.toLowerCase().includes(normalizedQuery) ||
      drug.brandNames.some((brand) =>
        brand.toLowerCase().includes(normalizedQuery)
      )
    ) {
      results.push(drug);
    }
  }

  return results;
}

/**
 * Get plain English explanation of Part B vs Part D coverage
 */
export function explainCoverage(drugName: string): string {
  const result = checkSADList(drugName);

  if (!result.found) {
    return `I couldn't find "${drugName}" in my database. Generally:
- Part B covers drugs given by a doctor in an office or clinic (like IV infusions)
- Part D covers drugs you take yourself at home (like pills or self-injections)

Ask your doctor how this medication is given to know which part covers it.`;
  }

  if (result.partB && !result.partD) {
    let explanation = `**${result.drugName}** is covered under **Medicare Part B**.

This means Medicare covers it when it's given by a healthcare provider. ${result.reason}`;

    if (result.hcpcsCode) {
      explanation += `\n\nThe billing code is ${result.hcpcsCode}.`;
    }

    return explanation;
  }

  if (result.partD && !result.partB) {
    let explanation = `**${result.drugName}** is covered under **Medicare Part D** (prescription drug plan).

${result.reason}`;

    if (result.exception) {
      explanation += `\n\n**Note:** ${result.exception}`;
    }

    return explanation;
  }

  if (!result.partB && !result.partD) {
    return `**${result.drugName}** is generally **not covered by Medicare**.

${result.reason}`;
  }

  return `**${result.drugName}** may be covered under either Part B or Part D depending on how it's administered.

${result.reason}`;
}

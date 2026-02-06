/**
 * Medicare Code Lookup Functions
 *
 * Provides search and lookup functionality for CPT and ICD-10 codes
 * using the local Medicare code mappings.
 */

import {
  ALL_CPT_CODES,
  ALL_ICD10_CODES,
  type CPTCode,
  type ICD10Code,
} from "./medicare-codes";

import {
  EXTENDED_CPT_CODES,
  EXTENDED_ICD10_CODES,
} from "./medicare-codes-extended";

// Combine all codes
const ALL_CPT = [...ALL_CPT_CODES, ...EXTENDED_CPT_CODES];
const ALL_ICD10 = [...ALL_ICD10_CODES, ...EXTENDED_ICD10_CODES];

// Build lookup maps for O(1) access
const cptByCode = new Map<string, CPTCode>();
const icd10ByCode = new Map<string, ICD10Code>();

ALL_CPT.forEach((code) => cptByCode.set(code.code, code));
ALL_ICD10.forEach((code) => icd10ByCode.set(code.code, code));

// =============================================================================
// BASIC LOOKUP FUNCTIONS
// =============================================================================

/**
 * Get CPT code description
 */
export function getCPTDescription(code: string): string | null {
  const cpt = cptByCode.get(code);
  return cpt?.description || null;
}

/**
 * Get ICD-10 code description
 */
export function getICD10Description(code: string): string | null {
  const icd = icd10ByCode.get(code);
  return icd?.description || null;
}

/**
 * Get full CPT code details
 */
export function getCPTCode(code: string): CPTCode | null {
  return cptByCode.get(code) || null;
}

/**
 * Get full ICD-10 code details
 */
export function getICD10Code(code: string): ICD10Code | null {
  return icd10ByCode.get(code) || null;
}

// =============================================================================
// SEARCH FUNCTIONS
// =============================================================================

/**
 * Search CPT codes by keyword
 */
export function searchCPT(query: string, limit: number = 10): CPTCode[] {
  const lower = query.toLowerCase();

  return ALL_CPT.filter(
    (code) =>
      code.code.toLowerCase().includes(lower) ||
      code.description.toLowerCase().includes(lower) ||
      code.category.toLowerCase().includes(lower) ||
      code.subcategory?.toLowerCase().includes(lower)
  ).slice(0, limit);
}

/**
 * Search ICD-10 codes by keyword
 */
export function searchICD10(query: string, limit: number = 10): ICD10Code[] {
  const lower = query.toLowerCase();

  return ALL_ICD10.filter(
    (code) =>
      code.code.toLowerCase().includes(lower) ||
      code.description.toLowerCase().includes(lower) ||
      code.category.toLowerCase().includes(lower) ||
      code.subcategory?.toLowerCase().includes(lower)
  ).slice(0, limit);
}

// =============================================================================
// CONDITION-BASED LOOKUPS
// =============================================================================

/**
 * Condition to code mapping keywords
 */
const CONDITION_KEYWORDS: Record<string, { category: string; keywords: string[] }> = {
  // Cardiology
  "heart failure": { category: "Cardiology", keywords: ["heart failure", "chf", "cardiac failure", "hf"] },
  "atrial fibrillation": { category: "Cardiology", keywords: ["afib", "a-fib", "atrial fib", "af"] },
  "hypertension": { category: "Cardiology", keywords: ["high blood pressure", "htn", "bp", "elevated blood pressure"] },
  "heart attack": { category: "Cardiology", keywords: ["mi", "myocardial infarction", "stemi", "nstemi", "heart attack"] },
  "coronary artery disease": { category: "Cardiology", keywords: ["cad", "coronary disease", "blocked arteries", "heart disease"] },

  // Diabetes
  "diabetes": { category: "Diabetes", keywords: ["diabetes", "diabetic", "dm", "type 2", "blood sugar", "a1c"] },
  "diabetic retinopathy": { category: "Diabetes", keywords: ["diabetic eye", "retinopathy", "eye diabetes"] },
  "diabetic neuropathy": { category: "Diabetes", keywords: ["diabetic nerve", "neuropathy", "numbness feet", "tingling"] },

  // Orthopedics
  "knee replacement": { category: "Orthopedics", keywords: ["knee replacement", "tka", "total knee", "knee arthroplasty"] },
  "hip replacement": { category: "Orthopedics", keywords: ["hip replacement", "tha", "total hip", "hip arthroplasty"] },
  "back pain": { category: "Orthopedics", keywords: ["back pain", "low back", "lumbar", "lbp", "spine pain"] },
  "knee pain": { category: "Orthopedics", keywords: ["knee pain", "knee arthritis", "knee oa"] },
  "osteoporosis": { category: "Orthopedics", keywords: ["osteoporosis", "bone loss", "bone density", "dexa"] },

  // Pulmonary
  "copd": { category: "Pulmonary", keywords: ["copd", "emphysema", "chronic bronchitis", "lung disease"] },
  "asthma": { category: "Pulmonary", keywords: ["asthma", "wheezing", "bronchospasm", "reactive airway"] },
  "pneumonia": { category: "Pulmonary", keywords: ["pneumonia", "lung infection", "chest infection"] },

  // Neurology
  "dementia": { category: "Neurology", keywords: ["dementia", "alzheimer", "memory loss", "cognitive decline"] },
  "parkinson": { category: "Neurology", keywords: ["parkinson", "tremor", "movement disorder"] },
  "sleep apnea": { category: "Neurology", keywords: ["sleep apnea", "osa", "cpap", "snoring", "apnea"] },
  "migraine": { category: "Neurology", keywords: ["migraine", "headache", "head pain"] },

  // Nephrology
  "kidney disease": { category: "Nephrology", keywords: ["ckd", "kidney disease", "renal failure", "kidney failure"] },
  "dialysis": { category: "Nephrology", keywords: ["dialysis", "hemodialysis", "esrd", "end stage renal"] },

  // Ophthalmology
  "cataract": { category: "Ophthalmology", keywords: ["cataract", "cloudy lens", "vision blur"] },
  "macular degeneration": { category: "Ophthalmology", keywords: ["macular degeneration", "amd", "macula", "central vision"] },
  "glaucoma": { category: "Ophthalmology", keywords: ["glaucoma", "eye pressure", "iop"] },

  // GI
  "colonoscopy": { category: "GI", keywords: ["colonoscopy", "colon screening", "colon cancer screening"] },
  "gerd": { category: "GI", keywords: ["gerd", "reflux", "heartburn", "acid reflux"] },
  "diverticulitis": { category: "GI", keywords: ["diverticulitis", "diverticulosis", "diverticular"] },

  // Mental Health
  "depression": { category: "Mental Health", keywords: ["depression", "depressed", "sad", "mdd"] },
  "anxiety": { category: "Mental Health", keywords: ["anxiety", "anxious", "panic", "worry", "gad"] },

  // Oncology
  "cancer screening": { category: "Oncology", keywords: ["cancer screening", "mammogram", "colonoscopy screening"] },
  "chemotherapy": { category: "Oncology", keywords: ["chemo", "chemotherapy", "cancer treatment"] },

  // Imaging
  "mri": { category: "Orthopedics", keywords: ["mri", "magnetic resonance", "scan"] },
  "ct scan": { category: "Pulmonary", keywords: ["ct", "cat scan", "computed tomography"] },
  "x-ray": { category: "Orthopedics", keywords: ["xray", "x-ray", "radiograph"] },
};

/**
 * Get CPT codes for a condition/procedure description
 */
export function getCPTsForCondition(condition: string): CPTCode[] {
  const lower = condition.toLowerCase();

  // Check for exact condition matches
  for (const [, config] of Object.entries(CONDITION_KEYWORDS)) {
    if (config.keywords.some((kw) => lower.includes(kw))) {
      const categoryResults = ALL_CPT.filter(
        (cpt) => cpt.category === config.category
      );

      // Category can be very broad (e.g., all Orthopedics).
      // Narrow by filtering to codes whose description matches query words.
      const queryWords = lower.split(/\s+/).filter((w) => w.length > 2);
      const narrowed = categoryResults.filter((cpt) => {
        const desc = cpt.description.toLowerCase();
        return queryWords.some((w) => desc.includes(w));
      });

      // Use narrowed results if we got any, otherwise fall back to category
      return narrowed.length > 0 ? narrowed : categoryResults;
    }
  }

  // Fallback to general search
  return searchCPT(condition, 20);
}

/**
 * Get ICD-10 codes for a condition description
 */
export function getICD10sForCondition(condition: string): ICD10Code[] {
  const lower = condition.toLowerCase();

  // Check for exact condition matches
  for (const [, config] of Object.entries(CONDITION_KEYWORDS)) {
    if (config.keywords.some((kw) => lower.includes(kw))) {
      return ALL_ICD10.filter(
        (icd) => icd.category === config.category
      );
    }
  }

  // Fallback to general search
  return searchICD10(condition, 20);
}

// =============================================================================
// RELATED CODE LOOKUPS
// =============================================================================

/**
 * Get ICD-10 codes commonly paired with a CPT code
 */
export function getRelatedDiagnoses(cptCode: string): ICD10Code[] {
  const cpt = cptByCode.get(cptCode);
  if (!cpt?.commonDiagnoses) return [];

  return cpt.commonDiagnoses
    .map((code) => icd10ByCode.get(code))
    .filter((icd): icd is ICD10Code => icd !== undefined);
}

/**
 * Get CPT codes commonly used for an ICD-10 diagnosis
 */
export function getRelatedProcedures(icd10Code: string): CPTCode[] {
  const icd = icd10ByCode.get(icd10Code);
  if (!icd?.commonProcedures) return [];

  return icd.commonProcedures
    .map((code) => cptByCode.get(code))
    .filter((cpt): cpt is CPTCode => cpt !== undefined);
}

// =============================================================================
// CATEGORY-BASED LOOKUPS
// =============================================================================

/**
 * Get all CPT codes in a category
 */
export function getCPTsByCategory(category: string): CPTCode[] {
  return ALL_CPT.filter(
    (cpt) => cpt.category.toLowerCase() === category.toLowerCase()
  );
}

/**
 * Get all ICD-10 codes in a category
 */
export function getICD10sByCategory(category: string): ICD10Code[] {
  return ALL_ICD10.filter(
    (icd) => icd.category.toLowerCase() === category.toLowerCase()
  );
}

/**
 * Get all available categories
 */
export function getCategories(): string[] {
  const categories = new Set<string>();
  ALL_CPT.forEach((cpt) => categories.add(cpt.category));
  ALL_ICD10.forEach((icd) => categories.add(icd.category));
  return Array.from(categories).sort();
}

// =============================================================================
// MEDICARE-SPECIFIC LOOKUPS
// =============================================================================

/**
 * Get CPT codes with Medicare-specific notes
 */
export function getCPTsWithMedicareNotes(): CPTCode[] {
  return ALL_CPT.filter((cpt) => cpt.medicareNotes);
}

/**
 * Check if a code is a preventive/screening code (usually covered without cost-sharing)
 */
export function isPreventiveCode(code: string): boolean {
  const preventiveCPTs = [
    "G0438", "G0439", // Annual wellness visits
    "G0442", "G0443", // Alcohol screening
    "G0444", // Depression screening
    "G0446", // CV counseling
    "G0447", // Obesity counseling
    "G0101", "G0121", "G0105", // Cancer screening
    "77067", // Mammogram
    "90732", "90670", "90715", "90714", "90662", "90686", "90688", "90750", // Vaccines
  ];

  return preventiveCPTs.includes(code);
}

/**
 * Check if code requires prior authorization commonly
 */
export function commonlyRequiresPriorAuth(code: string): boolean {
  const priorAuthCodes = [
    // === CMS Prior Authorization Model Categories ===

    // Blepharoplasty (eyelid surgery)
    "15820", "15821", "15822", "15823",

    // Botulinum toxin injections
    "64615",

    // Cervical fusion
    "22551", "22552", "22554",

    // Facet joint interventions (spine injections)
    "64490", "64491", "64492", "64493", "64494", "64495",

    // Hip/knee replacements
    "27130", "27132", "27447",

    // Implanted spinal neurostimulators
    "63650", "63685", "63688",

    // Lumbar fusion
    "22612", "22630", "22633", "22634",

    // Rhinoplasty
    "30400", "30410", "30420", "30430", "30435", "30450", "30460", "30462",

    // Sacroiliac joint fusion
    "27279",

    // Vein ablation
    "36473", "36474", "36475", "36476", "36478", "36479",

    // === Additional commonly requiring PA ===

    // Spine surgeries
    "63030", "63042", "63047",

    // Advanced imaging (MRI)
    "70551", "70552", "70553",
    "72141", "72142", "72148", "72149",
    "73721", "73722",

    // CT scans
    "71250", "71260", "74176", "74177",

    // Sleep studies
    "95810", "95811",

    // DME
    "E0601", "E1390", "K0001", "K0010",

    // Cataract/eye surgeries
    "66984", "67028",

    // Specialty drugs/infusions
    "96413", "96415",

    // Bariatric surgery
    "43775", "43644", "43645",

    // Cardiac procedures
    "93452", "93453",
  ];

  return priorAuthCodes.includes(code);
}

// =============================================================================
// STATISTICS
// =============================================================================

/**
 * Get code database statistics
 */
export function getCodeStats(): {
  totalCPT: number;
  totalICD10: number;
  categories: number;
  cptWithMedicareNotes: number;
} {
  return {
    totalCPT: ALL_CPT.length,
    totalICD10: ALL_ICD10.length,
    categories: getCategories().length,
    cptWithMedicareNotes: getCPTsWithMedicareNotes().length,
  };
}

// Export code arrays for direct access if needed
export { ALL_CPT, ALL_ICD10 };

/**
 * Specialty Match Validation
 *
 * Validates that a provider's specialty is appropriate for ordering
 * specific procedures. Helps prevent denials due to specialty mismatch.
 */

// Procedure categories and their required/acceptable specialties
// Key: procedure keyword, Value: array of acceptable specialty keywords
const PROCEDURE_SPECIALTY_MAP: Record<string, string[]> = {
  // Imaging - Spine
  "mri lumbar": [
    "orthopedic", "orthopedics", "orthopaedic",
    "neurology", "neurologist", "neurosurgery", "neurosurgeon",
    "pain", "physical medicine", "physiatry", "physiatrist", "pm&r",
    "family medicine", "family practice", "internal medicine", "primary care",
    "radiology", "radiologist",
  ],
  "mri cervical": [
    "orthopedic", "orthopedics", "orthopaedic",
    "neurology", "neurologist", "neurosurgery", "neurosurgeon",
    "pain", "physical medicine", "physiatry", "physiatrist", "pm&r",
    "family medicine", "family practice", "internal medicine", "primary care",
    "radiology", "radiologist",
  ],
  "mri thoracic": [
    "orthopedic", "orthopedics", "orthopaedic",
    "neurology", "neurologist", "neurosurgery", "neurosurgeon",
    "pain", "physical medicine", "physiatry", "physiatrist", "pm&r",
    "family medicine", "family practice", "internal medicine", "primary care",
    "radiology", "radiologist",
  ],
  "mri spine": [
    "orthopedic", "orthopedics", "orthopaedic",
    "neurology", "neurologist", "neurosurgery", "neurosurgeon",
    "pain", "physical medicine", "physiatry", "physiatrist", "pm&r",
    "family medicine", "family practice", "internal medicine", "primary care",
    "radiology", "radiologist",
  ],
  "ct spine": [
    "orthopedic", "orthopedics", "orthopaedic",
    "neurology", "neurologist", "neurosurgery", "neurosurgeon",
    "pain", "physical medicine", "physiatry", "physiatrist", "pm&r",
    "family medicine", "family practice", "internal medicine", "primary care",
    "radiology", "radiologist",
  ],

  // Imaging - Joints
  "mri knee": [
    "orthopedic", "orthopedics", "orthopaedic",
    "sports medicine",
    "family medicine", "family practice", "internal medicine", "primary care",
    "radiology", "radiologist",
    "rheumatology", "rheumatologist",
  ],
  "mri shoulder": [
    "orthopedic", "orthopedics", "orthopaedic",
    "sports medicine",
    "family medicine", "family practice", "internal medicine", "primary care",
    "radiology", "radiologist",
    "rheumatology", "rheumatologist",
  ],
  "mri hip": [
    "orthopedic", "orthopedics", "orthopaedic",
    "sports medicine",
    "family medicine", "family practice", "internal medicine", "primary care",
    "radiology", "radiologist",
    "rheumatology", "rheumatologist",
  ],

  // Imaging - Brain/Head
  "mri brain": [
    "neurology", "neurologist", "neurosurgery", "neurosurgeon",
    "family medicine", "family practice", "internal medicine", "primary care",
    "radiology", "radiologist",
    "oncology", "oncologist",
  ],
  "ct head": [
    "neurology", "neurologist", "neurosurgery", "neurosurgeon",
    "family medicine", "family practice", "internal medicine", "primary care",
    "emergency medicine",
    "radiology", "radiologist",
  ],

  // Imaging - Cardiac
  "cardiac mri": [
    "cardiology", "cardiologist",
    "internal medicine",
    "radiology", "radiologist",
  ],
  "echocardiogram": [
    "cardiology", "cardiologist",
    "internal medicine",
    "family medicine", "family practice",
  ],
  "stress test": [
    "cardiology", "cardiologist",
    "internal medicine",
    "family medicine", "family practice",
  ],

  // Surgeries - Orthopedic
  "knee replacement": [
    "orthopedic", "orthopedics", "orthopaedic",
  ],
  "hip replacement": [
    "orthopedic", "orthopedics", "orthopaedic",
  ],
  "shoulder surgery": [
    "orthopedic", "orthopedics", "orthopaedic",
    "sports medicine",
  ],
  "spine surgery": [
    "orthopedic", "orthopedics", "orthopaedic",
    "neurosurgery", "neurosurgeon",
  ],
  "back surgery": [
    "orthopedic", "orthopedics", "orthopaedic",
    "neurosurgery", "neurosurgeon",
  ],

  // Surgeries - Other
  "cataract surgery": [
    "ophthalmology", "ophthalmologist", "eye",
  ],
  "colonoscopy": [
    "gastroenterology", "gastroenterologist",
    "colorectal", "colon",
    "internal medicine",
    "family medicine", "family practice",
  ],
  "endoscopy": [
    "gastroenterology", "gastroenterologist",
    "internal medicine",
  ],

  // Therapies
  "physical therapy": [
    "orthopedic", "orthopedics", "orthopaedic",
    "neurology", "neurologist",
    "physical medicine", "physiatry", "physiatrist", "pm&r",
    "family medicine", "family practice", "internal medicine", "primary care",
    "pain",
    "sports medicine",
    "rheumatology", "rheumatologist",
  ],
  "occupational therapy": [
    "orthopedic", "orthopedics", "orthopaedic",
    "neurology", "neurologist",
    "physical medicine", "physiatry", "physiatrist", "pm&r",
    "family medicine", "family practice", "internal medicine", "primary care",
    "rheumatology", "rheumatologist",
  ],

  // DME
  "cpap": [
    "pulmonology", "pulmonologist", "pulmonary",
    "sleep medicine", "sleep",
    "family medicine", "family practice", "internal medicine", "primary care",
  ],
  "wheelchair": [
    "physical medicine", "physiatry", "physiatrist", "pm&r",
    "orthopedic", "orthopedics", "orthopaedic",
    "neurology", "neurologist",
    "family medicine", "family practice", "internal medicine", "primary care",
  ],
  "walker": [
    "physical medicine", "physiatry", "physiatrist", "pm&r",
    "orthopedic", "orthopedics", "orthopaedic",
    "family medicine", "family practice", "internal medicine", "primary care",
    "geriatrics", "geriatrician",
  ],
};

// Specialty display names for user-friendly messages
const SPECIALTY_DISPLAY_NAMES: Record<string, string> = {
  "orthopedic": "Orthopedic Surgeon",
  "orthopedics": "Orthopedic Surgeon",
  "orthopaedic": "Orthopedic Surgeon",
  "neurology": "Neurologist",
  "neurologist": "Neurologist",
  "neurosurgery": "Neurosurgeon",
  "neurosurgeon": "Neurosurgeon",
  "pain": "Pain Management Specialist",
  "physical medicine": "Physical Medicine & Rehabilitation",
  "physiatry": "Physiatrist",
  "physiatrist": "Physiatrist",
  "pm&r": "Physical Medicine & Rehabilitation",
  "family medicine": "Family Medicine",
  "family practice": "Family Practice",
  "internal medicine": "Internal Medicine",
  "primary care": "Primary Care",
  "radiology": "Radiologist",
  "radiologist": "Radiologist",
  "cardiology": "Cardiologist",
  "cardiologist": "Cardiologist",
  "gastroenterology": "Gastroenterologist",
  "gastroenterologist": "Gastroenterologist",
  "pulmonology": "Pulmonologist",
  "pulmonologist": "Pulmonologist",
  "rheumatology": "Rheumatologist",
  "rheumatologist": "Rheumatologist",
  "ophthalmology": "Ophthalmologist",
  "ophthalmologist": "Ophthalmologist",
  "sports medicine": "Sports Medicine",
  "sleep medicine": "Sleep Medicine",
  "geriatrics": "Geriatrician",
};

export interface SpecialtyMatchResult {
  isMatch: boolean;
  procedure: string;
  providerSpecialty: string;
  acceptableSpecialties: string[];
  warning: string | null;
  recommendation: string | null;
}

/**
 * Validate if a provider's specialty is appropriate for ordering a procedure
 * @param procedure - The procedure being ordered (e.g., "mri lumbar", "knee replacement")
 * @param providerSpecialty - The provider's specialty from NPI registry
 * @returns SpecialtyMatchResult with validation details
 */
export function validateSpecialtyMatch(
  procedure: string,
  providerSpecialty: string
): SpecialtyMatchResult {
  const procedureLower = procedure.toLowerCase().trim();
  const specialtyLower = providerSpecialty.toLowerCase().trim();

  // Find matching procedure category
  let matchedProcedure: string | null = null;
  let acceptableSpecialties: string[] = [];

  for (const [key, specialties] of Object.entries(PROCEDURE_SPECIALTY_MAP)) {
    if (procedureLower.includes(key) || key.includes(procedureLower)) {
      matchedProcedure = key;
      acceptableSpecialties = specialties;
      break;
    }
  }

  // If procedure not in our map, assume any specialty is fine
  if (!matchedProcedure || acceptableSpecialties.length === 0) {
    return {
      isMatch: true,
      procedure: procedure,
      providerSpecialty: providerSpecialty,
      acceptableSpecialties: [],
      warning: null,
      recommendation: null,
    };
  }

  // Check if provider specialty matches any acceptable specialty
  const isMatch = acceptableSpecialties.some(
    (acceptable) => specialtyLower.includes(acceptable) || acceptable.includes(specialtyLower)
  );

  if (isMatch) {
    return {
      isMatch: true,
      procedure: procedure,
      providerSpecialty: providerSpecialty,
      acceptableSpecialties: acceptableSpecialties,
      warning: null,
      recommendation: null,
    };
  }

  // No match - generate warning
  const displaySpecialties = acceptableSpecialties
    .slice(0, 4)
    .map((s) => SPECIALTY_DISPLAY_NAMES[s] || s)
    .filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates

  return {
    isMatch: false,
    procedure: procedure,
    providerSpecialty: providerSpecialty,
    acceptableSpecialties: acceptableSpecialties,
    warning: `This provider's specialty (${providerSpecialty}) may not typically order ${procedure}. Medicare may question the medical necessity.`,
    recommendation: `For ${procedure}, orders are typically accepted from: ${displaySpecialties.join(", ")}. Consider asking your primary care doctor for a referral to a specialist, or verify this provider can order this procedure.`,
  };
}

/**
 * Get recommended specialties for a procedure
 * @param procedure - The procedure description
 * @returns Array of recommended specialty display names
 */
export function getRecommendedSpecialties(procedure: string): string[] {
  const procedureLower = procedure.toLowerCase().trim();

  for (const [key, specialties] of Object.entries(PROCEDURE_SPECIALTY_MAP)) {
    if (procedureLower.includes(key) || key.includes(procedureLower)) {
      const displayNames = specialties
        .map((s) => SPECIALTY_DISPLAY_NAMES[s] || s)
        .filter((v, i, a) => a.indexOf(v) === i);
      return displayNames.slice(0, 5);
    }
  }

  return [];
}


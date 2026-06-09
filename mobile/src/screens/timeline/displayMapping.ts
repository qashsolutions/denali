/**
 * Display mapping — code/category/source/icon lookup for timeline cards.
 *
 * Pure data + thin lookup helpers. The renderer reads from here to
 * translate stored (LOINC / ICD-10 / internal / source enum / category
 * enum) into plain-language user-facing strings.
 *
 * No mutation of the underlying DAL rows: every lookup is read-only
 * and returns a fresh string. The mappings cover the common cases the
 * 45+ cohort encounters; missing entries fall through to the stored
 * `row.display`, then `row.code`, then a generic "Health record" label.
 *
 * Icon mapping uses lucide-react-native (already a dep for the nav
 * bar); each lookup returns a lucide icon component so the renderer
 * stays free of icon-import bookkeeping.
 */

import {
  Activity as ActivityIcon,
  ClipboardCheck,
  CloudDrizzle,
  Droplets,
  FileText,
  Heart,
  HeartPulse,
  Moon,
  PersonStanding,
  Pill,
  Stethoscope,
  ThermometerSun,
  User2,
  Users,
  Wine,
  type LucideIcon,
} from "lucide-react-native";

import type { ObservationCategory, ObservationSource } from "@/contracts";

// ─── Instrument id → user-facing name ────────────────────────────────────
// Keys MUST match `metadata_json.instrument` written by InstrumentsScreen.

export const INSTRUMENT_FRIENDLY_NAME: Readonly<Record<string, string>> = {
  "PHQ-2": "Mood check-in",
  "PHQ-9": "Mood check-in",
  "GAD-7": "Anxiety check-in",
  "AUDIT-C": "Drinking check-in",
  Epworth: "Daytime sleepiness check",
  IPSS: "Urinary symptoms check",
  MRS: "Menopause check",
  ADAM: "Low-testosterone screen",
};

export function getInstrumentName(instrumentId: string): string {
  return INSTRUMENT_FRIENDLY_NAME[instrumentId] ?? instrumentId;
}

// ─── Instrument id → domain icon ─────────────────────────────────────────

const INSTRUMENT_ICON: Readonly<Record<string, LucideIcon>> = {
  "PHQ-2": Heart,
  "PHQ-9": Heart,
  "GAD-7": CloudDrizzle,
  "AUDIT-C": Wine,
  Epworth: Moon,
  IPSS: Droplets,
  MRS: ThermometerSun,
  ADAM: User2,
};

export function getInstrumentIcon(instrumentId: string): LucideIcon {
  return INSTRUMENT_ICON[instrumentId] ?? ClipboardCheck;
}

// ─── observations.category → user-facing noun ────────────────────────────

export const CATEGORY_FRIENDLY_NAME: Readonly<Record<ObservationCategory, string>> = {
  questionnaire: "Check-in",
  biomarker: "Lab result",
  vital: "Vital sign",
  lifestyle: "Lifestyle",
  condition: "Condition",
  family_history: "Family history",
  symptom: "Symptom",
  anthropometric: "Body measurement",
  screening: "Screening",
};

export function getCategoryName(category: ObservationCategory): string {
  return CATEGORY_FRIENDLY_NAME[category] ?? "Health record";
}

// ─── observations.category → domain icon (single rows) ───────────────────

const CATEGORY_ICON: Readonly<Record<ObservationCategory, LucideIcon>> = {
  questionnaire: ClipboardCheck,
  biomarker: FileText, // labs typically come from uploaded reports
  vital: HeartPulse,
  lifestyle: ActivityIcon,
  condition: Stethoscope,
  family_history: Users,
  symptom: PersonStanding,
  anthropometric: User2,
  screening: ClipboardCheck,
};

export function getCategoryIcon(category: ObservationCategory): LucideIcon {
  return CATEGORY_ICON[category] ?? Pill;
}

// ─── observations.source → plain provenance ──────────────────────────────

export const SOURCE_FRIENDLY_NAME: Readonly<Record<ObservationSource, string>> = {
  self_reported: "You told us",
  uploaded_report: "From your uploaded report",
  fhir: "From your Medicare claims",
  log: "You logged it",
  derived: "Calculated from your answers",
};

export function getSourceName(source: ObservationSource): string {
  return SOURCE_FRIENDLY_NAME[source] ?? "Recorded in your timeline";
}

// ─── LOINC lab code → user-facing lab name ───────────────────────────────
// Small curated list of common labs the 45+ cohort sees. Missing codes
// fall through to row.display, then row.code. Not exhaustive on day 1 —
// the operator can extend without renderer changes.

export const LAB_FRIENDLY_NAME: Readonly<Record<string, string>> = {
  "4548-4": "Long-term blood sugar (HbA1c)",
  "2339-0": "Blood glucose",
  "2345-7": "Blood glucose",
  "2093-3": "Total cholesterol",
  "2085-9": "HDL cholesterol",
  "13457-7": "LDL cholesterol",
  "2571-8": "Triglycerides",
  "2160-0": "Creatinine",
  "33914-3": "Kidney function (eGFR)",
  "718-7": "Hemoglobin",
  "2823-3": "Potassium",
  "2951-2": "Sodium",
  "2160-1": "Calcium",
  "2885-2": "Total protein",
};

/**
 * Plain-language lab name for a LOINC code. Returns null on miss so
 * the caller can fall back to row.display gracefully.
 */
export function getLabName(loinc: string): string | null {
  return LAB_FRIENDLY_NAME[loinc] ?? null;
}

// ─── ICD-10 → plain condition name ───────────────────────────────────────
// Reuses the curated `conditions45plus` vocab from the onboarding side —
// the same labels the user picked are the same labels they see back.

export const CONDITION_FRIENDLY_NAME: Readonly<Record<string, string>> = {
  "E11.9": "Type 2 diabetes",
  "E11": "Type 2 diabetes",
  "E10.9": "Type 1 diabetes",
  "R73.03": "Prediabetes",
  "I10": "High blood pressure",
  "E78.5": "High cholesterol",
  "E66.9": "Obesity",
  "J44.9": "COPD",
  "M19.90": "Osteoarthritis",
  "M81.0": "Osteoporosis",
  "G47.33": "Sleep apnea",
  "N18.3": "Chronic kidney disease",
  "I25.10": "Coronary artery disease",
  "F32.9": "Depression",
  "F41.1": "Generalized anxiety",
};

export function getConditionName(icd10: string): string | null {
  return CONDITION_FRIENDLY_NAME[icd10] ?? null;
}

// ─── Single-card display name resolver ───────────────────────────────────
// Used by `kind: "single"` rows. Walks the available mappings in priority
// order, falling back to stored display / code / category before giving
// up to "Health record".

export interface SinglerowDisplay {
  /** User-facing primary name shown in the card title. */
  name: string;
  /** True iff a code-based plain-language entry was matched. */
  isMapped: boolean;
}

interface RowForDisplay {
  category: ObservationCategory;
  code_system: string;
  code: string;
  display: string;
}

export function resolveSingleRowDisplay(row: RowForDisplay): SinglerowDisplay {
  if (row.code_system === "LOINC") {
    const lab = getLabName(row.code);
    if (lab != null) return { name: lab, isMapped: true };
  }
  if (row.code_system === "ICD10") {
    const cond = getConditionName(row.code);
    if (cond != null) return { name: cond, isMapped: true };
  }
  if (row.display.length > 0) {
    return { name: row.display, isMapped: false };
  }
  if (row.code.length > 0) {
    return { name: row.code, isMapped: false };
  }
  return { name: getCategoryName(row.category), isMapped: false };
}

// ─── Standing disclaimer ─────────────────────────────────────────────────

export const STANDING_DISCLAIMER =
  "Information only — not a diagnosis or medical advice.";

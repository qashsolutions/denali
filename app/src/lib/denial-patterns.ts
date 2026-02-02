/**
 * Medicare Denial Patterns
 *
 * Queries Supabase for denial patterns and appeal levels.
 * All data is maintained in the database — no hardcoded arrays.
 */

import { MEDICARE_CONSTANTS } from "@/config";
import { createClient } from "./supabase";

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

export interface AppealLevel {
  level: number;
  name: string;
  description: string;
  timeLimit: string;
  decisionTimeframe: string;
  successRate?: string;
}

// =============================================================================
// HELPERS
// =============================================================================

/** Map a Supabase denial_patterns row to a DenialPattern */
function rowToPattern(row: {
  reason: string | null;
  category: string | null;
  reason_codes: string[] | null;
  common_cpts: string[] | null;
  common_diagnoses: string[] | null;
  appeal_strategy: string | null;
  documentation_checklist: string[] | null;
  estimated_success_rate: string | null;
  appeal_deadline_days: number | null;
}): DenialPattern {
  return {
    reason: row.reason ?? "",
    reasonCodes: row.reason_codes ?? [],
    commonCPTs: row.common_cpts ?? [],
    commonDiagnoses: row.common_diagnoses ?? [],
    appealStrategy: row.appeal_strategy ?? "",
    documentationChecklist: row.documentation_checklist ?? [],
    estimatedSuccessRate: (row.estimated_success_rate as DenialPattern["estimatedSuccessRate"]) ?? undefined,
    appealDeadlineDays: row.appeal_deadline_days ?? 120,
  };
}

/** Map a Supabase appeal_levels row to an AppealLevel */
function rowToAppealLevel(row: {
  level: number | null;
  name: string | null;
  description: string | null;
  time_limit: string | null;
  decision_timeframe: string | null;
  success_rate: string | null;
}): AppealLevel {
  return {
    level: row.level ?? 0,
    name: row.name ?? "",
    description: row.description ?? "",
    timeLimit: row.time_limit ?? "",
    decisionTimeframe: row.decision_timeframe ?? "",
    successRate: row.success_rate ?? undefined,
  };
}

// =============================================================================
// LOOKUP FUNCTIONS
// =============================================================================

/**
 * Find denial patterns matching a reason text
 */
export async function findDenialPattern(reasonText: string): Promise<DenialPattern[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("denial_patterns_latest")
    .select("*")
    .or(`reason.ilike.%${reasonText}%,appeal_strategy.ilike.%${reasonText}%`);

  if (error || !data) return [];
  return data.map(rowToPattern);
}

/**
 * Get denial patterns for a specific CPT code
 */
export async function getDenialPatternsForCPT(cptCode: string): Promise<DenialPattern[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc("get_denial_patterns_for_cpt", { cpt_code_input: cptCode });

  if (error || !data) return [];
  return (data as Array<{
    reason: string;
    category: string;
    reason_codes: string[] | null;
    common_cpts: string[] | null;
    common_diagnoses: string[] | null;
    appeal_strategy: string;
    documentation_checklist: string[] | null;
    estimated_success_rate: string | null;
    appeal_deadline_days: number;
  }>).map(rowToPattern);
}

/**
 * Get denial patterns by category
 */
export async function getDenialPatternsByCategory(
  category: string
): Promise<DenialPattern[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("denial_patterns_latest")
    .select("*")
    .ilike("category", category);

  if (error || !data) return [];
  return data.map(rowToPattern);
}

/**
 * Get appeal strategy for a denial reason and CPT code
 */
export async function getAppealStrategy(
  denialReason: string,
  cptCode?: string
): Promise<{
  strategy: string;
  checklist: string[];
  estimatedSuccess: string;
  deadline: number;
} | null> {
  // First try to match by CPT code
  if (cptCode) {
    const cptPatterns = await getDenialPatternsForCPT(cptCode);
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
  const patterns = await findDenialPattern(denialReason);
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
export async function getNextAppealLevel(
  previousLevels: number[] = []
): Promise<AppealLevel | null> {
  const maxLevel = Math.max(0, ...previousLevels);
  const nextLevel = maxLevel + 1;

  const supabase = createClient();
  const { data, error } = await supabase
    .from("appeal_levels_latest")
    .select("*")
    .eq("level", nextLevel)
    .single();

  if (error || !data) return null;
  return rowToAppealLevel(data);
}

/**
 * Calculate appeal deadline from denial date
 */
export async function calculateAppealDeadline(
  denialDate: Date,
  appealLevel: number = 1
): Promise<Date> {
  const supabase = createClient();
  const { data } = await supabase
    .from("appeal_levels_latest")
    .select("time_limit")
    .eq("level", appealLevel)
    .single();

  let days: number = MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS;
  if (data?.time_limit) {
    const daysMatch = data.time_limit.match(/(\d+)\s*days/i);
    if (daysMatch) {
      days = parseInt(daysMatch[1], 10);
    }
  }

  const deadline = new Date(denialDate);
  deadline.setDate(deadline.getDate() + days);
  return deadline;
}

/**
 * Get denial reason details by code.
 * Queries the carc_codes_latest table (already in Supabase).
 */
export async function getDenialReasonByCode(
  code: string
): Promise<{ code: string; description: string; category: string } | null> {
  const normalized = code.replace(/^(CO|PR|OA|CR|PI)-?/i, "").trim();
  const supabase = createClient();
  const { data, error } = await supabase
    .from("carc_codes_latest")
    .select("code, description, category")
    .eq("code", normalized)
    .single();

  if (error || !data) return null;
  return {
    code: data.code!,
    description: data.description!,
    category: data.category || "Unknown",
  };
}

/**
 * Get appeal strategy for a CARC code.
 * Maps CARC code (e.g., "50", "CO-50", "PR-50") to matching denial pattern
 * via the reason_codes field.
 */
export async function getAppealStrategyForCARC(carcCode: string): Promise<{
  strategy: string;
  checklist: string[];
  estimatedSuccess: string;
  deadline: number;
  reason: string;
} | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .rpc("get_denial_pattern_for_carc", { carc_code_input: carcCode });

  if (error || !data || (Array.isArray(data) && data.length === 0)) return null;

  const row = Array.isArray(data) ? data[0] : data;
  return {
    strategy: row.appeal_strategy,
    checklist: row.documentation_checklist ?? [],
    estimatedSuccess: row.estimated_success_rate || "unknown",
    deadline: row.appeal_deadline_days,
    reason: row.reason,
  };
}

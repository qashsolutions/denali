/**
 * Medicare Denial Patterns
 *
 * Queries RDS PostgreSQL for denial patterns and appeal levels.
 * All data is maintained in the database — no hardcoded arrays.
 */

import { MEDICARE_CONSTANTS } from "@/config";
import { query } from "./db";

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

type PatternRow = {
  reason: string | null;
  category: string | null;
  reason_codes: string[] | null;
  common_cpts: string[] | null;
  common_diagnoses: string[] | null;
  appeal_strategy: string | null;
  documentation_checklist: string[] | null;
  estimated_success_rate: string | null;
  appeal_deadline_days: number | null;
};

function rowToPattern(row: PatternRow): DenialPattern {
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

type AppealLevelRow = {
  level: number | null;
  name: string | null;
  description: string | null;
  time_limit: string | null;
  decision_timeframe: string | null;
  success_rate: string | null;
};

function rowToAppealLevel(row: AppealLevelRow): AppealLevel {
  return {
    level: row.level ?? 0,
    name: row.name ?? "",
    description: row.description ?? "",
    timeLimit: row.time_limit ?? "",
    decisionTimeframe: row.decision_timeframe ?? "",
    successRate: row.success_rate ?? undefined,
  };
}

// Helper: latest-row filter using the same pattern as the _latest views in Supabase
const latestFilter = (table: string) =>
  `effective_date = (SELECT MAX(effective_date) FROM ${table})`;

// =============================================================================
// LOOKUP FUNCTIONS
// =============================================================================

/**
 * Find denial patterns matching a reason text
 */
export async function findDenialPattern(reasonText: string): Promise<DenialPattern[]> {
  const like = `%${reasonText}%`;
  const result = await query<PatternRow>(
    `SELECT * FROM denial_patterns
     WHERE ${latestFilter("denial_patterns")}
       AND (reason ILIKE $1 OR appeal_strategy ILIKE $1)`,
    [like]
  );
  return result.rows.map(rowToPattern);
}

/**
 * Get denial patterns for a specific CPT code
 */
export async function getDenialPatternsForCPT(cptCode: string): Promise<DenialPattern[]> {
  const result = await query<PatternRow>(
    `SELECT * FROM get_denial_patterns_for_cpt($1)`,
    [cptCode]
  );
  return result.rows.map(rowToPattern);
}

/**
 * Get denial patterns by category
 */
export async function getDenialPatternsByCategory(category: string): Promise<DenialPattern[]> {
  const result = await query<PatternRow>(
    `SELECT * FROM denial_patterns
     WHERE ${latestFilter("denial_patterns")}
       AND category ILIKE $1`,
    [`%${category}%`]
  );
  return result.rows.map(rowToPattern);
}

/**
 * Get appeal strategy for a denial reason and CPT code
 */
export async function getAppealStrategy(
  denialReason: string,
  cptCode?: string
): Promise<{ strategy: string; checklist: string[]; estimatedSuccess: string; deadline: number } | null> {
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
export async function getNextAppealLevel(previousLevels: number[] = []): Promise<AppealLevel | null> {
  const maxLevel = Math.max(0, ...previousLevels);
  const nextLevel = maxLevel + 1;

  const result = await query<AppealLevelRow>(
    `SELECT * FROM appeal_levels
     WHERE ${latestFilter("appeal_levels")} AND level = $1
     LIMIT 1`,
    [nextLevel]
  );

  if (result.rows.length === 0) return null;
  return rowToAppealLevel(result.rows[0]);
}

/**
 * Calculate appeal deadline from denial date
 */
export async function calculateAppealDeadline(denialDate: Date, appealLevel = 1): Promise<Date> {
  const result = await query<{ time_limit: string }>(
    `SELECT time_limit FROM appeal_levels
     WHERE ${latestFilter("appeal_levels")} AND level = $1
     LIMIT 1`,
    [appealLevel]
  );

  let days: number = MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS;
  const row = result.rows[0];
  if (row?.time_limit) {
    const daysMatch = row.time_limit.match(/(\d+)\s*days/i);
    if (daysMatch) days = parseInt(daysMatch[1], 10);
  }

  const deadline = new Date(denialDate);
  deadline.setDate(deadline.getDate() + days);
  return deadline;
}

/**
 * Get denial reason details by code (CARC code lookup).
 */
export async function getDenialReasonByCode(
  code: string
): Promise<{ code: string; description: string; category: string } | null> {
  const normalized = code.replace(/^(CO|PR|OA|CR|PI)-?/i, "").trim();
  const result = await query<{ code: string; description: string; category: string }>(
    `SELECT code, description, category FROM carc_codes
     WHERE ${latestFilter("carc_codes")} AND code = $1
     LIMIT 1`,
    [normalized]
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { code: row.code, description: row.description, category: row.category || "Unknown" };
}

/**
 * Get appeal strategy for a CARC code.
 */
export async function getAppealStrategyForCARC(carcCode: string): Promise<{
  strategy: string;
  checklist: string[];
  estimatedSuccess: string;
  deadline: number;
  reason: string;
} | null> {
  const result = await query<{
    appeal_strategy: string;
    documentation_checklist: string[] | null;
    estimated_success_rate: string | null;
    appeal_deadline_days: number;
    reason: string;
  }>(
    `SELECT * FROM get_denial_pattern_for_carc($1)`,
    [carcCode]
  );

  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return {
    strategy: row.appeal_strategy,
    checklist: row.documentation_checklist ?? [],
    estimatedSuccess: row.estimated_success_rate || "unknown",
    deadline: row.appeal_deadline_days,
    reason: row.reason,
  };
}

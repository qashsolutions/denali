/**
 * Learning System
 *
 * Implements:
 * - Entity extraction from messages
 * - Confidence-based symptom/procedure mappings
 * - Feedback processing (thumbs up/down)
 * - Prompt injection with learned context
 *
 * Learning Layers:
 * 1. Language - Understand user phrases (symptom_mappings, procedure_mappings)
 * 2. Clinical - Know what gets approved (coverage_paths, appeal_outcomes)
 * 3. Conversation - Optimal question flow (conversation_patterns)
 * 4. Policy - Track Medicare changes (policy_cache)
 * 5. User Behavior - Optimize UX (user_events)
 */

import { query } from "./db";
import {
  CONFIDENCE_CONFIG,
  FEEDBACK_CONFIG,
  PRUNING_CONFIG,
  ENTITY_EXTRACTION_CONFIG,
} from "@/config";

// Types for learning data
export interface SymptomMapping {
  id?: string;
  phrase: string;
  icd10Code: string;
  icd10Description: string;
  confidence: number;
  useCount: number;
  lastUsed: Date;
}

export interface ProcedureMapping {
  id?: string;
  phrase: string;
  cptCode: string;
  cptDescription: string;
  confidence: number;
  useCount: number;
  lastUsed: Date;
}

export interface CoveragePath {
  id?: string;
  icd10Code: string;
  cptCode: string;
  ncdId: string | null;
  lcdId: string | null;
  contractorId: string | null;
  documentationRequired: string[];
  outcome: string;
  useCount: number;
  lastUsedAt: Date;
}

export interface ExtractedEntities {
  symptoms: Array<{ phrase: string; severity?: string; duration?: string }>;
  procedures: Array<{ phrase: string; bodyPart?: string }>;
  medications: string[];
  providers: string[];
  timeframes: string[];
}

export interface LearningContext {
  symptomMappings: SymptomMapping[];
  procedureMappings: ProcedureMapping[];
  coveragePaths: CoveragePath[];
  recentDenials: string[];
  effectiveQuestions: string[];
}

// Entity extraction patterns
const SYMPTOM_PATTERNS = [
  // Pain patterns
  /(?:having|has|feel(?:s|ing)?|experience(?:s|ing)?|suffer(?:s|ing)?(?:\s+from)?)\s+(?:severe\s+|mild\s+|chronic\s+|acute\s+)?(\w+(?:\s+\w+)*)\s*(?:pain|ache|discomfort)/gi,
  /(?:my|her|his|their)\s+(\w+)\s+(?:hurts?|aches?|is\s+(?:sore|painful|aching))/gi,
  /(?:pain|aching|soreness|discomfort)\s+(?:in|of)\s+(?:my|the|her|his)?\s*(\w+(?:\s+\w+)*)/gi,

  // Symptom patterns
  /(?:feel(?:s|ing)?|am|is|are)\s+(?:very\s+|extremely\s+)?(\w+(?:\s+\w+)*?)(?:\s+(?:all\s+the\s+time|constantly|frequently))?/gi,
  /(?:having|has|have)\s+(?:trouble|difficulty|problems?)\s+(?:with\s+)?(\w+(?:ing)?)/gi,
  /(?:can'?t|cannot|unable\s+to)\s+(\w+(?:\s+\w+)*)/gi,

  // Specific symptoms
  /(?:dizzy|dizziness|vertigo|lightheaded)/gi,
  /(?:numb|numbness|tingling|pins\s+and\s+needles)/gi,
  /(?:tired|fatigue|exhausted|weak|weakness)/gi,
  /(?:swollen|swelling|inflammation|inflamed)/gi,
  /(?:short(?:ness)?\s+of\s+breath|breathless|can'?t\s+breathe)/gi,
  /(?:headache|migraine|head\s+pain)/gi,
  /(?:nausea|vomiting|sick\s+to\s+(?:my|the)\s+stomach)/gi,
];

const PROCEDURE_PATTERNS = [
  // Imaging
  /(?:mri|ct\s*scan|x-?ray|ultrasound|imaging|scan)\s*(?:of|for)?\s*(?:the|my|her|his)?\s*(\w+(?:\s+\w+)*)?/gi,
  /(\w+(?:\s+\w+)*)\s*(?:mri|ct\s*scan|x-?ray|ultrasound)/gi,

  // Surgery
  /(\w+(?:\s+\w+)*)\s*(?:surgery|operation|procedure|replacement|repair)/gi,
  /(?:surgery|operation|procedure)\s*(?:on|for)\s*(?:the|my|her|his)?\s*(\w+(?:\s+\w+)*)/gi,

  // Therapy
  /(?:physical\s+therapy|pt|occupational\s+therapy|ot|speech\s+therapy)/gi,

  // Tests
  /(?:blood\s+test|lab\s+work|blood\s+work|screening|colonoscopy|endoscopy|biopsy)/gi,
  /(?:ekg|ecg|echocardiogram|stress\s+test|sleep\s+study)/gi,

  // Treatments
  /(?:injection|infusion|chemo(?:therapy)?|radiation|dialysis)/gi,
];

const MEDICATION_PATTERNS = [
  /(?:taking|on|prescribed|need(?:s)?)\s+(\w+(?:\s+\w+)*?)(?:\s+for|\s*$|,)/gi,
  /(?:medication|drug|medicine)\s+(?:called|named)?\s*(\w+)/gi,
];

const PROVIDER_PATTERNS = [
  /(?:dr\.?|doctor)\s+(\w+(?:\s+\w+)?)/gi,
  /(?:my|her|his|their)\s+(\w+(?:ologist|ist|ian))/gi,
  /(?:see(?:ing)?|visit(?:ing)?|going\s+to)\s+(?:a|the|my)?\s*(\w+(?:ologist|ist|ian))/gi,
];

const TIMEFRAME_PATTERNS = [
  /(?:for|since|about|around|over)\s+(\d+)\s*(days?|weeks?|months?|years?)/gi,
  /(\d+)\s*(days?|weeks?|months?|years?)\s+(?:ago|now|long)/gi,
  /(?:started|began|been)\s+(\d+)\s*(days?|weeks?|months?|years?)\s+ago/gi,
];

const SEVERITY_KEYWORDS = [
  "severe",
  "mild",
  "moderate",
  "extreme",
  "terrible",
  "awful",
  "intense",
  "constant",
  "chronic",
  "acute",
  "occasional",
  "intermittent",
];

/**
 * Extract entities from a message
 */
export function extractEntities(message: string): ExtractedEntities {
  const result: ExtractedEntities = {
    symptoms: [],
    procedures: [],
    medications: [],
    providers: [],
    timeframes: [],
  };

  const lowerMessage = message.toLowerCase();

  // Extract symptoms
  for (const pattern of SYMPTOM_PATTERNS) {
    const matches = message.matchAll(new RegExp(pattern.source, pattern.flags));
    for (const match of matches) {
      const phrase = (match[1] || match[0]).trim().toLowerCase();
      if (phrase.length > 2 && phrase.length < 50) {
        // Check for severity
        const severity = SEVERITY_KEYWORDS.find((s) =>
          lowerMessage.includes(s)
        );

        // Check for duration
        let duration: string | undefined;
        for (const timePattern of TIMEFRAME_PATTERNS) {
          const timeMatch = lowerMessage.match(timePattern);
          if (timeMatch) {
            duration = timeMatch[0];
            break;
          }
        }

        // Avoid duplicates
        if (!result.symptoms.find((s) => s.phrase === phrase)) {
          result.symptoms.push({ phrase, severity, duration });
        }
      }
    }
  }

  // Extract procedures
  for (const pattern of PROCEDURE_PATTERNS) {
    const matches = message.matchAll(new RegExp(pattern.source, pattern.flags));
    for (const match of matches) {
      const phrase = (match[1] || match[0]).trim().toLowerCase();
      if (phrase.length > 2 && phrase.length < 50) {
        // Extract body part if present
        const bodyPartMatch = phrase.match(
          /\b(back|knee|hip|shoulder|neck|spine|lumbar|cervical|thoracic|chest|head|brain|heart|lung|liver|kidney|stomach|abdomen)\b/i
        );
        const bodyPart = bodyPartMatch ? bodyPartMatch[1].toLowerCase() : undefined;

        if (!result.procedures.find((p) => p.phrase === phrase)) {
          result.procedures.push({ phrase, bodyPart });
        }
      }
    }
  }

  // Extract medications
  for (const pattern of MEDICATION_PATTERNS) {
    const matches = message.matchAll(new RegExp(pattern.source, pattern.flags));
    for (const match of matches) {
      const med = (match[1] || "").trim().toLowerCase();
      if (
        med.length > 2 &&
        med.length < 30 &&
        !result.medications.includes(med)
      ) {
        result.medications.push(med);
      }
    }
  }

  // Extract providers
  for (const pattern of PROVIDER_PATTERNS) {
    const matches = message.matchAll(new RegExp(pattern.source, pattern.flags));
    for (const match of matches) {
      const provider = (match[1] || "").trim();
      if (
        provider.length > 2 &&
        provider.length < 50 &&
        !result.providers.includes(provider)
      ) {
        result.providers.push(provider);
      }
    }
  }

  // Extract timeframes
  for (const pattern of TIMEFRAME_PATTERNS) {
    const matches = message.matchAll(new RegExp(pattern.source, pattern.flags));
    for (const match of matches) {
      const timeframe = match[0].trim();
      if (!result.timeframes.includes(timeframe)) {
        result.timeframes.push(timeframe);
      }
    }
  }

  return result;
}

/**
 * Update symptom mapping confidence
 */
export async function updateSymptomMapping(
  phrase: string,
  icd10Code: string,
  icd10Description: string,
  boost: number = FEEDBACK_CONFIG.positiveBoost
): Promise<void> {
  try {
    // Try RPC first
    await query("SELECT update_symptom_mapping($1, $2, $3, $4)", [
      phrase.toLowerCase().trim(),
      icd10Code,
      icd10Description,
      boost,
    ]);
  } catch (err) {
    // Fallback to direct upsert if RPC doesn't exist
    console.warn("RPC not available, using direct upsert:", err);
    await directUpdateSymptomMapping(phrase, icd10Code, icd10Description, boost);
  }
}

/**
 * Direct upsert for symptom mapping (fallback)
 */
async function directUpdateSymptomMapping(
  phrase: string,
  icd10Code: string,
  icd10Description: string,
  boost: number
): Promise<void> {
  const normalizedPhrase = phrase.toLowerCase().trim();

  const existingResult = await query<{ id: string; confidence: number; use_count: number }>(
    `SELECT id, confidence, use_count FROM symptom_mappings WHERE phrase = $1 AND icd10_code = $2 LIMIT 1`,
    [normalizedPhrase, icd10Code]
  );
  const existing = existingResult.rows[0];

  if (existing) {
    await query(
      `UPDATE symptom_mappings SET confidence = $1, use_count = $2, last_used_at = $3 WHERE id = $4`,
      [Math.min(1, existing.confidence + boost), existing.use_count + 1, new Date().toISOString(), existing.id]
    );
  } else {
    await query(
      `INSERT INTO symptom_mappings (phrase, icd10_code, icd10_description, confidence, use_count, last_used_at)
       VALUES ($1, $2, $3, $4, 1, $5)`,
      [normalizedPhrase, icd10Code, icd10Description, CONFIDENCE_CONFIG.initial + boost, new Date().toISOString()]
    );
  }
}

/**
 * Update procedure mapping confidence
 */
export async function updateProcedureMapping(
  phrase: string,
  cptCode: string,
  cptDescription: string,
  boost: number = FEEDBACK_CONFIG.positiveBoost
): Promise<void> {
  try {
    await query("SELECT update_procedure_mapping($1, $2, $3, $4)", [
      phrase.toLowerCase().trim(),
      cptCode,
      cptDescription,
      boost,
    ]);
  } catch (err) {
    console.warn("RPC not available, using direct upsert:", err);
    await directUpdateProcedureMapping(phrase, cptCode, cptDescription, boost);
  }
}

/**
 * Direct upsert for procedure mapping (fallback)
 */
async function directUpdateProcedureMapping(
  phrase: string,
  cptCode: string,
  cptDescription: string,
  boost: number
): Promise<void> {
  const normalizedPhrase = phrase.toLowerCase().trim();

  const existingResult = await query<{ id: string; confidence: number; use_count: number }>(
    `SELECT id, confidence, use_count FROM procedure_mappings WHERE phrase = $1 AND cpt_code = $2 LIMIT 1`,
    [normalizedPhrase, cptCode]
  );
  const existing = existingResult.rows[0];

  if (existing) {
    await query(
      `UPDATE procedure_mappings SET confidence = $1, use_count = $2, last_used_at = $3 WHERE id = $4`,
      [Math.min(1, existing.confidence + boost), existing.use_count + 1, new Date().toISOString(), existing.id]
    );
  } else {
    await query(
      `INSERT INTO procedure_mappings (phrase, cpt_code, cpt_description, confidence, use_count, last_used_at)
       VALUES ($1, $2, $3, $4, 1, $5)`,
      [normalizedPhrase, cptCode, cptDescription, CONFIDENCE_CONFIG.initial + boost, new Date().toISOString()]
    );
  }
}

/**
 * Record a coverage path (successful or failed)
 */
export async function recordCoveragePath(
  icd10Code: string,
  cptCode: string,
  policyRefs: { ncdId?: string; lcdId?: string; contractorId?: string },
  outcome: "approved" | "denied" | "pending",
  documentationRequired?: string[]
): Promise<void> {
  try {
    const existingResult = await query<{ id: string; use_count: number }>(
      `SELECT id, use_count FROM coverage_paths WHERE cpt_code = $1 AND icd10_code = $2 LIMIT 1`,
      [cptCode, icd10Code]
    );
    const existing = existingResult.rows[0];

    if (existing) {
      const params: unknown[] = [outcome, existing.use_count + 1, new Date().toISOString(), existing.id];
      let sql = `UPDATE coverage_paths SET outcome = $1, use_count = $2, last_used_at = $3`;
      if (documentationRequired) {
        sql += `, documentation_required = $5`;
        params.push(JSON.stringify(documentationRequired));
      }
      sql += ` WHERE id = $4`;
      await query(sql, params);
    } else {
      await query(
        `INSERT INTO coverage_paths
           (icd10_code, cpt_code, ncd_id, lcd_id, contractor_id, documentation_required, outcome, use_count, last_used_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 1, $8)`,
        [
          icd10Code,
          cptCode,
          policyRefs.ncdId ?? null,
          policyRefs.lcdId ?? null,
          policyRefs.contractorId ?? null,
          documentationRequired ? JSON.stringify(documentationRequired) : null,
          outcome,
          new Date().toISOString(),
        ]
      );
    }
  } catch (err) {
    console.error("Failed to record coverage path:", err);
  }
}

/**
 * Process user feedback (thumbs up/down)
 */
export async function processFeedback(
  messageId: string,
  rating: "up" | "down",
  conversationContext: {
    symptoms?: string[];
    procedures?: string[];
    icd10Codes?: string[];
    cptCodes?: string[];
  },
  correction?: string
): Promise<void> {
  const boost = rating === "up"
    ? FEEDBACK_CONFIG.positiveBoost
    : -FEEDBACK_CONFIG.negativePenalty;

  // Update symptom mappings
  if (conversationContext.symptoms && conversationContext.icd10Codes) {
    for (const symptom of conversationContext.symptoms) {
      for (const code of conversationContext.icd10Codes) {
        await updateSymptomMapping(symptom, code, "", boost);
      }
    }
  }

  // Update procedure mappings
  if (conversationContext.procedures && conversationContext.cptCodes) {
    for (const procedure of conversationContext.procedures) {
      for (const code of conversationContext.cptCodes) {
        await updateProcedureMapping(procedure, code, "", boost);
      }
    }
  }

  // Store the correction for manual review if provided
  if (correction && rating === "down") {
    await query(
      `INSERT INTO user_feedback (message_id, rating, correction, context, created_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [messageId, rating, correction, JSON.stringify(conversationContext), new Date().toISOString()]
    );
  }
}

/**
 * Get high-confidence symptom mappings for a phrase
 */
export async function getSymptomMappings(
  phrase: string,
  minConfidence: number = CONFIDENCE_CONFIG.minForPrompt
): Promise<SymptomMapping[]> {
  const normalizedPhrase = phrase.toLowerCase().trim();

  try {
    const result = await query<{
      id: string;
      phrase: string;
      icd10_code: string;
      icd10_description: string | null;
      confidence: number;
      use_count: number;
      last_used_at: string;
    }>(
      `SELECT id, phrase, icd10_code, icd10_description, confidence, use_count, last_used_at
       FROM symptom_mappings
       WHERE phrase ILIKE $1 AND confidence >= $2
       ORDER BY confidence DESC
       LIMIT 5`,
      [`%${normalizedPhrase}%`, minConfidence]
    );

    return result.rows.map((row) => ({
      id: row.id,
      phrase: row.phrase,
      icd10Code: row.icd10_code,
      icd10Description: row.icd10_description || "",
      confidence: row.confidence,
      useCount: row.use_count,
      lastUsed: new Date(row.last_used_at),
    }));
  } catch (err) {
    console.error("Failed to get symptom mappings:", err);
    return [];
  }
}

/**
 * Get high-confidence procedure mappings for a phrase
 */
export async function getProcedureMappings(
  phrase: string,
  minConfidence: number = CONFIDENCE_CONFIG.minForPrompt
): Promise<ProcedureMapping[]> {
  const normalizedPhrase = phrase.toLowerCase().trim();

  try {
    const result = await query<{
      id: string;
      phrase: string;
      cpt_code: string;
      cpt_description: string | null;
      confidence: number;
      use_count: number;
      last_used_at: string;
    }>(
      `SELECT id, phrase, cpt_code, cpt_description, confidence, use_count, last_used_at
       FROM procedure_mappings
       WHERE phrase ILIKE $1 AND confidence >= $2
       ORDER BY confidence DESC
       LIMIT 5`,
      [`%${normalizedPhrase}%`, minConfidence]
    );

    return result.rows.map((row) => ({
      id: row.id,
      phrase: row.phrase,
      cptCode: row.cpt_code,
      cptDescription: row.cpt_description || "",
      confidence: row.confidence,
      useCount: row.use_count,
      lastUsed: new Date(row.last_used_at),
    }));
  } catch (err) {
    console.error("Failed to get procedure mappings:", err);
    return [];
  }
}

/**
 * Get successful coverage paths for a procedure
 */
export async function getSuccessfulCoveragePaths(
  cptCode: string
): Promise<CoveragePath[]> {
  try {
    const result = await query<{
      id: string;
      icd10_code: string;
      cpt_code: string;
      ncd_id: string | null;
      lcd_id: string | null;
      contractor_id: string | null;
      documentation_required: unknown;
      outcome: string;
      use_count: number;
      last_used_at: string;
    }>(
      `SELECT id, icd10_code, cpt_code, ncd_id, lcd_id, contractor_id, documentation_required, outcome, use_count, last_used_at
       FROM coverage_paths
       WHERE cpt_code = $1 AND outcome = 'approved'
       ORDER BY use_count DESC
       LIMIT 10`,
      [cptCode]
    );

    return result.rows.map((row) => ({
      id: row.id,
      icd10Code: row.icd10_code,
      cptCode: row.cpt_code,
      ncdId: row.ncd_id,
      lcdId: row.lcd_id,
      contractorId: row.contractor_id,
      documentationRequired: Array.isArray(row.documentation_required)
        ? (row.documentation_required as string[])
        : [],
      outcome: row.outcome,
      useCount: row.use_count,
      lastUsedAt: new Date(row.last_used_at),
    }));
  } catch (err) {
    console.error("Failed to get coverage paths:", err);
    return [];
  }
}

/**
 * Get learning context for prompt injection
 */
export async function getLearningContext(
  symptoms: string[],
  procedures: string[]
): Promise<LearningContext> {
  const context: LearningContext = {
    symptomMappings: [],
    procedureMappings: [],
    coveragePaths: [],
    recentDenials: [],
    effectiveQuestions: [],
  };

  // Get symptom mappings
  for (const symptom of symptoms) {
    const mappings = await getSymptomMappings(symptom);
    context.symptomMappings.push(...mappings);
  }

  // Get procedure mappings
  for (const procedure of procedures) {
    const mappings = await getProcedureMappings(procedure);
    context.procedureMappings.push(...mappings);

    // Get coverage paths for mapped CPT codes
    for (const mapping of mappings) {
      const paths = await getSuccessfulCoveragePaths(mapping.cptCode);
      context.coveragePaths.push(...paths);
    }
  }

  // Get recent denials from coverage paths
  try {
    const denialsResult = await query<{ cpt_code: string; icd10_code: string }>(
      `SELECT cpt_code, icd10_code FROM coverage_paths WHERE outcome = 'denied' ORDER BY last_used_at DESC LIMIT 5`
    );
    context.recentDenials = denialsResult.rows.map(
      (d) => `${d.cpt_code} with ${d.icd10_code}`
    );
  } catch (err) {
    console.error("Failed to get recent denials:", err);
  }

  return context;
}

/**
 * Build prompt injection text from learning context
 */
export function buildLearningPromptInjection(context: LearningContext): string {
  const sections: string[] = [];

  // Add symptom mappings
  if (context.symptomMappings.length > 0) {
    const mappingLines = context.symptomMappings
      .slice(0, 5)
      .map(
        (m) =>
          `- "${m.phrase}" → ${m.icd10Code} (${Math.round(m.confidence * 100)}% confidence)`
      );
    sections.push(
      `## Learned Symptom Mappings\n${mappingLines.join("\n")}`
    );
  }

  // Add procedure mappings
  if (context.procedureMappings.length > 0) {
    const mappingLines = context.procedureMappings
      .slice(0, 5)
      .map(
        (m) =>
          `- "${m.phrase}" → ${m.cptCode} (${Math.round(m.confidence * 100)}% confidence)`
      );
    sections.push(
      `## Learned Procedure Mappings\n${mappingLines.join("\n")}`
    );
  }

  // Add successful coverage paths
  if (context.coveragePaths.length > 0) {
    const pathLines = context.coveragePaths.slice(0, 3).map((p) => {
      const policyRef = p.ncdId ? `NCD ${p.ncdId}` : p.lcdId ? `LCD ${p.lcdId}` : "";
      return `- ${p.cptCode} with ${p.icd10Code}${policyRef ? ` (${policyRef})` : ""} → used ${p.useCount} times`;
    });
    sections.push(
      `## Successful Coverage Paths\n${pathLines.join("\n")}`
    );
  }

  // Add denial warnings
  if (context.recentDenials.length > 0) {
    sections.push(
      `## Recent Denials to Avoid\n${context.recentDenials.map((d) => `- ${d}`).join("\n")}`
    );
  }

  if (sections.length === 0) {
    return "";
  }

  return `\n\n---\n\n## Learned Knowledge (Use to guide responses)\n\n${sections.join("\n\n")}`;
}

/**
 * Queue a learning job for background processing
 */
export async function queueLearningJob(
  jobType: "extract_entities" | "update_mappings" | "analyze_patterns",
  jobData: Record<string, unknown>
): Promise<void> {
  try {
    await query(
      `INSERT INTO learning_queue (job_type, job_data, status) VALUES ($1, $2, 'pending')`,
      [jobType, JSON.stringify(jobData)]
    );
  } catch (err) {
    console.error("Failed to queue learning job:", err);
  }
}

/**
 * Prune low-confidence mappings (for batch processing)
 */
export async function pruneLowConfidenceMappings(
  minConfidence: number = CONFIDENCE_CONFIG.minBeforePrune,
  maxAge: number = PRUNING_CONFIG.maxAgeDays
): Promise<{ symptoms: number; procedures: number }> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAge);
  const cutoffIso = cutoffDate.toISOString();

  // Count + delete symptoms
  const symptomCountResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM symptom_mappings WHERE confidence < $1 AND last_used_at < $2`,
    [minConfidence, cutoffIso]
  );
  const symptomCount = parseInt(symptomCountResult.rows[0]?.count ?? "0");
  await query(
    `DELETE FROM symptom_mappings WHERE confidence < $1 AND last_used_at < $2`,
    [minConfidence, cutoffIso]
  );

  // Count + delete procedures
  const procedureCountResult = await query<{ count: string }>(
    `SELECT COUNT(*) as count FROM procedure_mappings WHERE confidence < $1 AND last_used_at < $2`,
    [minConfidence, cutoffIso]
  );
  const procedureCount = parseInt(procedureCountResult.rows[0]?.count ?? "0");
  await query(
    `DELETE FROM procedure_mappings WHERE confidence < $1 AND last_used_at < $2`,
    [minConfidence, cutoffIso]
  );

  return { symptoms: symptomCount, procedures: procedureCount };
}

// =============================================================================
// FLYWHEEL INTELLIGENCE
// =============================================================================

export interface FlywheelContext {
  carc_code: string;
  total_cases: number;
  success_rate: number;
  avg_days: number | null;
  approved: number;
  denied: number;
}

/**
 * Get flywheel outcome data for specific CPT + CARC combinations.
 * Returns aggregated success rates and resolution times.
 */
export async function getFlywheelContext(
  cptCodes: string[],
  carcCodes: string[]
): Promise<FlywheelContext[]> {
  if (!cptCodes.length) return [];

  try {
    const result = await query<Record<string, unknown>>(
      `SELECT * FROM get_flywheel_context($1, $2)`,
      [cptCodes, carcCodes.length > 0 ? carcCodes : []]
    );

    return result.rows.map((row) => ({
      carc_code: String(row.carc_code || ""),
      total_cases: Number(row.total_cases) || 0,
      success_rate: Number(row.success_rate) || 0,
      avg_days: row.avg_days !== null ? Number(row.avg_days) : null,
      approved: Number(row.approved) || 0,
      denied: Number(row.denied) || 0,
    }));
  } catch (err) {
    console.warn("Failed to get flywheel context:", err);
    return [];
  }
}

/**
 * Build system prompt injection from flywheel data.
 * Only includes data when we have enough cases (>=3) for reliability.
 */
export function buildFlywheelPromptInjection(
  context: FlywheelContext[]
): string {
  if (!context.length) return "";

  // Cap at 20 entries to prevent unbounded prompt growth
  const capped = context.slice(0, 20);
  const totalCases = capped.reduce((s, c) => s + c.total_cases, 0);

  const lines = capped.map((c) => {
    let line = `- CARC ${c.carc_code}: ${c.total_cases} cases, ${c.success_rate}% success rate`;
    if (c.avg_days !== null) {
      line += `, avg ${c.avg_days} days to resolution`;
    }
    return line;
  });

  return `

---

## Real Outcome Data (from ${totalCases} cases)

${lines.join("\n")}

Use this data to:
- Tell the user their likely success rate for this type of appeal
- Set realistic timeline expectations
- Recommend arguments that have worked in similar cases
- Warn about common documentation gaps that lead to denial
`;
}

// =============================================================================
// OUTCOME INCENTIVE
// =============================================================================

/**
 * Check if user has an unredeemed outcome incentive (reported outcome but no credit yet)
 */
export async function checkOutcomeIncentive(email: string): Promise<boolean> {
  try {
    const result = await query<{ id: string }>(
      `SELECT id FROM outcome_followups
       WHERE email = $1 AND responded_at IS NOT NULL AND incentive_applied = false
       LIMIT 1`,
      [email]
    );
    return result.rows.length > 0;
  } catch (err) {
    console.error("Failed to check outcome incentive:", err);
    return false;
  }
}

/**
 * Apply outcome incentive: decrement appeal_count by 1 (gives a free appeal)
 */
export async function applyOutcomeIncentive(email: string): Promise<boolean> {
  try {
    const result = await query<{ apply_outcome_incentive: boolean }>(
      `SELECT apply_outcome_incentive($1)`,
      [email]
    );
    return !!result.rows[0]?.apply_outcome_incentive;
  } catch (err) {
    console.error("Failed to apply outcome incentive:", err);
    return false;
  }
}

/**
 * Record appeal outcome for learning
 * This data helps improve coverage path recommendations
 */
export async function recordAppealOutcome(
  appealId: string,
  outcome: "approved" | "denied" | "partial",
  details?: {
    denialReason?: string;
    approvalNotes?: string;
    daysToDecision?: number;
  }
): Promise<boolean> {
  try {
    // Get the appeal to find associated codes
    const appealResult = await query<{
      icd10_codes: string[] | null;
      cpt_codes: string[] | null;
      ncd_refs: string[] | null;
      lcd_refs: string[] | null;
    }>(
      `SELECT icd10_codes, cpt_codes, ncd_refs, lcd_refs FROM appeals WHERE id = $1 LIMIT 1`,
      [appealId]
    );
    const appeal = appealResult.rows[0];

    if (!appeal) {
      console.error("Failed to get appeal:", appealId);
      return false;
    }

    // Update the appeal with outcome
    const appealStatus = outcome === "approved" ? "approved" : outcome === "denied" ? "denied" : "partial";
    await query(
      `UPDATE appeals SET status = $1, outcome_reported_at = $2, outcome_details = $3 WHERE id = $4`,
      [appealStatus, new Date().toISOString(), details ? JSON.stringify(details) : null, appealId]
    );

    // Update coverage paths based on outcome
    if (appeal.icd10_codes?.length && appeal.cpt_codes?.length) {
      const icd10 = appeal.icd10_codes[0];
      const cpt = appeal.cpt_codes[0];

      const existingResult = await query<{ id: string; use_count: number }>(
        `SELECT id, use_count FROM coverage_paths WHERE icd10_code = $1 AND cpt_code = $2 LIMIT 1`,
        [icd10, cpt]
      );
      const existing = existingResult.rows[0];

      if (existing) {
        await query(
          `UPDATE coverage_paths SET outcome = $1, use_count = $2, last_used_at = $3 WHERE id = $4`,
          [outcome, existing.use_count + 1, new Date().toISOString(), existing.id]
        );
      } else {
        await query(
          `INSERT INTO coverage_paths (icd10_code, cpt_code, ncd_id, lcd_id, outcome, use_count, last_used_at)
           VALUES ($1, $2, $3, $4, $5, 1, $6)`,
          [
            icd10,
            cpt,
            appeal.ncd_refs?.[0] ?? null,
            appeal.lcd_refs?.[0] ?? null,
            outcome,
            new Date().toISOString(),
          ]
        );
      }
    }

    return true;
  } catch (err) {
    console.error("Failed to record appeal outcome:", err);
    return false;
  }
}

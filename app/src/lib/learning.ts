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

import { createClient } from "./supabase";
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
  const supabase = createClient();

  try {
    // Use RPC function if available, otherwise direct upsert
    const { error } = await supabase.rpc("update_symptom_mapping", {
      p_phrase: phrase.toLowerCase().trim(),
      p_icd10_code: icd10Code,
      p_icd10_description: icd10Description,
      p_boost: boost,
    });

    if (error) {
      // Fallback to direct upsert if RPC doesn't exist
      console.warn("RPC not available, using direct upsert:", error.message);
      await directUpdateSymptomMapping(
        phrase,
        icd10Code,
        icd10Description,
        boost
      );
    }
  } catch (err) {
    console.error("Failed to update symptom mapping:", err);
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
  const supabase = createClient();
  const normalizedPhrase = phrase.toLowerCase().trim();

  // Check if mapping exists
  const { data: existing } = await supabase
    .from("symptom_mappings")
    .select("*")
    .eq("phrase", normalizedPhrase)
    .eq("icd10_code", icd10Code)
    .single();

  if (existing) {
    // Update existing
    const newConfidence = Math.min(1, existing.confidence + boost);
    await supabase
      .from("symptom_mappings")
      .update({
        confidence: newConfidence,
        use_count: existing.use_count + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    // Insert new
    await supabase.from("symptom_mappings").insert({
      phrase: normalizedPhrase,
      icd10_code: icd10Code,
      icd10_description: icd10Description,
      confidence: CONFIDENCE_CONFIG.initial + boost,
      use_count: 1,
      last_used_at: new Date().toISOString(),
    });
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
  const supabase = createClient();

  try {
    const { error } = await supabase.rpc("update_procedure_mapping", {
      p_phrase: phrase.toLowerCase().trim(),
      p_cpt_code: cptCode,
      p_cpt_description: cptDescription,
      p_boost: boost,
    });

    if (error) {
      console.warn("RPC not available, using direct upsert:", error.message);
      await directUpdateProcedureMapping(phrase, cptCode, cptDescription, boost);
    }
  } catch (err) {
    console.error("Failed to update procedure mapping:", err);
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
  const supabase = createClient();
  const normalizedPhrase = phrase.toLowerCase().trim();

  const { data: existing } = await supabase
    .from("procedure_mappings")
    .select("*")
    .eq("phrase", normalizedPhrase)
    .eq("cpt_code", cptCode)
    .single();

  if (existing) {
    const newConfidence = Math.min(1, existing.confidence + boost);
    await supabase
      .from("procedure_mappings")
      .update({
        confidence: newConfidence,
        use_count: existing.use_count + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("procedure_mappings").insert({
      phrase: normalizedPhrase,
      cpt_code: cptCode,
      cpt_description: cptDescription,
      confidence: CONFIDENCE_CONFIG.initial + boost,
      use_count: 1,
      last_used_at: new Date().toISOString(),
    });
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
  const supabase = createClient();

  try {
    const { data: existing } = await supabase
      .from("coverage_paths")
      .select("*")
      .eq("cpt_code", cptCode)
      .eq("icd10_code", icd10Code)
      .single();

    if (existing) {
      const updates: Record<string, unknown> = {
        outcome,
        use_count: existing.use_count + 1,
        last_used_at: new Date().toISOString(),
      };

      if (documentationRequired) {
        updates.documentation_required = documentationRequired;
      }

      await supabase.from("coverage_paths").update(updates).eq("id", existing.id);
    } else {
      await supabase.from("coverage_paths").insert({
        icd10_code: icd10Code,
        cpt_code: cptCode,
        ncd_id: policyRefs.ncdId || null,
        lcd_id: policyRefs.lcdId || null,
        contractor_id: policyRefs.contractorId || null,
        documentation_required: documentationRequired || null,
        outcome,
        use_count: 1,
        last_used_at: new Date().toISOString(),
      });
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
    const supabase = createClient();
    await supabase.from("user_feedback").insert({
      message_id: messageId,
      rating,
      correction,
      context: conversationContext,
      created_at: new Date().toISOString(),
    });
  }
}

/**
 * Get high-confidence symptom mappings for a phrase
 */
export async function getSymptomMappings(
  phrase: string,
  minConfidence: number = CONFIDENCE_CONFIG.minForPrompt
): Promise<SymptomMapping[]> {
  const supabase = createClient();
  const normalizedPhrase = phrase.toLowerCase().trim();

  const { data, error } = await supabase
    .from("symptom_mappings")
    .select("*")
    .ilike("phrase", `%${normalizedPhrase}%`)
    .gte("confidence", minConfidence)
    .order("confidence", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Failed to get symptom mappings:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    phrase: row.phrase,
    icd10Code: row.icd10_code,
    icd10Description: row.icd10_description || "",
    confidence: row.confidence,
    useCount: row.use_count,
    lastUsed: new Date(row.last_used_at),
  }));
}

/**
 * Get high-confidence procedure mappings for a phrase
 */
export async function getProcedureMappings(
  phrase: string,
  minConfidence: number = CONFIDENCE_CONFIG.minForPrompt
): Promise<ProcedureMapping[]> {
  const supabase = createClient();
  const normalizedPhrase = phrase.toLowerCase().trim();

  const { data, error } = await supabase
    .from("procedure_mappings")
    .select("*")
    .ilike("phrase", `%${normalizedPhrase}%`)
    .gte("confidence", minConfidence)
    .order("confidence", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Failed to get procedure mappings:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    phrase: row.phrase,
    cptCode: row.cpt_code,
    cptDescription: row.cpt_description || "",
    confidence: row.confidence,
    useCount: row.use_count,
    lastUsed: new Date(row.last_used_at),
  }));
}

/**
 * Get successful coverage paths for a procedure
 */
export async function getSuccessfulCoveragePaths(
  cptCode: string
): Promise<CoveragePath[]> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("coverage_paths")
    .select("*")
    .eq("cpt_code", cptCode)
    .eq("outcome", "approved")
    .order("use_count", { ascending: false })
    .limit(10);

  if (error) {
    console.error("Failed to get coverage paths:", error);
    return [];
  }

  return (data || []).map((row) => ({
    id: row.id,
    icd10Code: row.icd10_code,
    cptCode: row.cpt_code,
    ncdId: row.ncd_id,
    lcdId: row.lcd_id,
    contractorId: row.contractor_id,
    documentationRequired: row.documentation_required || [],
    outcome: row.outcome,
    useCount: row.use_count,
    lastUsedAt: new Date(row.last_used_at),
  }));
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
  const supabase = createClient();
  const { data: denials } = await supabase
    .from("coverage_paths")
    .select("cpt_code, icd10_code")
    .eq("outcome", "denied")
    .order("last_used_at", { ascending: false })
    .limit(5);

  if (denials) {
    context.recentDenials = denials.map(
      (d) => `${d.cpt_code} with ${d.icd10_code}`
    );
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
  const supabase = createClient();

  try {
    await supabase.from("learning_queue").insert({
      job_type: jobType,
      job_data: jobData as unknown as Record<string, never>,
      status: "pending",
    });
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
  const supabase = createClient();
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAge);

  // Count before delete for symptoms
  const { count: symptomCount } = await supabase
    .from("symptom_mappings")
    .select("*", { count: "exact", head: true })
    .lt("confidence", minConfidence)
    .lt("last_used_at", cutoffDate.toISOString());

  // Delete symptoms
  await supabase
    .from("symptom_mappings")
    .delete()
    .lt("confidence", minConfidence)
    .lt("last_used_at", cutoffDate.toISOString());

  // Count before delete for procedures
  const { count: procedureCount } = await supabase
    .from("procedure_mappings")
    .select("*", { count: "exact", head: true })
    .lt("confidence", minConfidence)
    .lt("last_used_at", cutoffDate.toISOString());

  // Delete procedures
  await supabase
    .from("procedure_mappings")
    .delete()
    .lt("confidence", minConfidence)
    .lt("last_used_at", cutoffDate.toISOString());

  return {
    symptoms: symptomCount || 0,
    procedures: procedureCount || 0,
  };
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
  const supabase = createClient();

  try {
    // Get the appeal to find associated codes
    const { data: appeal, error: appealError } = await supabase
      .from("appeals")
      .select("icd10_codes, cpt_codes, ncd_refs, lcd_refs")
      .eq("id", appealId)
      .single();

    if (appealError || !appeal) {
      console.error("Failed to get appeal:", appealError);
      return false;
    }

    // Update the appeal with outcome
    const { error: updateError } = await supabase
      .from("appeals")
      .update({
        status: outcome === "approved" ? "approved" : outcome === "denied" ? "denied" : "partial",
        outcome_reported_at: new Date().toISOString(),
        outcome_details: details,
      })
      .eq("id", appealId);

    if (updateError) {
      console.error("Failed to update appeal:", updateError);
      return false;
    }

    // Update coverage paths based on outcome
    if (appeal.icd10_codes?.length && appeal.cpt_codes?.length) {
      const icd10 = appeal.icd10_codes[0];
      const cpt = appeal.cpt_codes[0];

      // Find existing coverage path
      const { data: existing } = await supabase
        .from("coverage_paths")
        .select("*")
        .eq("icd10_code", icd10)
        .eq("cpt_code", cpt)
        .single();

      if (existing) {
        // Update with outcome
        await supabase
          .from("coverage_paths")
          .update({
            outcome: outcome,
            use_count: existing.use_count + 1,
            last_used_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        // Create new coverage path
        await supabase.from("coverage_paths").insert({
          icd10_code: icd10,
          cpt_code: cpt,
          ncd_id: appeal.ncd_refs?.[0] || null,
          lcd_id: appeal.lcd_refs?.[0] || null,
          outcome: outcome,
          use_count: 1,
          last_used_at: new Date().toISOString(),
        });
      }
    }

    return true;
  } catch (err) {
    console.error("Failed to record appeal outcome:", err);
    return false;
  }
}

/**
 * Process Learning Queue Edge Function
 *
 * POST /functions/v1/process-learning-queue
 *
 * Background job processor for learning queue.
 * Should be called periodically via cron (e.g., every hour).
 *
 * Tasks:
 * 1. Process pending learning jobs
 * 2. Update symptom/procedure mappings
 * 3. Prune low-confidence mappings (nightly)
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";

const BATCH_SIZE = 50;

serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results = {
      jobsProcessed: 0,
      symptomMappingsUpdated: 0,
      procedureMappingsUpdated: 0,
      entriesPruned: 0,
      errors: [] as string[],
    };

    // 1. Fetch pending jobs
    const { data: jobs, error: jobsError } = await supabase
      .from("learning_queue")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (jobsError) {
      console.error("Failed to fetch jobs:", jobsError);
      results.errors.push(`Fetch jobs: ${jobsError.message}`);
    }

    // 2. Process each job
    if (jobs && jobs.length > 0) {
      for (const job of jobs) {
        try {
          await processJob(supabase, job, results);

          // Mark job as completed
          await supabase
            .from("learning_queue")
            .update({ status: "completed", processed_at: new Date().toISOString() })
            .eq("id", job.id);

          results.jobsProcessed++;
        } catch (jobError) {
          console.error(`Job ${job.id} failed:`, jobError);
          results.errors.push(`Job ${job.id}: ${jobError}`);

          // Mark job as failed
          await supabase
            .from("learning_queue")
            .update({
              status: "failed",
              error: jobError instanceof Error ? jobError.message : String(jobError)
            })
            .eq("id", job.id);
        }
      }
    }

    // 3. Nightly pruning (check if it's between 2-3 AM UTC)
    const hour = new Date().getUTCHours();
    if (hour === 2) {
      try {
        const pruneResult = await pruneLowConfidenceMappings(supabase);
        results.entriesPruned = pruneResult.symptoms + pruneResult.procedures;
      } catch (pruneError) {
        console.error("Pruning failed:", pruneError);
        results.errors.push(`Pruning: ${pruneError}`);
      }
    }

    return jsonResponse({
      success: true,
      ...results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Process learning queue error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Processing failed",
      500
    );
  }
});

/**
 * Process a single learning job
 */
async function processJob(
  supabase: ReturnType<typeof createClient>,
  job: { id: string; job_type: string; job_data: Record<string, unknown> },
  results: { symptomMappingsUpdated: number; procedureMappingsUpdated: number }
): Promise<void> {
  const { job_type, job_data } = job;

  switch (job_type) {
    case "extract_entities": {
      const symptoms = (job_data.symptoms as Array<{ phrase: string }>) || [];
      const procedures = (job_data.procedures as Array<{ phrase: string }>) || [];

      // Just log for now - actual mapping happens when codes are found
      console.log(`Extracted ${symptoms.length} symptoms, ${procedures.length} procedures`);
      break;
    }

    case "update_symptom_mapping": {
      const { phrase, icd10_code, icd10_description, boost } = job_data as {
        phrase: string;
        icd10_code: string;
        icd10_description: string;
        boost: number;
      };

      await upsertSymptomMapping(supabase, phrase, icd10_code, icd10_description, boost);
      results.symptomMappingsUpdated++;
      break;
    }

    case "update_procedure_mapping": {
      const { phrase, cpt_code, cpt_description, boost } = job_data as {
        phrase: string;
        cpt_code: string;
        cpt_description: string;
        boost: number;
      };

      await upsertProcedureMapping(supabase, phrase, cpt_code, cpt_description, boost);
      results.procedureMappingsUpdated++;
      break;
    }

    case "process_feedback": {
      const { message_id, rating, symptoms, procedures, icd10_codes, cpt_codes } = job_data as {
        message_id: string;
        rating: "up" | "down";
        symptoms: string[];
        procedures: string[];
        icd10_codes: string[];
        cpt_codes: string[];
      };

      const boost = rating === "up" ? 0.1 : -0.15;

      // Update symptom mappings
      for (const symptom of symptoms || []) {
        for (const code of icd10_codes || []) {
          await upsertSymptomMapping(supabase, symptom, code, "", boost);
          results.symptomMappingsUpdated++;
        }
      }

      // Update procedure mappings
      for (const procedure of procedures || []) {
        for (const code of cpt_codes || []) {
          await upsertProcedureMapping(supabase, procedure, code, "", boost);
          results.procedureMappingsUpdated++;
        }
      }
      break;
    }

    default:
      console.warn(`Unknown job type: ${job_type}`);
  }
}

/**
 * Upsert a symptom mapping
 */
async function upsertSymptomMapping(
  supabase: ReturnType<typeof createClient>,
  phrase: string,
  icd10Code: string,
  icd10Description: string,
  boost: number
): Promise<void> {
  const normalizedPhrase = phrase.toLowerCase().trim();

  const { data: existing } = await supabase
    .from("symptom_mappings")
    .select("*")
    .eq("phrase", normalizedPhrase)
    .eq("icd10_code", icd10Code)
    .single();

  if (existing) {
    const newConfidence = Math.max(0, Math.min(1, existing.confidence + boost));
    await supabase
      .from("symptom_mappings")
      .update({
        confidence: newConfidence,
        use_count: existing.use_count + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else if (boost > 0) {
    // Only create new mappings for positive boosts
    await supabase.from("symptom_mappings").insert({
      phrase: normalizedPhrase,
      icd10_code: icd10Code,
      icd10_description: icd10Description,
      confidence: 0.5 + boost,
      use_count: 1,
      last_used_at: new Date().toISOString(),
    });
  }
}

/**
 * Upsert a procedure mapping
 */
async function upsertProcedureMapping(
  supabase: ReturnType<typeof createClient>,
  phrase: string,
  cptCode: string,
  cptDescription: string,
  boost: number
): Promise<void> {
  const normalizedPhrase = phrase.toLowerCase().trim();

  const { data: existing } = await supabase
    .from("procedure_mappings")
    .select("*")
    .eq("phrase", normalizedPhrase)
    .eq("cpt_code", cptCode)
    .single();

  if (existing) {
    const newConfidence = Math.max(0, Math.min(1, existing.confidence + boost));
    await supabase
      .from("procedure_mappings")
      .update({
        confidence: newConfidence,
        use_count: existing.use_count + 1,
        last_used_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
  } else if (boost > 0) {
    await supabase.from("procedure_mappings").insert({
      phrase: normalizedPhrase,
      cpt_code: cptCode,
      cpt_description: cptDescription,
      confidence: 0.5 + boost,
      use_count: 1,
      last_used_at: new Date().toISOString(),
    });
  }
}

/**
 * Prune low-confidence and old mappings
 */
async function pruneLowConfidenceMappings(
  supabase: ReturnType<typeof createClient>
): Promise<{ symptoms: number; procedures: number }> {
  const minConfidence = 0.3;
  const maxAgeDays = 90;

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - maxAgeDays);

  // Count and delete symptoms
  const { count: symptomCount } = await supabase
    .from("symptom_mappings")
    .select("*", { count: "exact", head: true })
    .lt("confidence", minConfidence)
    .lt("last_used_at", cutoffDate.toISOString());

  await supabase
    .from("symptom_mappings")
    .delete()
    .lt("confidence", minConfidence)
    .lt("last_used_at", cutoffDate.toISOString());

  // Count and delete procedures
  const { count: procedureCount } = await supabase
    .from("procedure_mappings")
    .select("*", { count: "exact", head: true })
    .lt("confidence", minConfidence)
    .lt("last_used_at", cutoffDate.toISOString());

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

/**
 * Refresh Flywheel Metrics Edge Function
 *
 * Nightly cron job that refreshes the flywheel_metrics materialized view.
 * This aggregates all appeal outcome data for fast prompt injection.
 *
 * Pattern follows process-learning-queue.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Use service role key for admin access
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Refresh the materialized view
    const { error: refreshError } = await supabase.rpc("refresh_flywheel_metrics");

    if (refreshError) {
      console.error("Failed to refresh flywheel metrics:", refreshError);
      return errorResponse("Failed to refresh metrics", 500);
    }

    // Get some basic stats for logging
    const { data: stats } = await supabase
      .from("flywheel_metrics")
      .select("case_count")
      .limit(1000);

    const totalRows = stats?.length || 0;
    const totalCases = stats?.reduce((sum, r) => sum + Number(r.case_count), 0) || 0;

    console.log(`Flywheel metrics refreshed: ${totalRows} rows, ${totalCases} total cases`);

    return jsonResponse({
      success: true,
      rows: totalRows,
      totalCases,
      refreshedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Refresh flywheel metrics error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to refresh metrics",
      500
    );
  }
});

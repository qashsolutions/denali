/**
 * Diabetes Insights API Route
 *
 * GET  /api/diabetes/insights  — return stored insight
 * POST /api/diabetes/insights  — trigger regeneration
 *
 * Auth + health_data_ai consent required for POST.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
import { logAudit } from "@/lib/audit";
import {
  generateDiabetesInsight,
  computeDataHash,
  type InsightInput,
} from "@/lib/diabetes-insights";
import type { Json } from "@/types/database";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: insight } = await supabase
      .from("diabetes_insights")
      .select("*")
      .eq("user_id", user.id)
      .single();

    return NextResponse.json({ insight: insight ?? null });
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check health_data_ai consent
    const { data: consentRows } = await supabase
      .from("consent_preferences")
      .select("granted")
      .eq("user_id", user.id)
      .eq("consent_type", "health_data_ai");

    const hasConsent = consentRows?.some((r) => r.granted);
    if (!hasConsent) {
      return NextResponse.json({ error: "Health data AI consent required" }, { status: 403 });
    }

    // Gather data
    const admin = createAdminClient();

    const [snapshotsRes, cacheRes, logRes] = await Promise.all([
      supabase
        .from("diabetes_snapshots")
        .select("loinc_code, lab_name, value, unit, observed_date")
        .order("observed_date", { ascending: true }),
      supabase
        .from("fhir_cache")
        .select("resource_type, data")
        .eq("user_id", user.id),
      supabase
        .from("diabetes_log")
        .select("entry_type, logged_at, glucose_value, activity_minutes, note")
        .eq("user_id", user.id)
        .order("logged_at", { ascending: false })
        .limit(10),
    ]);

    // Parse FHIR cache
    type CacheRow = { resource_type: string; data: Json };
    const cacheMap = new Map<string, Json>();
    for (const row of (cacheRes.data ?? []) as CacheRow[]) {
      cacheMap.set(row.resource_type, row.data);
    }

    const labs = (cacheMap.get("labs") as Array<{ name: string; value: number; unit: string; date: string }>) ?? [];
    const conditions = (cacheMap.get("conditions") as Array<{ code: string; name: string; category: string }>) ?? [];
    const medications = (cacheMap.get("medications") as Array<{ name: string; status: string; isDiabetesMed: boolean }>) ?? [];

    // Build a1c history from snapshots
    const a1cHistory = (snapshotsRes.data ?? [])
      .filter((r) => r.lab_name.toLowerCase().includes("a1c"))
      .map((r) => ({ date: r.observed_date, value: Number(r.value) }));

    // Classify
    const { classifyDiabetesStatus } = await import("@/lib/fhir/transforms");
    const { classification } = classifyDiabetesStatus(
      conditions as Parameters<typeof classifyDiabetesStatus>[0],
      labs as Parameters<typeof classifyDiabetesStatus>[1],
      medications as Parameters<typeof classifyDiabetesStatus>[2]
    );

    const inputData: InsightInput = {
      classification,
      a1cHistory,
      labs,
      conditions,
      medications,
      recentLogEntries: (logRes.data ?? []).map((e) => ({
        entry_type: e.entry_type,
        logged_at: e.logged_at,
        glucose_value: e.glucose_value ? Number(e.glucose_value) : null,
        activity_minutes: e.activity_minutes,
        note: e.note,
      })),
    };

    const dataHash = computeDataHash(inputData);

    // Check if existing insight has same hash (skip regeneration)
    const { data: existing } = await supabase
      .from("diabetes_insights")
      .select("id, data_hash, summary, recommendations, risk_alerts, screening_reminders, generated_at")
      .eq("user_id", user.id)
      .single();

    if (existing && existing.data_hash === dataHash) {
      return NextResponse.json({ insight: existing, cached: true });
    }

    // Generate new insight
    const output = await generateDiabetesInsight(inputData);
    const now = new Date().toISOString();

    const insightRow = {
      user_id: user.id,
      classification,
      summary: output.summary,
      recommendations: output.recommendations as unknown as Json,
      risk_alerts: output.riskAlerts as unknown as Json,
      screening_reminders: output.screeningReminders as unknown as Json,
      data_hash: dataHash,
      generated_at: now,
      updated_at: now,
    };

    const { data: upserted, error: upsertError } = await admin
      .from("diabetes_insights")
      .upsert(insightRow, { onConflict: "user_id" })
      .select()
      .single();

    if (upsertError) {
      console.error("[DiabetesInsights] Upsert failed:", upsertError);
      return NextResponse.json({ error: "Failed to save insight" }, { status: 500 });
    }

    logAudit("DIABETES_INSIGHT_GENERATED", {
      userId: user.id,
      resourceType: "diabetes_insight",
      resourceId: upserted?.id,
      metadata: { classification, data_hash: dataHash },
    }).catch(() => {});

    return NextResponse.json({ insight: upserted, cached: false });
  } catch (error) {
    console.error("[DiabetesInsights] Error:", error);
    return NextResponse.json({ error: "Failed to generate insight" }, { status: 500 });
  }
}

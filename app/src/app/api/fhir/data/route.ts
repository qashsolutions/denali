/**
 * FHIR Data Route
 *
 * GET /api/fhir/data
 *
 * Returns transformed health data from cache.
 * If cache is stale (>24h), triggers a fresh sync.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { getCachedHealthData, syncHealthData } from "@/lib/fhir/sync";
import { hasActiveConnection } from "@/lib/fhir/tokens";
import { logAudit } from "@/lib/audit";

/**
 * Fire-and-forget: refresh diabetes insights if user has consented.
 */
async function triggerInsightRefreshIfConsented(userId: string): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase-admin");
  const admin = createAdminClient();

  // Check consent
  const { data: consent } = await admin
    .from("consent_preferences")
    .select("granted")
    .eq("user_id", userId)
    .eq("consent_type", "health_data_ai")
    .single();

  if (!consent?.granted) return;

  // Internal POST to insights endpoint would require auth context.
  // Instead, directly generate insight using the lib function.
  const { computeDataHash, generateDiabetesInsight } = await import("@/lib/diabetes-insights");

  // Gather data
  const [snapshotsRes, cacheRes, logRes] = await Promise.all([
    admin.from("diabetes_snapshots")
      .select("loinc_code, lab_name, value, unit, observed_date")
      .eq("user_id", userId)
      .order("observed_date", { ascending: true }),
    admin.from("fhir_cache")
      .select("resource_type, data")
      .eq("user_id", userId),
    admin.from("diabetes_log")
      .select("entry_type, logged_at, glucose_value, activity_minutes, note")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(10),
  ]);

  type CacheRow = { resource_type: string; data: unknown };
  const cacheMap = new Map<string, unknown>();
  for (const row of (cacheRes.data ?? []) as CacheRow[]) {
    cacheMap.set(row.resource_type, row.data);
  }

  const labs = (cacheMap.get("labs") as Array<{ name: string; value: number; unit: string; date: string }>) ?? [];
  const conditions = (cacheMap.get("conditions") as Array<{ code: string; name: string; category: string }>) ?? [];
  const medications = (cacheMap.get("medications") as Array<{ name: string; status: string; isDiabetesMed: boolean }>) ?? [];

  const a1cHistory = (snapshotsRes.data ?? [])
    .filter((r) => r.lab_name.toLowerCase().includes("a1c"))
    .map((r) => ({ date: r.observed_date, value: Number(r.value) }));

  const { classifyDiabetesStatus } = await import("@/lib/fhir/transforms");
  const { classification } = classifyDiabetesStatus(
    conditions as Parameters<typeof classifyDiabetesStatus>[0],
    labs as Parameters<typeof classifyDiabetesStatus>[1],
    medications as Parameters<typeof classifyDiabetesStatus>[2]
  );

  const inputData = {
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

  // Check existing hash
  const { data: existing } = await admin
    .from("diabetes_insights")
    .select("data_hash")
    .eq("user_id", userId)
    .single();

  if (existing?.data_hash === dataHash) return; // No change

  const output = await generateDiabetesInsight(inputData);
  const now = new Date().toISOString();

  await admin.from("diabetes_insights").upsert(
    {
      user_id: userId,
      classification,
      summary: output.summary,
      recommendations: output.recommendations as unknown as import("@/types/database").Json,
      risk_alerts: output.riskAlerts as unknown as import("@/types/database").Json,
      screening_reminders: output.screeningReminders as unknown as import("@/types/database").Json,
      data_hash: dataHash,
      generated_at: now,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );
}

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: "Not authenticated" },
        { status: 401 }
      );
    }

    logAudit("FHIR_DATA_ACCESS", {
      userId: user.id,
      resourceType: "ehr_connection",
    }).catch(() => {});

    // Check if user has an active connection
    const connected = await hasActiveConnection(user.id);
    if (!connected) {
      return NextResponse.json(
        { connected: false, patient: null, coverage: [], claims: [], labs: [], conditions: [], medications: [], screenings: [], providers: [], hospitalizations: [] }
      );
    }

    // Try cache first
    const cached = await getCachedHealthData(user.id);
    if (cached) {
      return NextResponse.json({
        connected: true,
        ...cached,
      });
    }

    // Cache miss — sync fresh data
    try {
      const fresh = await syncHealthData(user.id);

      // Auto-trigger insight refresh if diabetes data exists (fire-and-forget)
      const hasDiabetesData = fresh.labs.length > 0 || fresh.conditions.length > 0;
      if (hasDiabetesData) {
        triggerInsightRefreshIfConsented(user.id).catch(() => {});
      }

      return NextResponse.json({
        connected: true,
        ...fresh,
      });
    } catch (syncError) {
      console.error("[FHIR data] Sync failed:", syncError);
      return NextResponse.json(
        { connected: true, error: "Failed to fetch health data. Try refreshing." },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("[FHIR data] Error:", error);
    return NextResponse.json(
      { error: "Failed to load health data" },
      { status: 500 }
    );
  }
}

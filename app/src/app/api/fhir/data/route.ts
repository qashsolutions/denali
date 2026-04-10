/**
 * FHIR Data Route
 *
 * GET /api/fhir/data
 *
 * Returns transformed health data from cache.
 * If cache is stale (>24h), triggers a fresh sync.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { getCachedHealthData, syncHealthData } from "@/lib/fhir/sync";
import { hasActiveConnection } from "@/lib/fhir/tokens";
import { logAudit } from "@/lib/audit";
import { withMetrics } from "@/lib/metrics";
import { AUTH, SYSTEM } from "@/config/messages";

/**
 * Fire-and-forget: refresh diabetes insights if user has consented.
 */
async function triggerInsightRefreshIfConsented(userId: string): Promise<void> {
  // Check consent
  const consentResult = await query<{ granted: boolean }>(
    `SELECT granted FROM consent_preferences WHERE user_id = $1 AND consent_type = 'health_data_ai'`,
    [userId],
  );
  if (!consentResult.rows[0]?.granted) return;

  const { computeDataHash, generateDiabetesInsight } =
    await import("@/lib/diabetes-insights");

  // Gather data
  const [snapshotsResult, cacheResult, logResult] = await Promise.all([
    query<{
      loinc_code: string;
      lab_name: string;
      value: string;
      unit: string;
      observed_date: string;
    }>(
      `SELECT loinc_code, lab_name, value, unit, observed_date FROM diabetes_snapshots WHERE user_id = $1 ORDER BY observed_date ASC`,
      [userId],
    ),
    query<{ resource_type: string; data: unknown }>(
      `SELECT resource_type, data FROM fhir_cache WHERE user_id = $1`,
      [userId],
    ),
    query<{
      entry_type: string;
      logged_at: string;
      glucose_value: string | null;
      activity_minutes: number | null;
      note: string | null;
    }>(
      `SELECT entry_type, logged_at, glucose_value, activity_minutes, note FROM diabetes_log WHERE user_id = $1 ORDER BY logged_at DESC LIMIT 10`,
      [userId],
    ),
  ]);

  const cacheMap = new Map<string, unknown>();
  for (const row of cacheResult.rows) {
    const data = typeof row.data === "string" ? JSON.parse(row.data) : row.data;
    cacheMap.set(row.resource_type, data);
  }

  const labs =
    (cacheMap.get("labs") as Array<{
      name: string;
      value: number;
      unit: string;
      date: string;
    }>) ?? [];
  const conditions =
    (cacheMap.get("conditions") as Array<{
      code: string;
      name: string;
      category: string;
    }>) ?? [];
  const medications =
    (cacheMap.get("medications") as Array<{
      name: string;
      status: string;
      isDiabetesMed: boolean;
    }>) ?? [];

  const a1cHistory = snapshotsResult.rows
    .filter((r) => r.lab_name.toLowerCase().includes("a1c"))
    .map((r) => ({ date: r.observed_date, value: Number(r.value) }));

  const { classifyDiabetesStatus } = await import("@/lib/fhir/transforms");
  const { classification } = classifyDiabetesStatus(
    conditions as Parameters<typeof classifyDiabetesStatus>[0],
    labs as Parameters<typeof classifyDiabetesStatus>[1],
    medications as Parameters<typeof classifyDiabetesStatus>[2],
  );

  const inputData = {
    classification,
    a1cHistory,
    labs,
    conditions,
    medications,
    recentLogEntries: logResult.rows.map((e) => ({
      entry_type: e.entry_type,
      logged_at: e.logged_at,
      glucose_value: e.glucose_value ? Number(e.glucose_value) : null,
      activity_minutes: e.activity_minutes,
      note: e.note,
    })),
  };

  const dataHash = computeDataHash(inputData);

  // Check existing hash
  const existingResult = await query<{ data_hash: string }>(
    `SELECT data_hash FROM diabetes_insights WHERE user_id = $1 LIMIT 1`,
    [userId],
  );
  if (existingResult.rows[0]?.data_hash === dataHash) return;

  const output = await generateDiabetesInsight(inputData);
  const now = new Date().toISOString();

  await query(
    `INSERT INTO diabetes_insights
       (user_id, classification, summary, recommendations, risk_alerts, screening_reminders, data_hash, generated_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     ON CONFLICT (user_id) DO UPDATE
       SET classification = EXCLUDED.classification,
           summary = EXCLUDED.summary,
           recommendations = EXCLUDED.recommendations,
           risk_alerts = EXCLUDED.risk_alerts,
           screening_reminders = EXCLUDED.screening_reminders,
           data_hash = EXCLUDED.data_hash,
           generated_at = EXCLUDED.generated_at,
           updated_at = EXCLUDED.updated_at`,
    [
      userId,
      classification,
      output.summary,
      JSON.stringify(output.recommendations),
      JSON.stringify(output.riskAlerts),
      JSON.stringify(output.screeningReminders),
      dataHash,
      now,
      now,
    ],
  );
}

async function _GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: AUTH.SIGN_IN_REQUIRED },
        { status: 401 },
      );
    }

    logAudit("FHIR_DATA_ACCESS", {
      userId: user.userId,
      resourceType: "ehr_connection",
      request,
    }).catch(() => {});

    // Check if user has an active connection
    const connected = await hasActiveConnection(user.userId);
    if (!connected) {
      return NextResponse.json({
        connected: false,
        patient: null,
        coverage: [],
        claims: [],
        labs: [],
        conditions: [],
        medications: [],
        screenings: [],
        providers: [],
        hospitalizations: [],
        dme: [],
        isHospice: false,
      });
    }

    // Try cache first
    const cached = await getCachedHealthData(user.userId);
    if (cached) {
      return NextResponse.json({
        connected: true,
        ...cached,
      });
    }

    // Cache miss — sync fresh data
    try {
      const fresh = await syncHealthData(user.userId);

      // Auto-trigger insight refresh if diabetes data exists (fire-and-forget)
      const hasDiabetesData =
        fresh.labs.length > 0 || fresh.conditions.length > 0;
      if (hasDiabetesData) {
        triggerInsightRefreshIfConsented(user.userId).catch(() => {});
      }

      return NextResponse.json({
        connected: true,
        ...fresh,
      });
    } catch (syncError) {
      console.error("[FHIR data] Sync failed:", syncError);
      return NextResponse.json(
        {
          connected: true,
          error: "Failed to fetch health data. Try refreshing.",
        },
        { status: 502 },
      );
    }
  } catch (error) {
    console.error("[FHIR data] Error:", error);
    return NextResponse.json(
      { error: SYSTEM.LOAD_HEALTH_DATA },
      { status: 500 },
    );
  }
}

export const GET = withMetrics(_GET, "/api/fhir/data");

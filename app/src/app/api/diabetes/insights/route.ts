/**
 * Diabetes Insights API Route
 *
 * GET  /api/diabetes/insights  — return stored insight
 * POST /api/diabetes/insights  — trigger regeneration
 *
 * Auth + health_data_ai consent required for POST.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import {
  generateDiabetesInsight,
  computeDataHash,
  type InsightInput,
} from "@/lib/diabetes-insights";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const result = await query(
      `SELECT * FROM diabetes_insights WHERE user_id = $1 LIMIT 1`,
      [user.userId]
    );

    return NextResponse.json({ insight: result.rows[0] ?? null });
  } catch {
    return NextResponse.json({ error: "Unable to load your health insights. Please try again." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check health_data_ai consent
    const consentResult = await query<{ granted: boolean }>(
      `SELECT granted FROM consent_preferences WHERE user_id = $1 AND consent_type = 'health_data_ai'`,
      [user.userId]
    );
    const hasConsent = consentResult.rows.some((r) => r.granted);
    if (!hasConsent) {
      return NextResponse.json({ error: "Health data AI consent required" }, { status: 403 });
    }

    // Gather data in parallel
    const [snapshotsResult, cacheResult, logResult] = await Promise.all([
      query<{ loinc_code: string; lab_name: string; value: string; unit: string; observed_date: string }>(
        `SELECT loinc_code, lab_name, value, unit, observed_date
         FROM diabetes_snapshots
         WHERE user_id = $1
         ORDER BY observed_date ASC`,
        [user.userId]
      ),
      query<{ resource_type: string; data: unknown }>(
        `SELECT resource_type, data FROM fhir_cache WHERE user_id = $1`,
        [user.userId]
      ),
      query<{ entry_type: string; logged_at: string; glucose_value: string | null; activity_minutes: number | null; note: string | null }>(
        `SELECT entry_type, logged_at, glucose_value, activity_minutes, note
         FROM diabetes_log
         WHERE user_id = $1
         ORDER BY logged_at DESC
         LIMIT 10`,
        [user.userId]
      ),
    ]);

    // Parse FHIR cache
    const cacheMap = new Map<string, unknown>();
    for (const row of cacheResult.rows) {
      cacheMap.set(row.resource_type, row.data);
    }

    const labs = (cacheMap.get("labs") as Array<{ name: string; value: number; unit: string; date: string }>) ?? [];
    const conditions = (cacheMap.get("conditions") as Array<{ code: string; name: string; category: string }>) ?? [];
    const medications = (cacheMap.get("medications") as Array<{ name: string; status: string; isDiabetesMed: boolean }>) ?? [];

    // Build a1c history from snapshots
    const a1cHistory = snapshotsResult.rows
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
      recentLogEntries: logResult.rows.map((e) => ({
        entry_type: e.entry_type,
        logged_at: e.logged_at,
        glucose_value: e.glucose_value ? Number(e.glucose_value) : null,
        activity_minutes: e.activity_minutes,
        note: e.note,
      })),
    };

    const dataHash = computeDataHash(inputData);

    // Check if existing insight has same hash (skip regeneration)
    const existingResult = await query<{
      id: string;
      data_hash: string;
      summary: string;
      recommendations: unknown;
      risk_alerts: unknown;
      screening_reminders: unknown;
      generated_at: string;
    }>(
      `SELECT id, data_hash, summary, recommendations, risk_alerts, screening_reminders, generated_at
       FROM diabetes_insights WHERE user_id = $1 LIMIT 1`,
      [user.userId]
    );
    const existing = existingResult.rows[0] ?? null;

    if (existing && existing.data_hash === dataHash) {
      return NextResponse.json({ insight: existing, cached: true });
    }

    // Generate new insight
    const output = await generateDiabetesInsight(inputData);
    const now = new Date().toISOString();

    const upsertResult = await query<{ id: string }>(
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
             updated_at = EXCLUDED.updated_at
       RETURNING id`,
      [
        user.userId,
        classification,
        output.summary,
        JSON.stringify(output.recommendations),
        JSON.stringify(output.riskAlerts),
        JSON.stringify(output.screeningReminders),
        dataHash,
        now,
        now,
      ]
    );

    const upsertedId = upsertResult.rows[0]?.id;

    logAudit("DIABETES_INSIGHT_GENERATED", {
      userId: user.userId,
      resourceType: "diabetes_insight",
      resourceId: upsertedId,
      metadata: { classification, data_hash: dataHash },
    }).catch(() => {});

    return NextResponse.json({ insight: { id: upsertedId, ...inputData, summary: output.summary }, cached: false });
  } catch (error) {
    console.error("[DiabetesInsights] Error:", error);
    return NextResponse.json({ error: "Failed to generate insight" }, { status: 500 });
  }
}

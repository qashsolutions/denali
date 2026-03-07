/**
 * Generate Health Report
 *
 * POST /api/health-report/generate
 *
 * Generates a comprehensive health summary report from cached FHIR data.
 * Uses Claude (Sonnet 4.6) for structured analysis.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { getCachedHealthData } from "@/lib/fhir/sync";
import { classifyDiabetesStatus, classifyObesityStatus } from "@/lib/fhir/transforms";
import { generateHealthReport, computeReportHash, type ReportInput } from "@/lib/health-report";
import { logAudit } from "@/lib/audit";
import type { SessionState } from "@/lib/session-state";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get cached health data
    const healthData = await getCachedHealthData(user.userId);
    if (!healthData) {
      return NextResponse.json({ error: "No health data available. Connect Medicare first." }, { status: 404 });
    }

    // Build classifications
    const { classification: diabetesClassification } = classifyDiabetesStatus(
      healthData.conditions,
      healthData.labs,
      healthData.medications
    );
    const { classification: obesityClassification } = classifyObesityStatus(
      healthData.conditions,
      healthData.medications
    );

    // Build report input
    const recentDenials = healthData.claims
      .filter((c) => c.status === "Denied" && c.denialReasons?.length)
      .slice(0, 5)
      .map((c) => ({
        procedure: c.procedures[0] ?? "Unknown",
        denialReason: c.denialReasons?.[0] ?? "Unknown reason",
      }));

    const input: ReportInput = {
      patient: healthData.patient,
      coverage: healthData.coverage.map((c) => ({ type: c.type, status: c.status })),
      conditions: healthData.conditions,
      medications: healthData.medications,
      screenings: healthData.screenings,
      providers: healthData.providers,
      hospitalizations: healthData.hospitalizations,
      dme: healthData.dme ?? [],
      isHospice: healthData.isHospice ?? false,
      diabetesClassification,
      obesityClassification,
      recentDenials,
    };

    // Check hash — skip regeneration if data unchanged
    const sourceHash = computeReportHash(input);
    const existing = await query<{ id: string; share_token: string; status: string }>(
      `SELECT id, share_token, status FROM health_reports
       WHERE user_id = $1 AND source_hash = $2 AND status = 'ready'
       ORDER BY created_at DESC LIMIT 1`,
      [user.userId, sourceHash]
    );
    if (existing.rows.length > 0) {
      return NextResponse.json({
        id: existing.rows[0].id,
        shareToken: existing.rows[0].share_token,
        status: "ready",
        skipped: true,
      });
    }

    // Create report row with 'generating' status
    const insertResult = await query<{ id: string; share_token: string }>(
      `INSERT INTO health_reports (user_id, status, source_hash)
       VALUES ($1, 'generating', $2)
       RETURNING id, share_token`,
      [user.userId, sourceHash]
    );
    const reportId = insertResult.rows[0].id;
    const shareToken = insertResult.rows[0].share_token;

    // Build a minimal sessionState for the prompt builder
    const sessionState: SessionState = {
      userName: null,
      userZip: null,
      medicareType: healthData.coverage.some((c) => c.type.includes("Part C")) ? "advantage" : "original",
      symptoms: [],
      duration: null,
      severity: null,
      priorTreatments: [],
      procedureNeeded: null,
      providerName: null,
      providerSearchAttempts: 0,
      provider: null,
      diagnosisCodes: [],
      procedureCodes: [],
      coverageCriteria: [],
      policyReferences: [],
      guidanceGenerated: false,
      isAppeal: false,
      denialDate: null,
      priorAuthRequired: null,
      priorAuthSource: null,
      requirementsToVerify: [],
      requirementAnswers: {},
      verificationComplete: false,
      meetsAllRequirements: null,
      redFlagsPresent: [],
      redFlagsChecked: false,
      priorImagingDone: null,
      priorImagingType: null,
      priorImagingDate: null,
      specialtyMismatchWarning: null,
      denialCodes: [],
      healthDataAvailable: true,
      consentHealthDataAi: true,
      activeCoverage: healthData.coverage.map((c) => c.type),
      conditions: healthData.conditions.map((c) => ({ code: c.code, name: c.name, category: c.category })),
      medications: healthData.medications.map((m) => ({
        name: m.name,
        status: m.status,
        isDiabetesMed: m.isDiabetesMed,
        isObesityMed: m.isObesityMed,
        daysSupply: m.daysSupply,
        isBrandName: m.isBrandName,
        gapDays: m.gapDays,
      })),
      screenings: healthData.screenings.map((s) => ({
        screeningType: s.screeningType,
        displayName: s.displayName,
        lastDate: s.lastDate,
        monthsSinceLast: s.monthsSinceLast,
        isOverdue: s.isOverdue,
      })),
      providers: healthData.providers.slice(0, 8).map((p) => ({
        name: p.name,
        specialty: p.specialty,
        visitCount: p.visitCount,
        lastSeen: p.lastSeen,
      })),
      hospitalizations: healthData.hospitalizations.map((h) => ({
        admissionDate: h.admissionDate,
        dischargeDate: h.dischargeDate,
        lengthOfStay: h.lengthOfStay,
        diagnoses: h.diagnoses,
        provider: h.provider,
        daysSinceDischarge: h.daysSinceDischarge,
        needsFollowUp: h.needsFollowUp,
      })),
      labs: healthData.labs,
      diabetesClassification,
      obesityClassification,
      recentDenials: recentDenials.map((d) => ({
        serviceDate: "",
        procedure: d.procedure,
        denialCode: "",
        denialReason: d.denialReason,
      })),
      dme: healthData.dme ?? [],
      isHospice: healthData.isHospice ?? false,
      recentClaims: healthData.claims.slice(0, 5).map((c) => ({
        serviceDate: c.serviceDate,
        type: c.type,
        provider: c.provider,
        procedures: c.procedures,
        diagnosis: c.diagnosis,
        totalCharged: c.totalCharged,
        medicarePaid: c.medicarePaid,
        youOwe: c.youOwe,
        status: c.status,
        denialReasons: c.denialReasons,
      })),
    };

    // Generate report
    try {
      const report = await generateHealthReport(sessionState, input);

      await query(
        `UPDATE health_reports SET status = 'ready', report_data = $1, updated_at = NOW()
         WHERE id = $2`,
        [JSON.stringify(report), reportId]
      );

      logAudit("HEALTH_REPORT_GENERATED", {
        userId: user.userId,
        resourceType: "health_report",
        resourceId: reportId,
        request,
      }).catch(() => {});

      return NextResponse.json({ id: reportId, shareToken, status: "ready" });
    } catch (genError) {
      console.error("[HealthReport] Generation failed:", genError);
      await query(
        `UPDATE health_reports SET status = 'failed', updated_at = NOW() WHERE id = $1`,
        [reportId]
      );
      return NextResponse.json({ error: "Report generation failed" }, { status: 500 });
    }
  } catch (error) {
    console.error("[HealthReport] Error:", error);
    return NextResponse.json({ error: "Unable to generate your report. Please try again." }, { status: 500 });
  }
}

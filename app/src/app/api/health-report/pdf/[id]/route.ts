/**
 * Report PDF Download
 *
 * GET /api/health-report/pdf/[id] — generates and returns PDF (auth required)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import type { HealthReport } from "@/lib/health-report";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;

    const result = await query<{ report_data: unknown }>(
      `SELECT report_data FROM health_reports
       WHERE id = $1 AND user_id = $2 AND status = 'ready'`,
      [id, user.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const reportData = (typeof result.rows[0].report_data === "string"
      ? JSON.parse(result.rows[0].report_data)
      : result.rows[0].report_data) as HealthReport;

    // Build a simple text-based PDF content
    // Server-side jsPDF is heavyweight — use plain text format instead
    const pdfText = buildReportText(reportData);

    return new NextResponse(pdfText, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="DenaliHealth-Report-${id.slice(0, 8)}.txt"`,
      },
    });
  } catch (error) {
    console.error("[HealthReport] PDF error:", error);
    return NextResponse.json({ error: "Unable to generate the PDF. Please try again." }, { status: 500 });
  }
}

function buildReportText(report: HealthReport): string {
  const lines: string[] = [];

  lines.push("═══════════════════════════════════════════════════");
  lines.push("        DENALI HEALTH — MEDICARE HEALTH SUMMARY");
  lines.push("═══════════════════════════════════════════════════");
  lines.push("");
  lines.push(`Generated: ${new Date(report.generatedAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`);
  lines.push("");

  // Patient Summary
  lines.push("── PATIENT SUMMARY ──");
  if (report.patientSummary.age) lines.push(`Age: ${report.patientSummary.age}`);
  if (report.patientSummary.gender) lines.push(`Gender: ${report.patientSummary.gender}`);
  lines.push(`Coverage: ${report.patientSummary.coverageType}`);
  if (report.patientSummary.coverageParts.length > 0) {
    lines.push(`Parts: ${report.patientSummary.coverageParts.join(", ")}`);
  }
  lines.push("");

  // Hospice
  if (report.hospiceStatus) {
    lines.push("⚠️  HOSPICE STATUS — This report focuses on comfort care and hospice benefit coverage.");
    lines.push("");
  }

  // Red Flags
  if (report.redFlags.length > 0) {
    lines.push("── RED FLAGS ──");
    for (const flag of report.redFlags) {
      lines.push(`[${flag.severity.toUpperCase()}] ${flag.title}`);
      lines.push(`  ${flag.detail}`);
      lines.push(`  → ${flag.recommendation}`);
    }
    lines.push("");
  }

  // Diabetes
  if (report.diabetesSection.classification !== "none") {
    lines.push("── DIABETES ASSESSMENT ──");
    lines.push(`Classification: ${report.diabetesSection.classification}`);
    for (const f of report.diabetesSection.findings) lines.push(`• ${f}`);
    if (report.diabetesSection.medicareBenefits.length > 0) {
      lines.push("Medicare Benefits Available:");
      for (const b of report.diabetesSection.medicareBenefits) lines.push(`  ✓ ${b}`);
    }
    if (report.diabetesSection.actionItems.length > 0) {
      lines.push("Action Items:");
      for (const a of report.diabetesSection.actionItems) lines.push(`  → ${a}`);
    }
    lines.push("");
  }

  // Obesity
  if (report.obesitySection.classification !== "none") {
    lines.push("── WEIGHT MANAGEMENT ASSESSMENT ──");
    lines.push(`Classification: ${report.obesitySection.classification}`);
    for (const f of report.obesitySection.findings) lines.push(`• ${f}`);
    if (report.obesitySection.medicareBenefits.length > 0) {
      lines.push("Medicare Benefits Available:");
      for (const b of report.obesitySection.medicareBenefits) lines.push(`  ✓ ${b}`);
    }
    lines.push("");
  }

  // Pre-diabetes resources
  if (report.preDiabetesResources?.eligible) {
    lines.push("── PRE-DIABETES RESOURCES ──");
    lines.push(report.preDiabetesResources.mdppInfo);
    lines.push(`CDC Risk Test: ${report.preDiabetesResources.cdcRiskTestLink}`);
    for (const g of report.preDiabetesResources.lifestyleGuidance) lines.push(`  → ${g}`);
    lines.push("");
  }

  // Conditions
  if (report.conditionsSummary.length > 0) {
    lines.push("── CONDITIONS ──");
    for (const c of report.conditionsSummary) {
      const marker = c.severity === "red" ? "🔴" : c.severity === "amber" ? "🟡" : "🟢";
      const primary = c.isPrimary ? " [Primary]" : "";
      lines.push(`${marker} ${c.name}${primary} — ${c.note}`);
    }
    lines.push("");
  }

  // Medications
  if (report.medicationReview.length > 0) {
    lines.push("── MEDICATIONS ──");
    for (const m of report.medicationReview) {
      const concern = m.concern ? ` — ⚠️ ${m.concern}` : "";
      lines.push(`• ${m.name} (${m.status})${concern}`);
    }
    lines.push("");
  }

  // DME
  if (report.dmeSupplies && report.dmeSupplies.length > 0) {
    lines.push("── DME SUPPLIES ──");
    for (const d of report.dmeSupplies) {
      lines.push(`• ${d.category}: ${d.relevance}`);
    }
    lines.push("");
  }

  // Screenings
  if (report.screeningStatus.length > 0) {
    lines.push("── SCREENINGS ──");
    for (const s of report.screeningStatus) {
      const status = s.isOverdue ? "OVERDUE" : "Up to date";
      lines.push(`• ${s.type}: ${s.lastDate ?? "No record"} [${status}]`);
      lines.push(`  Coverage: ${s.medicareCoverage}`);
    }
    lines.push("");
  }

  // Care Team
  if (report.careTeam.length > 0) {
    lines.push("── CARE TEAM ──");
    for (const ct of report.careTeam) {
      const rec = ct.recommendation ? ` → ${ct.recommendation}` : "";
      lines.push(`• ${ct.specialty}: ${ct.hasVisited ? "Active" : "Not seen"}${rec}`);
    }
    lines.push("");
  }

  // Denials
  if (report.recentDenials.length > 0) {
    lines.push("── RECENT DENIALS ──");
    for (const d of report.recentDenials) {
      lines.push(`• ${d.procedure}: ${d.reason}`);
      lines.push(`  → ${d.actionItem}`);
    }
    lines.push("");
  }

  lines.push("═══════════════════════════════════════════════════");
  lines.push("This report was generated from Medicare claims data via Blue Button 2.0.");
  lines.push("Not endorsed or certified by CMS or HHS.");
  lines.push("This is coverage guidance, not medical advice.");
  lines.push("Always consult with your healthcare provider.");
  lines.push("═══════════════════════════════════════════════════");

  return lines.join("\n");
}

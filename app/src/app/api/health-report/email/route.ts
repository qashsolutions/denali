/**
 * Email Report
 *
 * POST /api/health-report/email — sends report via Resend (auth required)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import type { HealthReport } from "@/lib/health-report";

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { reportId, recipientEmail, recipientName } = body as {
      reportId: string;
      recipientEmail: string;
      recipientName?: string;
    };

    if (!reportId || !recipientEmail) {
      return NextResponse.json({ error: "Missing reportId or recipientEmail" }, { status: 400 });
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return NextResponse.json({ error: "Invalid email address" }, { status: 400 });
    }

    // Get report
    const result = await query<{ report_data: unknown }>(
      `SELECT report_data FROM health_reports
       WHERE id = $1 AND user_id = $2 AND status = 'ready'`,
      [reportId, user.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: "Report not found" }, { status: 404 });
    }

    const reportData = (typeof result.rows[0].report_data === "string"
      ? JSON.parse(result.rows[0].report_data)
      : result.rows[0].report_data) as HealthReport;

    // Send via Resend
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "no-reply@denali.health";

    if (!resendKey) {
      return NextResponse.json({ error: "Email service not configured" }, { status: 503 });
    }

    const greeting = recipientName ? `Dear ${recipientName},` : "Hello,";
    const htmlBody = buildEmailHtml(reportData, greeting);

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `Denali Health <${fromEmail}>`,
        to: recipientEmail,
        subject: "Your Medicare Health Summary Report — Denali Health",
        html: htmlBody,
      }),
    });

    if (!emailRes.ok) {
      const errText = await emailRes.text();
      console.error("[HealthReport] Email send failed:", errText);
      return NextResponse.json({ error: "Failed to send email" }, { status: 502 });
    }

    logAudit("REPORT_EMAILED", {
      userId: user.userId,
      resourceType: "ehr_connection",
      resourceId: reportId,
      metadata: { recipientEmail },
      request,
    }).catch(() => {});

    return NextResponse.json({ sent: true });
  } catch (error) {
    console.error("[HealthReport] Email error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function buildEmailHtml(report: HealthReport, greeting: string): string {
  const sections: string[] = [];

  // Red flags
  if (report.redFlags.length > 0) {
    const flags = report.redFlags
      .map((f) => `<li><strong>${f.title}</strong>: ${f.detail}<br/><em>${f.recommendation}</em></li>`)
      .join("");
    sections.push(`<h3 style="color:#B3695A">Items Needing Attention</h3><ul>${flags}</ul>`);
  }

  // Diabetes
  if (report.diabetesSection.classification !== "none") {
    const items = report.diabetesSection.actionItems.map((a) => `<li>${a}</li>`).join("");
    sections.push(`<h3>Diabetes Assessment: ${report.diabetesSection.classification}</h3>${items ? `<ul>${items}</ul>` : ""}`);
  }

  // Obesity
  if (report.obesitySection.classification !== "none") {
    const items = report.obesitySection.actionItems.map((a) => `<li>${a}</li>`).join("");
    sections.push(`<h3>Weight Management: ${report.obesitySection.classification}</h3>${items ? `<ul>${items}</ul>` : ""}`);
  }

  // Pre-diabetes
  if (report.preDiabetesResources?.eligible) {
    sections.push(`<h3>Pre-Diabetes Resources</h3><p>${report.preDiabetesResources.mdppInfo}</p><p><a href="${report.preDiabetesResources.cdcRiskTestLink}">Take the CDC Diabetes Risk Test</a></p>`);
  }

  // Screenings
  const overdueScreenings = report.screeningStatus.filter((s) => s.isOverdue);
  if (overdueScreenings.length > 0) {
    const items = overdueScreenings.map((s) => `<li>${s.type} — ${s.medicareCoverage}</li>`).join("");
    sections.push(`<h3>Overdue Screenings</h3><ul>${items}</ul>`);
  }

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"/></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#2C1810;">
  <div style="border-bottom:2px solid #C26A3E;padding-bottom:16px;margin-bottom:24px;">
    <h1 style="margin:0;font-size:24px;color:#2C1810;">Denali<span style="color:#7c3aed;">Health</span></h1>
    <p style="margin:4px 0 0;color:#666;font-size:14px;">Medicare Health Summary Report</p>
  </div>

  <p>${greeting}</p>
  <p>Attached is a summary of your Medicare health data, including conditions, medications, screenings, and personalized recommendations based on your claims history.</p>

  ${sections.join("")}

  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E8DFD3;font-size:12px;color:#666;">
    <p>Generated from Medicare claims data via Blue Button 2.0. Not endorsed or certified by CMS or HHS.</p>
    <p>This is coverage guidance, not medical advice. Always consult with your healthcare provider.</p>
    <p>&copy; ${new Date().getFullYear()} Qash Solutions Inc — <a href="https://denali.health">denali.health</a></p>
  </div>
</body>
</html>`;
}

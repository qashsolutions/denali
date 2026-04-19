/**
 * Email Report
 *
 * POST /api/health-report/email — sends report via AWS SES (auth required)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { sendEmail } from "@/lib/email";
import { AUTH, VALIDATION, SYSTEM } from "@/config/messages";
import { DISCLAIMER_LONG } from "@/config/disclaimers";
import type { HealthReport } from "@/lib/health-report";

/** Escape HTML entities to prevent XSS in email content */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: AUTH.SIGN_IN_REQUIRED },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { reportId, recipientEmail, recipientName } = body as {
      reportId: string;
      recipientEmail: string;
      recipientName?: string;
    };

    if (!reportId || !recipientEmail) {
      return NextResponse.json(
        { error: VALIDATION.REPORT_EMAIL_REQUIRED },
        { status: 400 },
      );
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail)) {
      return NextResponse.json(
        { error: VALIDATION.EMAIL_INVALID },
        { status: 400 },
      );
    }

    // Get report
    const result = await query<{ report_data: unknown }>(
      `SELECT report_data FROM health_reports
       WHERE id = $1 AND user_id = $2 AND status = 'ready'`,
      [reportId, user.userId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: SYSTEM.REPORT_NOT_FOUND },
        { status: 404 },
      );
    }

    const reportData = (
      typeof result.rows[0].report_data === "string"
        ? JSON.parse(result.rows[0].report_data)
        : result.rows[0].report_data
    ) as HealthReport;

    // Send via AWS SES
    const greeting = recipientName
      ? `Dear ${escapeHtml(recipientName)},`
      : "Hello,";
    const htmlBody = buildEmailHtml(reportData, greeting);

    const emailResult = await sendEmail({
      to: [recipientEmail],
      subject: "Your Medicare Health Summary Report — Denali Health",
      html: htmlBody,
    });

    if (!emailResult.messageId) {
      console.error("[HealthReport] SES email send failed");
      return NextResponse.json({ error: SYSTEM.EMAIL_FAILED }, { status: 502 });
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
    return NextResponse.json({ error: SYSTEM.EMAIL_FAILED }, { status: 500 });
  }
}

function buildEmailHtml(report: HealthReport, greeting: string): string {
  const sections: string[] = [];

  // Red flags
  if (report.redFlags.length > 0) {
    const flags = report.redFlags
      .map(
        (f) =>
          `<li><strong>${escapeHtml(f.title)}</strong>: ${escapeHtml(f.detail)}<br/><em>${escapeHtml(f.recommendation)}</em></li>`,
      )
      .join("");
    sections.push(
      `<h3 style="color:#B3695A">Items Needing Attention</h3><ul>${flags}</ul>`,
    );
  }

  // Diabetes
  if (report.diabetesSection.classification !== "none") {
    const items = report.diabetesSection.actionItems
      .map((a) => `<li>${escapeHtml(a)}</li>`)
      .join("");
    sections.push(
      `<h3>Diabetes Assessment: ${escapeHtml(report.diabetesSection.classification)}</h3>${items ? `<ul>${items}</ul>` : ""}`,
    );
  }

  // Obesity
  if (report.obesitySection.classification !== "none") {
    const oItems = report.obesitySection.actionItems
      .map((a) => `<li>${escapeHtml(a)}</li>`)
      .join("");
    sections.push(
      `<h3>Weight Management: ${escapeHtml(report.obesitySection.classification)}</h3>${oItems ? `<ul>${oItems}</ul>` : ""}`,
    );
  }

  // Pre-diabetes
  if (report.preDiabetesResources?.eligible) {
    sections.push(
      `<h3>Pre-Diabetes Resources</h3><p>${escapeHtml(report.preDiabetesResources.mdppInfo)}</p><p><a href="${escapeHtml(report.preDiabetesResources.cdcRiskTestLink)}">Take the CDC Diabetes Risk Test</a></p>`,
    );
  }

  // Screenings
  const overdueScreenings = report.screeningStatus.filter((s) => s.isOverdue);
  if (overdueScreenings.length > 0) {
    const sItems = overdueScreenings
      .map(
        (s) =>
          `<li>${escapeHtml(s.type)} — ${escapeHtml(s.medicareCoverage)}</li>`,
      )
      .join("");
    sections.push(`<h3>Overdue Screenings</h3><ul>${sItems}</ul>`);
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

  <div style="border-left:3px solid #f59e0b;padding:12px 16px;background:#fffbeb;margin:16px 0;font-size:14px;color:#78350f;">
    <strong>AI-Generated Content:</strong> ${DISCLAIMER_LONG}
  </div>

  ${sections.join("")}

  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #E8DFD3;font-size:12px;color:#666;">
    <p>Generated from Medicare claims data via the Medicare claims API. Not endorsed or certified by CMS or HHS.</p>
    <p>${DISCLAIMER_LONG}</p>
    <p>&copy; ${new Date().getFullYear()} Qash Solutions Inc — <a href="https://denali.health">denali.health</a></p>
  </div>
</body>
</html>`;
}

/**
 * Policy Change Email Notification
 * POST /api/admin/email/policy-change
 *
 * Admin-only endpoint that sends 30-day advance notice to all registered users
 * when material changes are made to Terms of Service or Privacy Policy.
 * Required by Terms §12 and Privacy §15.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";

interface PolicyChangeRequest {
  effectiveDate: string;
  summary: string;
  changes: string[];
  cmsRelated?: boolean;
  dryRun?: boolean;
}

async function requireAdmin(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return null;
  const result = await query<{ is_admin: boolean }>(
    `SELECT is_admin FROM users WHERE id = $1`,
    [user.userId]
  );
  if (!result.rows[0]?.is_admin) return null;
  return user;
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => null) as PolicyChangeRequest | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { effectiveDate, summary, changes, cmsRelated, dryRun } = body;

  if (!effectiveDate || typeof effectiveDate !== "string") {
    return NextResponse.json({ error: "effectiveDate is required" }, { status: 400 });
  }
  if (!summary || typeof summary !== "string") {
    return NextResponse.json({ error: "summary is required" }, { status: 400 });
  }
  if (!Array.isArray(changes) || changes.length === 0) {
    return NextResponse.json({ error: "changes must be a non-empty array" }, { status: 400 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) {
    console.error("[admin/email/policy-change] RESEND_API_KEY not configured");
    return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
  }

  // Get all registered users
  const users = await query<{ id: string; email: string }>(
    `SELECT id, email FROM users WHERE email IS NOT NULL`
  );

  const html = buildPolicyChangeEmail({ effectiveDate, summary, changes, cmsRelated });

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      recipientCount: users.rows.length,
      previewHtml: html,
    });
  }

  let sent = 0;
  let failed = 0;
  const errors: Array<{ email: string; error: string }> = [];

  for (const user of users.rows) {
    try {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "denali.health <noreply@denali.health>",
          to: [user.email],
          subject: `Policy Update Notice — Effective ${effectiveDate}`,
          html,
        }),
      });

      if (!resendRes.ok) {
        const err = await resendRes.text();
        console.error(`[admin/email/policy-change] Failed for ${user.email}:`, err);
        failed++;
        errors.push({ email: user.email, error: err });
      } else {
        sent++;
      }
    } catch (err) {
      console.error(`[admin/email/policy-change] Error for ${user.email}:`, err);
      failed++;
      errors.push({ email: user.email, error: String(err) });
    }

    // Small delay to avoid Resend rate limits
    if (users.rows.indexOf(user) < users.rows.length - 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  // Audit log (fire-and-forget)
  logAudit("POLICY_CHANGE_EMAIL", {
    userId: admin.userId,
    resourceType: "policy_notification",
    metadata: {
      effectiveDate,
      summary,
      changeCount: changes.length,
      cmsRelated: !!cmsRelated,
      sent,
      failed,
    },
    request,
  }).catch((err) => console.warn("[admin/email/policy-change] Audit log failed:", err));

  return NextResponse.json({ sent, failed, errors: errors.length > 0 ? errors : undefined });
}

function buildPolicyChangeEmail(opts: {
  effectiveDate: string;
  summary: string;
  changes: string[];
  cmsRelated?: boolean;
}): string {
  const { effectiveDate, summary, changes, cmsRelated } = opts;

  const changesHTML = changes
    .map((c) => `<li style="margin-bottom: 8px; color: #334155;">${escapeHtml(c)}</li>`)
    .join("");

  const cmsNote = cmsRelated
    ? `<div style="background: #eff6ff; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0;">
        <strong style="color: #1d4ed8;">CMS Regulatory Update</strong>
        <p style="color: #1e40af; margin: 4px 0 0 0; font-size: 14px;">These changes are driven by updates to CMS (Centers for Medicare &amp; Medicaid Services) regulations or requirements.</p>
      </div>`
    : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Policy Update Notice</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">denali.health</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">Policy Update Notice</p>
    </div>
    <div style="padding: 24px;">
      <p style="color: #334155; font-size: 16px; line-height: 1.6;">
        We are writing to let you know about upcoming changes to our policies. Per our commitment to transparency, we are providing this notice at least 30 days before the changes take effect.
      </p>

      <div style="background: #fefce8; border-left: 4px solid #eab308; padding: 12px 16px; margin: 16px 0;">
        <strong style="color: #854d0e;">Effective Date: ${escapeHtml(effectiveDate)}</strong>
      </div>

      <h2 style="color: #1e293b; font-size: 18px; margin-top: 24px;">What's Changing</h2>
      <p style="color: #334155; line-height: 1.6;">${escapeHtml(summary)}</p>

      <h3 style="color: #1e293b; font-size: 16px; margin-top: 20px;">Summary of Changes</h3>
      <ul style="padding-left: 20px; line-height: 1.8;">
        ${changesHTML}
      </ul>

      ${cmsNote}

      <h3 style="color: #1e293b; font-size: 16px; margin-top: 24px;">Review the Updated Policies</h3>
      <p style="color: #334155; line-height: 1.6;">
        You can review the full updated policies at any time:
      </p>
      <div style="margin: 16px 0;">
        <a href="https://denali.health/terms" style="display: inline-block; background: #3b82f6; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600; margin-right: 8px; margin-bottom: 8px;">Terms of Service</a>
        <a href="https://denali.health/privacy" style="display: inline-block; background: #8b5cf6; color: white; padding: 10px 20px; border-radius: 8px; text-decoration: none; font-weight: 600;">Privacy Policy</a>
      </div>

      <h3 style="color: #1e293b; font-size: 16px; margin-top: 24px;">Your Options</h3>
      <p style="color: #334155; line-height: 1.6;">
        By continuing to use Denali after ${escapeHtml(effectiveDate)}, you agree to the updated policies. If you do not agree with the changes, you may delete your account before the effective date via <strong>Settings &gt; Danger Zone</strong>.
      </p>

      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 13px;">
        <p>Questions? Contact us at <a href="mailto:admin@denali.health" style="color: #3b82f6; text-decoration: none;">admin@denali.health</a></p>
        <p style="margin-top: 12px;"><a href="https://denali.health" style="color: #3b82f6; text-decoration: none;">denali.health</a> — Medicare coverage guidance</p>
        <p style="margin-top: 8px; font-size: 12px; color: #cbd5e1;">You are receiving this email because you have a registered account at denali.health.</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

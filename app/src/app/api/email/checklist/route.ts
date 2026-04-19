/**
 * Send Checklist Email
 * POST /api/email/checklist
 */

import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getAuthUser } from "@/lib/auth-server";
import { AUTH, VALIDATION, SYSTEM } from "@/config/messages";

/** Escape HTML entities to prevent XSS in email content */
function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

interface ChecklistData {
  title: string;
  procedure: string;
  diagnosis?: string;
  items: Array<{ text: string; checked: boolean }>;
  talkingPoints?: string[];
  tips?: string[];
}

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: AUTH.SIGN_IN_TO_SEND_EMAIL }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  if (!body?.email || !body?.checklist) {
    return NextResponse.json({ error: VALIDATION.CHECKLIST_REQUIRED }, { status: 400 });
  }

  const { email, checklist, conversationId } = body as {
    email: string;
    checklist: ChecklistData;
    conversationId?: string;
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return NextResponse.json({ error: VALIDATION.EMAIL_INVALID }, { status: 400 });
  }

  const html = buildEmailHTML(checklist);
  const subject = checklist.title || "Your Medicare Coverage Checklist";

  const result = await sendEmail({
    to: [email],
    subject,
    html,
    from: "denali.health <no-reply@denali.health>",
  });

  if (!result.messageId) {
    console.error("[email/checklist] SES send failed");
    return NextResponse.json({ error: SYSTEM.EMAIL_FAILED }, { status: 500 });
  }

  // Log event non-blocking
  if (conversationId) {
    query(
      `INSERT INTO user_events (event_type, conversation_id, event_data)
       VALUES ('email_sent', $1, $2)`,
      [conversationId, JSON.stringify({ email_id: result.messageId, to: email })]
    ).catch((err) => console.warn("[email/checklist] log failed:", err));
  }

  return NextResponse.json({ success: true, emailId: result.messageId });
}

function buildEmailHTML(checklist: ChecklistData): string {
  const itemsHTML = checklist.items.map((item) => `
    <tr>
      <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">
        <span style="font-size: 18px; margin-right: 8px;">${item.checked ? "☑" : "☐"}</span>
        ${escapeHtml(item.text)}
      </td>
    </tr>`).join("");

  const talkingPointsHTML = checklist.talkingPoints?.length ? `
    <h3 style="color: #1e293b; margin-top: 24px;">What to Say at Your Appointment</h3>
    <ul style="color: #475569; line-height: 1.6;">
      ${checklist.talkingPoints.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}
    </ul>` : "";

  const tipsHTML = checklist.tips?.length ? `
    <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; margin-top: 24px;">
      <strong style="color: #15803d;">Tips:</strong>
      <ul style="color: #166534; margin: 8px 0 0 0; padding-left: 20px;">
        ${checklist.tips.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}
      </ul>
    </div>` : "";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(checklist.title)}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">denali.health</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">Medicare Coverage Checklist</p>
    </div>
    <div style="padding: 24px;">
      <h2 style="color: #1e293b; margin-top: 0;">${escapeHtml(checklist.title)}</h2>
      <p style="color: #64748b; margin-bottom: 8px;"><strong>Procedure:</strong> ${escapeHtml(checklist.procedure)}</p>
      ${checklist.diagnosis ? `<p style="color: #64748b; margin-bottom: 16px;"><strong>Reason:</strong> ${escapeHtml(checklist.diagnosis)}</p>` : ""}
      <h3 style="color: #1e293b;">What Your Doctor Needs to Document</h3>
      <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 8px; overflow: hidden;">${itemsHTML}</table>
      ${talkingPointsHTML}
      ${tipsHTML}
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 14px;">
        <p>Print this checklist and bring it to your appointment.</p>
        <p style="margin-top: 16px;"><a href="https://denali.health" style="color: #3b82f6; text-decoration: none;">denali.health</a> — Medicare coverage guidance</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

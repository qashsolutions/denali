/**
 * Email Alert Templates
 *
 * Branded HTML emails with NO PHI — generic notifications directing users
 * to log in for details. Follows the policy-change email pattern.
 */

import type { AlertType } from "@/config/alerts";

interface AlertEmailConfig {
  subject: string;
  heading: string;
  body: string;
  loginUrl: string;
  ctaText: string;
}

const ALERT_EMAIL_CONFIG: Record<AlertType | 'outcome_followup', AlertEmailConfig> = {
  appeal_deadline: {
    subject: "Medicare Appeal Deadline Reminder",
    heading: "Appeal Deadline Approaching",
    body: "You have an appeal deadline approaching. Log in to review the details and take action before it expires.",
    loginUrl: "/app/health?alert=appeal-deadline",
    ctaText: "Review Appeal",
  },
  med_refill: {
    subject: "Medicare Medication Update",
    heading: "Medication Information Updated",
    body: "Your medication information has been updated. Log in to review your current medications and any refill needs.",
    loginUrl: "/app/health?alert=med-refill",
    ctaText: "Review Medications",
  },
  new_denial: {
    subject: "New Medicare Claims Information",
    heading: "New Claims Information Available",
    body: "New information about your claims is available. Log in to review the details and see if any action is needed.",
    loginUrl: "/app/health?alert=new-denial",
    ctaText: "Review Claims",
  },
  data_refresh: {
    subject: "Time to Refresh Your Medicare Data",
    heading: "Keep Your Data Up to Date",
    body: "It's been a while since your Medicare data was last updated. Log in to refresh your data and ensure you have the latest information.",
    loginUrl: "/app/health?alert=data-refresh",
    ctaText: "Refresh Data",
  },
  outcome_followup: {
    subject: "How Did Your Appeal Turn Out?",
    heading: "We'd Love to Hear Your Results",
    body: "It's been a while since you filed an appeal. Sharing your outcome helps us improve our guidance for everyone.",
    loginUrl: "/app/health",
    ctaText: "Report Outcome",
  },
};

export function buildAlertEmail(
  alertType: AlertType | 'outcome_followup',
  options?: { outcomeToken?: string }
): { subject: string; html: string } {
  const config = ALERT_EMAIL_CONFIG[alertType];
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://denali.health";

  let loginUrl = `${baseUrl}${config.loginUrl}`;
  if (alertType === "outcome_followup" && options?.outcomeToken) {
    loginUrl = `${baseUrl}/outcome?token=${options.outcomeToken}`;
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(config.subject)}</title></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
    <div style="background: linear-gradient(135deg, #C26A3E, #D4845A); padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">denali.health</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">${escapeHtml(config.heading)}</p>
    </div>
    <div style="padding: 24px;">
      <p style="color: #334155; font-size: 16px; line-height: 1.6;">
        ${escapeHtml(config.body)}
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <a href="${escapeHtml(loginUrl)}" style="display: inline-block; background: #C26A3E; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px;">
          ${escapeHtml(config.ctaText)}
        </a>
      </div>

      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 13px;">
        <p>You can manage your email alert preferences in <a href="${escapeHtml(baseUrl)}/app/settings" style="color: #C26A3E; text-decoration: none;">Settings</a>.</p>
        <p style="margin-top: 12px;"><a href="${escapeHtml(baseUrl)}" style="color: #C26A3E; text-decoration: none;">denali.health</a> — Medicare coverage guidance</p>
        <p style="margin-top: 8px; font-size: 12px; color: #cbd5e1;">This is an automated notification. Do not reply to this email.</p>
      </div>
    </div>
  </div>
</body>
</html>`;

  return { subject: config.subject, html };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

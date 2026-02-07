/**
 * Send Outcome Followup Edge Function
 *
 * Cron-triggered (hourly). Sends email reminders asking users
 * to report their appeal outcome.
 *
 * Trigger: pg_cron or Vercel Cron hitting this endpoint
 * Pattern follows send-checklist-email.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BATCH_SIZE = 50;
const BASE_URL = Deno.env.get("SITE_URL") || "https://denali.health";

serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Use service role key for admin access (bypass RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!resendApiKey) {
      return errorResponse("RESEND_API_KEY not configured", 500);
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Find followups that are due and haven't been sent
    const { data: followups, error: queryError } = await supabase
      .from("outcome_followups")
      .select(`
        id,
        appeal_id,
        email,
        token,
        followup_type,
        scheduled_at,
        appeals!inner (
          service_description,
          denial_reason,
          status
        )
      `)
      .is("sent_at", null)
      .lte("scheduled_at", new Date().toISOString())
      .limit(BATCH_SIZE);

    if (queryError) {
      console.error("Query error:", queryError);
      return errorResponse("Failed to query followups", 500);
    }

    if (!followups || followups.length === 0) {
      return jsonResponse({ sent: 0, message: "No followups due" });
    }

    let sent = 0;
    let skipped = 0;

    for (const followup of followups) {
      // Skip if appeal already has an outcome reported
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const appeal = (followup as any).appeals;
      if (appeal?.status && appeal.status !== "draft" && appeal.status !== "pending") {
        // Mark as sent to avoid re-processing
        await supabase
          .from("outcome_followups")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", followup.id);
        skipped++;
        continue;
      }

      const procedure = appeal?.service_description || "your Medicare appeal";
      const outcomeUrl = `${BASE_URL}/outcome?token=${followup.token}`;

      const html = buildFollowupEmail(procedure, outcomeUrl, followup.followup_type);
      const subject = followup.followup_type === "day_30"
        ? "How did your Medicare appeal turn out?"
        : "Checking in on your Medicare appeal";

      // Send email via Resend
      const resendResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "denali.health <noreply@denali.health>",
          to: [followup.email],
          subject,
          html,
        }),
      });

      if (resendResponse.ok) {
        // Mark as sent
        await supabase
          .from("outcome_followups")
          .update({ sent_at: new Date().toISOString() })
          .eq("id", followup.id);
        sent++;
      } else {
        const error = await resendResponse.text();
        console.error(`Failed to send to ${followup.email}:`, error);
      }
    }

    return jsonResponse({
      sent,
      skipped,
      total: followups.length,
      message: `Sent ${sent} followup emails, skipped ${skipped}`,
    });
  } catch (error) {
    console.error("Send outcome followup error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to process followups",
      500
    );
  }
});

function buildFollowupEmail(
  procedure: string,
  outcomeUrl: string,
  followupType: string
): string {
  const isReminder = followupType === "day_60";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Appeal Outcome</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 500px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 22px;">denali.health</h1>
    </div>

    <div style="padding: 24px;">
      <h2 style="color: #1e293b; margin-top: 0; font-size: 20px;">
        ${isReminder ? "Checking in on your appeal" : "How did your appeal turn out?"}
      </h2>

      <p style="color: #475569; line-height: 1.6;">
        ${isReminder
          ? `We reached out a while back about your appeal for <strong>${procedure}</strong>. If you've heard back, we'd love to know.`
          : `About a month ago, you filed a Medicare appeal for <strong>${procedure}</strong>. We'd love to know how it went.`
        }
      </p>

      <p style="color: #475569; line-height: 1.6;">
        Your answer helps other Medicare patients facing the same denial.
      </p>

      <div style="margin: 24px 0; text-align: center;">
        <a href="${outcomeUrl}&outcome=approved"
           style="display: inline-block; padding: 14px 28px; background: #22c55e; color: white; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 4px;">
          Approved &#10003;
        </a>
        <a href="${outcomeUrl}&outcome=denied"
           style="display: inline-block; padding: 14px 28px; background: #ef4444; color: white; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 4px;">
          Denied &#10007;
        </a>
        <a href="${outcomeUrl}&outcome=pending"
           style="display: inline-block; padding: 14px 28px; background: #f59e0b; color: white; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 16px; margin: 4px;">
          Still Waiting
        </a>
      </div>

      <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; margin-top: 16px;">
        <p style="color: #166534; margin: 0; font-size: 14px;">
          <strong>As a thank you</strong>, reporting your outcome earns you a free appeal.
        </p>
      </div>

      <p style="color: #94a3b8; font-size: 13px; margin-top: 24px; text-align: center;">
        One tap is all it takes.
      </p>
    </div>
  </div>
</body>
</html>
  `;
}

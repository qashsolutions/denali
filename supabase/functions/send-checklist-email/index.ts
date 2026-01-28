/**
 * Send Checklist Email Edge Function
 *
 * POST /functions/v1/send-checklist-email
 *
 * Sends a coverage checklist to the user's email using Resend.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, handleCors, jsonResponse, errorResponse } from "../_shared/cors.ts";
import { createSupabaseClient, validateRequest } from "../_shared/auth.ts";

interface EmailRequest {
  email: string;
  subject: string;
  checklist: {
    title: string;
    procedure: string;
    diagnosis?: string;
    items: Array<{
      text: string;
      checked: boolean;
    }>;
    talkingPoints?: string[];
    tips?: string[];
  };
  conversationId?: string;
}

serve(async (req) => {
  // Handle CORS
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  try {
    // Parse request body
    const body = await req.json();

    // Validate request
    const validation = validateRequest<EmailRequest>(body, [
      "email",
      "subject",
      "checklist",
    ]);

    if (!validation.valid) {
      return errorResponse(validation.error, 400);
    }

    const { email, subject, checklist, conversationId } = validation.data;

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return errorResponse("Invalid email address", 400);
    }

    // Build HTML email content
    const html = buildEmailHTML(checklist);

    // Get Resend API key
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return errorResponse("Email service not configured", 500);
    }

    // Send email via Resend
    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "denali.health <noreply@denali.health>",
        to: [email],
        subject: subject,
        html: html,
      }),
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.text();
      console.error("Resend API error:", error);
      return errorResponse("Failed to send email", 500);
    }

    const result = await resendResponse.json();

    // Log email sent event (optional - for analytics)
    if (conversationId) {
      try {
        const supabase = createSupabaseClient(req);
        await supabase.from("user_events").insert({
          event_type: "email_sent",
          conversation_id: conversationId,
          event_data: { email_id: result.id, to: email },
        });
      } catch (err) {
        // Non-blocking - just log
        console.warn("Failed to log email event:", err);
      }
    }

    return jsonResponse({
      success: true,
      message: "Email sent successfully",
      emailId: result.id,
    });
  } catch (error) {
    console.error("Send email error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to send email",
      500
    );
  }
});

/**
 * Build HTML email content from checklist data
 */
function buildEmailHTML(checklist: EmailRequest["checklist"]): string {
  const itemsHTML = checklist.items
    .map(
      (item) => `
      <tr>
        <td style="padding: 8px 12px; border-bottom: 1px solid #e2e8f0;">
          <span style="font-size: 18px; margin-right: 8px;">${item.checked ? "☑" : "☐"}</span>
          ${item.text}
        </td>
      </tr>
    `
    )
    .join("");

  const talkingPointsHTML = checklist.talkingPoints
    ? `
      <h3 style="color: #1e293b; margin-top: 24px;">What to Say at Your Appointment</h3>
      <ul style="color: #475569; line-height: 1.6;">
        ${checklist.talkingPoints.map((point) => `<li>${point}</li>`).join("")}
      </ul>
    `
    : "";

  const tipsHTML = checklist.tips
    ? `
      <div style="background: #f0fdf4; border-left: 4px solid #22c55e; padding: 12px 16px; margin-top: 24px;">
        <strong style="color: #15803d;">Tips:</strong>
        <ul style="color: #166534; margin: 8px 0 0 0; padding-left: 20px;">
          ${checklist.tips.map((tip) => `<li>${tip}</li>`).join("")}
        </ul>
      </div>
    `
    : "";

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${checklist.title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; margin: 0; padding: 20px;">
  <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #3b82f6, #8b5cf6); padding: 24px; text-align: center;">
      <h1 style="color: white; margin: 0; font-size: 24px;">denali.health</h1>
      <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0;">Medicare Coverage Checklist</p>
    </div>

    <!-- Content -->
    <div style="padding: 24px;">
      <h2 style="color: #1e293b; margin-top: 0;">${checklist.title}</h2>

      <p style="color: #64748b; margin-bottom: 8px;">
        <strong>Procedure:</strong> ${checklist.procedure}
      </p>
      ${checklist.diagnosis ? `<p style="color: #64748b; margin-bottom: 16px;"><strong>Reason:</strong> ${checklist.diagnosis}</p>` : ""}

      <h3 style="color: #1e293b;">What Your Doctor Needs to Document</h3>
      <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border-radius: 8px; overflow: hidden;">
        ${itemsHTML}
      </table>

      ${talkingPointsHTML}
      ${tipsHTML}

      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 14px;">
        <p>Print this checklist and bring it to your appointment.</p>
        <p style="margin-top: 16px;">
          <a href="https://denali.health" style="color: #3b82f6; text-decoration: none;">denali.health</a>
          — Medicare coverage guidance
        </p>
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

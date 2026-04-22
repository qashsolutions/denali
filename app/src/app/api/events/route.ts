/**
 * POST /api/events
 *
 * Track a user behavior event for analytics.
 * Only processes events when analyticsConsent is respected (enforced client-side;
 * we trust the client not to send without consent since it's opt-in analytics).
 * Body: { eventType, phone?, conversationId?, appealId?, eventData? }
 */

import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { withMetrics } from "@/lib/metrics";
import { AUTH, VALIDATION } from "@/config/messages";

const VALID_EVENT_TYPES = new Set([
  "print",
  "copy",
  "download",
  "share",
  "return_visit",
  "upgrade",
  "cancel",
  "feedback_positive",
  "feedback_negative",
  "appeal_started",
  "appeal_completed",
  "outcome_reported",
]);

// UUID validation
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function _POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: AUTH.SIGN_IN_TO_TRACK }, { status: 401 });
  }

  let body: {
    eventType?: string;
    phone?: string;
    conversationId?: string;
    appealId?: string;
    eventData?: Record<string, unknown>;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: VALIDATION.INVALID_INPUT },
      { status: 400 },
    );
  }

  const { eventType, phone, conversationId, appealId, eventData } = body;

  if (!eventType || !VALID_EVENT_TYPES.has(eventType)) {
    return NextResponse.json(
      { error: VALIDATION.INVALID_INPUT },
      { status: 400 },
    );
  }

  // Only pass UUIDs that are actually valid
  const validConvId =
    conversationId && UUID_RE.test(conversationId) ? conversationId : null;
  const validAppealId = appealId && UUID_RE.test(appealId) ? appealId : null;

  try {
    await query(`SELECT track_user_event($1, $2, $3, $4, $5)`, [
      eventType,
      phone || null,
      validConvId,
      validAppealId,
      eventData ? JSON.stringify(eventData) : null,
    ]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Events API] Error:", err);
    // Non-critical: return success so client doesn't retry
    return NextResponse.json({ success: false });
  }
}

export const POST = withMetrics(_POST, "/api/events");

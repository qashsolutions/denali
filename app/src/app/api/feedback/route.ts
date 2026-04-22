/**
 * POST /api/feedback
 *
 * Submit feedback for a message. Authentication required.
 * Body: { messageId, rating: "up" | "down", correction? }
 */

import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { withMetrics } from "@/lib/metrics";
import { AUTH, VALIDATION, SYSTEM } from "@/config/messages";

async function _POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json(
      { error: AUTH.SIGN_IN_TO_SUBMIT_FEEDBACK },
      { status: 401 },
    );
  }
  let body: {
    messageId?: string;
    rating?: string;
    userId?: string;
    correction?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: VALIDATION.INVALID_INPUT },
      { status: 400 },
    );
  }

  const { messageId, rating, correction } = body;

  if (!messageId || !rating || !["up", "down"].includes(rating)) {
    return NextResponse.json(
      { error: VALIDATION.FEEDBACK_REQUIRED },
      { status: 400 },
    );
  }

  try {
    await query(`SELECT process_feedback($1, $2, $3, $4, $5)`, [
      messageId,
      rating,
      user.userId,
      correction || null,
      "accuracy",
    ]);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Feedback API] Error:", err);
    return NextResponse.json({ error: SYSTEM.SAVE_FEEDBACK }, { status: 500 });
  }
}

export const POST = withMetrics(_POST, "/api/feedback");

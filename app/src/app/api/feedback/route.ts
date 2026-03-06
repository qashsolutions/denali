/**
 * POST /api/feedback
 *
 * Submit feedback for a message. Anonymous users are allowed.
 * Body: { messageId, rating: "up" | "down", userId?, correction? }
 */

import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  let body: {
    messageId?: string;
    rating?: string;
    userId?: string;
    correction?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { messageId, rating, userId, correction } = body;

  if (!messageId || !rating || !["up", "down"].includes(rating)) {
    return NextResponse.json({ error: "messageId and rating (up|down) required" }, { status: 400 });
  }

  try {
    await query(
      `SELECT process_feedback($1, $2, $3, $4, $5)`,
      [messageId, rating, userId || null, correction || null, "accuracy"]
    );
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[Feedback API] Error:", err);
    return NextResponse.json({ error: "Unable to save your feedback. Please try again." }, { status: 500 });
  }
}

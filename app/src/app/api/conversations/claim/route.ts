/**
 * POST /api/conversations/claim
 *
 * Claims an anonymous conversation for the authenticated user.
 * Body: { conversationId: string }
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { AUTH, VALIDATION, SYSTEM } from "@/config/messages";

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: AUTH.SIGN_IN_REQUIRED }, { status: 401 });
  }

  let conversationId: string;
  try {
    const body = await request.json();
    conversationId = body.conversationId;
  } catch {
    return NextResponse.json({ error: VALIDATION.INVALID_INPUT }, { status: 400 });
  }

  if (!conversationId) {
    return NextResponse.json({ error: VALIDATION.CONVERSATION_ID_REQUIRED }, { status: 400 });
  }

  try {
    const result = await query<{ claim_conversation: boolean }>(
      `SELECT claim_conversation($1, $2)`,
      [conversationId, user.userId]
    );
    const claimed = result.rows[0]?.claim_conversation ?? false;
    return NextResponse.json({ claimed });
  } catch (err) {
    console.error("[Conversations/claim API] Error:", err);
    return NextResponse.json({ error: SYSTEM.GENERIC_ERROR }, { status: 500 });
  }
}

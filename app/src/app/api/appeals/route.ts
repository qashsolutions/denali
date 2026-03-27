/**
 * GET /api/appeals?conversationId=...
 *
 * Returns appeals for a conversation.
 * Anonymous conversations are accessible by ID; authenticated users see only their own.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");

  if (!conversationId) {
    return NextResponse.json({ appeals: [] });
  }

  try {
    const user = await getAuthUser(request);

    // Verify access: must be anon conversation or owned by this user
    const convResult = await query<{ user_id: string | null }>(
      `SELECT user_id FROM conversations WHERE id = $1`,
      [conversationId]
    );

    if (convResult.rows.length === 0) {
      return NextResponse.json({ appeals: [] });
    }

    const conv = convResult.rows[0];
    if (conv.user_id && user?.userId !== conv.user_id) {
      return NextResponse.json({ appeals: [] });
    }

    const result = await query<{
      id: string;
      appeal_letter: string;
      denial_reason: string | null;
      denial_date: string | null;
      deadline: string | null;
      carc_codes: string[] | null;
      cpt_codes: string[] | null;
      lcd_refs: string[] | null;
      ncd_refs: string[] | null;
      status: string | null;
      appeal_level: number;
      created_at: string;
    }>(
      `SELECT id, appeal_letter, denial_reason, denial_date, deadline,
              carc_codes, cpt_codes, lcd_refs, ncd_refs, status, appeal_level, created_at
       FROM appeals
       WHERE conversation_id = $1
       ORDER BY created_at DESC`,
      [conversationId]
    );

    const appeals = result.rows.map((a) => ({
      id: a.id,
      appealLetter: a.appeal_letter,
      denialReason: a.denial_reason,
      denialDate: a.denial_date,
      deadline: a.deadline,
      carcCodes: a.carc_codes || [],
      cptCodes: a.cpt_codes || [],
      lcdRefs: a.lcd_refs || [],
      ncdRefs: a.ncd_refs || [],
      status: a.status || "draft",
      appealLevel: a.appeal_level || 1,
      createdAt: a.created_at,
    }));

    return NextResponse.json({ appeals });
  } catch (err) {
    console.error("[Appeals API] Error:", err);
    return NextResponse.json({ appeals: [] });
  }
}

/**
 * GET /api/conversations/[id]
 *
 * Returns a conversation and its messages.
 * Anonymous conversations (user_id = NULL) are accessible by anyone with the UUID.
 * Authenticated users can only access their own conversations.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { withMetrics } from "@/lib/metrics";
import { VALIDATION, SYSTEM } from "@/config/messages";

async function _GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: conversationId } = await params;

  if (!conversationId) {
    return NextResponse.json(
      { error: VALIDATION.CONVERSATION_ID_REQUIRED },
      { status: 400 },
    );
  }

  try {
    const user = await getAuthUser(request);

    // Fetch conversation — allow if anon (user_id IS NULL) or owner matches
    const convResult = await query<{
      id: string;
      title: string | null;
      status: string;
      is_appeal: boolean;
      created_at: string;
      completed_at: string | null;
      user_id: string | null;
      last_suggestions: string[] | null;
    }>(
      `SELECT id, title, status, is_appeal, created_at, completed_at, user_id, last_suggestions
       FROM conversations
       WHERE id = $1`,
      [conversationId],
    );

    if (convResult.rows.length === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const conv = convResult.rows[0];

    // Access check: authenticated users can only see their own conversations
    if (conv.user_id && user?.userId !== conv.user_id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Fetch messages ordered by creation time
    const msgsResult = await query<{
      id: string;
      role: string;
      content: string;
      created_at: string;
      icd10_codes: string[] | null;
      cpt_codes: string[] | null;
      npi: string | null;
      policy_refs: string[] | null;
    }>(
      `SELECT id, role, content, created_at, icd10_codes, cpt_codes, npi, policy_refs
       FROM messages
       WHERE conversation_id = $1
       ORDER BY created_at ASC`,
      [conversationId],
    );

    return NextResponse.json({
      conversation: {
        id: conv.id,
        title: conv.title,
        status: conv.status,
        isAppeal: conv.is_appeal || false,
        lastSuggestions: conv.last_suggestions || [],
        createdAt: conv.created_at,
        completedAt: conv.completed_at,
        messages: msgsResult.rows.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          createdAt: msg.created_at,
          icd10Codes: msg.icd10_codes || undefined,
          cptCodes: msg.cpt_codes || undefined,
          npi: msg.npi || undefined,
          policyRefs: msg.policy_refs || undefined,
        })),
      },
    });
  } catch (err) {
    console.error("[Conversations/[id] API] Error:", err);
    return NextResponse.json(
      { error: SYSTEM.LOAD_CONVERSATION },
      { status: 500 },
    );
  }
}

export const GET = withMetrics(
  _GET as (req: NextRequest, ctx?: unknown) => Promise<Response>,
  "/api/conversations/[id]",
);

/**
 * Conversations API Route
 *
 * GET /api/conversations
 *
 * Returns conversation history for the authenticated user.
 * Auth via Cognito JWT; data from RDS PostgreSQL.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { withMetrics } from "@/lib/metrics";

async function _GET(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ conversations: [], authenticated: false });
  }

  try {
    const convsResult = await query<{
      id: string;
      title: string;
      is_appeal: boolean;
      created_at: string;
      status: string;
    }>(
      `SELECT id, title, is_appeal, created_at, status
       FROM conversations
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [user.userId],
    );

    if (convsResult.rows.length === 0) {
      return NextResponse.json({ conversations: [], authenticated: true });
    }

    const convIds = convsResult.rows.map((c: { id: string }) => c.id);

    // Load messages for previews — PostgreSQL ANY() for array membership
    const msgsResult = await query<{
      conversation_id: string;
      role: string;
      content: string;
    }>(
      `SELECT conversation_id, role, content
       FROM messages
       WHERE conversation_id = ANY($1::uuid[])
       ORDER BY created_at ASC`,
      [convIds],
    );

    const messagesByConv = new Map<
      string,
      Array<{ role: string; content: string }>
    >();
    for (const msg of msgsResult.rows) {
      const list = messagesByConv.get(msg.conversation_id) ?? [];
      list.push({ role: msg.role, content: msg.content });
      messagesByConv.set(msg.conversation_id, list);
    }

    const result = convsResult.rows.map(
      (conv: {
        id: string;
        title: string;
        is_appeal: boolean;
        created_at: string;
      }) => {
        const msgs = messagesByConv.get(conv.id) ?? [];
        const firstUser = msgs.find((m) => m.role === "user");
        const lastAssistant = [...msgs]
          .reverse()
          .find((m) => m.role === "assistant");
        return {
          id: conv.id,
          title: conv.title,
          isAppeal: conv.is_appeal || false,
          createdAt: conv.created_at,
          firstUserMessage: firstUser?.content ?? null,
          lastAssistantMessage: lastAssistant?.content ?? null,
        };
      },
    );

    return NextResponse.json({ conversations: result, authenticated: true });
  } catch (err) {
    console.error("[Conversations API] Error:", err);
    return NextResponse.json({ conversations: [], authenticated: true });
  }
}

export const GET = withMetrics(_GET, "/api/conversations");

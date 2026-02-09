/**
 * Conversations API Route
 *
 * GET /api/conversations
 *
 * Returns conversation history for the authenticated user.
 * Uses server-side Supabase client (cookie-authenticated) to bypass
 * browser client auth issues caused by refresh token races.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ conversations: [], authenticated: false });
  }

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, title, is_appeal, created_at, status")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    console.error("[Conversations API] Error fetching conversations:", error.message);
    return NextResponse.json({ conversations: [], authenticated: true });
  }

  if (!conversations || conversations.length === 0) {
    return NextResponse.json({ conversations: [], authenticated: true });
  }

  // Load first user message + last assistant message per conversation for previews
  const conversationIds = conversations.map((c) => c.id);
  const messagesByConv = new Map<
    string,
    Array<{ role: string; content: string }>
  >();

  const { data: msgs } = await supabase
    .from("messages")
    .select("conversation_id, role, content, created_at")
    .in("conversation_id", conversationIds)
    .order("created_at", { ascending: true });

  if (msgs) {
    for (const msg of msgs) {
      const convId = msg.conversation_id;
      if (!messagesByConv.has(convId)) {
        messagesByConv.set(convId, []);
      }
      messagesByConv.get(convId)!.push({
        role: msg.role,
        content: msg.content,
      });
    }
  }

  const result = conversations.map((conv) => {
    const convMsgs = messagesByConv.get(conv.id) || [];
    const firstUser = convMsgs.find((m) => m.role === "user");
    const lastAssistant = [...convMsgs]
      .reverse()
      .find((m) => m.role === "assistant");

    return {
      id: conv.id,
      title: conv.title,
      isAppeal: conv.is_appeal || false,
      createdAt: conv.created_at,
      firstUserMessage: firstUser?.content || null,
      lastAssistantMessage: lastAssistant?.content || null,
    };
  });

  return NextResponse.json({ conversations: result, authenticated: true });
}

"use client";

import { useState, useEffect, useCallback } from "react";
import {
  loadRecentConversations,
  type ConversationData,
} from "@/lib/conversation-service";
import { createClient } from "@/lib/supabase";

export interface ConversationHistoryItem {
  id: string;
  title: string;
  preview: string;
  createdAt: Date;
  isAppeal: boolean;
}

interface UseConversationHistoryReturn {
  conversations: ConversationHistoryItem[];
  isLoading: boolean;
  isVerifiedUser: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and manage conversation history
 * Only loads history for paid/authenticated users
 */
export function useConversationHistory(): UseConversationHistoryReturn {
  const [conversations, setConversations] = useState<ConversationHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifiedUser, setIsVerifiedUser] = useState(false);
  const supabase = createClient();

  const fetchHistory = useCallback(async () => {
    setIsLoading(true);

    try {
      // Check if user is authenticated
      const { data: { session } } = await supabase.auth.getSession();

      if (!session?.user) {
        setConversations([]);
        setIsVerifiedUser(false);
        setIsLoading(false);
        return;
      }

      // Check if user has verified their email
      const emailVerified = session.user.email_confirmed_at !== null;
      setIsVerifiedUser(emailVerified);

      // Only load conversations for verified users
      if (!emailVerified) {
        setConversations([]);
        setIsLoading(false);
        return;
      }

      // Load recent conversations
      const recentConversations = await loadRecentConversations({
        userId: session.user.id,
        limit: 20,
      });

      // Transform to history items with preview
      const historyItems: ConversationHistoryItem[] = recentConversations.map((conv) => ({
        id: conv.id,
        title: conv.title || generateTitle(conv),
        preview: generatePreview(conv),
        createdAt: conv.createdAt,
        isAppeal: conv.isAppeal,
      }));

      setConversations(historyItems);
    } catch (error) {
      console.error("Failed to fetch conversation history:", error);
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  // Fetch on mount
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    conversations,
    isLoading,
    isVerifiedUser,
    refresh: fetchHistory,
  };
}

/**
 * Generate a title from conversation data if not set
 */
function generateTitle(conv: ConversationData): string {
  if (conv.isAppeal) {
    return "Appeal Help";
  }

  // Try to extract key topic from messages
  if (conv.messages.length > 0) {
    const firstUserMsg = conv.messages.find((m) => m.role === "user");
    if (firstUserMsg) {
      // Extract first ~30 chars as title
      const content = firstUserMsg.content.slice(0, 30);
      return content.length < firstUserMsg.content.length ? `${content}...` : content;
    }
  }

  return "Coverage Question";
}

/**
 * Generate a preview snippet from the conversation
 */
function generatePreview(conv: ConversationData): string {
  if (conv.messages.length === 0) {
    return "No messages yet";
  }

  // Get last assistant message as preview
  const lastAssistant = [...conv.messages]
    .reverse()
    .find((m) => m.role === "assistant");

  if (lastAssistant) {
    const preview = lastAssistant.content.slice(0, 50);
    return preview.length < lastAssistant.content.length ? `${preview}...` : preview;
  }

  return "...";
}

/**
 * Group conversations by date for display
 */
export function groupConversationsByDate(
  conversations: ConversationHistoryItem[]
): Record<string, ConversationHistoryItem[]> {
  const groups: Record<string, ConversationHistoryItem[]> = {};
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const lastWeek = new Date(today);
  lastWeek.setDate(lastWeek.getDate() - 7);
  const lastMonth = new Date(today);
  lastMonth.setMonth(lastMonth.getMonth() - 1);

  for (const conv of conversations) {
    const convDate = new Date(conv.createdAt);
    let groupKey: string;

    if (convDate >= today) {
      groupKey = "Today";
    } else if (convDate >= yesterday) {
      groupKey = "Yesterday";
    } else if (convDate >= lastWeek) {
      groupKey = "Past Week";
    } else if (convDate >= lastMonth) {
      groupKey = "Past Month";
    } else {
      groupKey = "Older";
    }

    if (!groups[groupKey]) {
      groups[groupKey] = [];
    }
    groups[groupKey].push(conv);
  }

  return groups;
}

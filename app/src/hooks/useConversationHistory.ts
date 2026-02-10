"use client";

import { useState, useEffect, useCallback } from "react";
import { getClient } from "@/lib/supabase";
import { cacheSet, cacheGetIfFresh, STORES, TTL } from "@/lib/offline-cache";

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
 * Hook to fetch and manage conversation history.
 *
 * Fetches via /api/conversations (server-side, cookie-authenticated)
 * to avoid the browser Supabase client refresh-token race condition.
 */
export function useConversationHistory(): UseConversationHistoryReturn {
  const [conversations, setConversations] = useState<ConversationHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifiedUser, setIsVerifiedUser] = useState(false);
  const supabase = getClient();

  const loadConversations = useCallback(async () => {
    setIsLoading(true);

    try {
      const res = await fetch("/api/conversations");
      if (!res.ok) {
        throw new Error(`Conversations API returned ${res.status}`);
      }

      const data = await res.json();

      if (!data.authenticated) {
        setConversations([]);
        setIsVerifiedUser(false);
        return;
      }

      setIsVerifiedUser(true);

      const historyItems: ConversationHistoryItem[] = (data.conversations || []).map(
        (conv: {
          id: string;
          title: string | null;
          isAppeal: boolean;
          createdAt: string;
          firstUserMessage: string | null;
          lastAssistantMessage: string | null;
        }) => ({
          id: conv.id,
          title: conv.title || generateTitle(conv.firstUserMessage, conv.isAppeal),
          preview: generatePreview(conv.lastAssistantMessage),
          createdAt: new Date(conv.createdAt),
          isAppeal: conv.isAppeal,
        })
      );

      setConversations(historyItems);

      // Write-through: cache for offline access (fire-and-forget)
      cacheSet(STORES.CONVERSATIONS, "list", historyItems);
    } catch (error) {
      console.error("Failed to fetch conversation history:", error);

      // Offline fallback: try IndexedDB cache
      const cached = await cacheGetIfFresh<ConversationHistoryItem[]>(
        STORES.CONVERSATIONS,
        "list",
        TTL.CONVERSATIONS
      );
      if (cached) {
        // Restore Date objects from serialized strings
        setConversations(
          cached.data.map((c) => ({ ...c, createdAt: new Date(c.createdAt) }))
        );
        setIsVerifiedUser(true);
      } else {
        setConversations([]);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearUser = useCallback(() => {
    setConversations([]);
    setIsVerifiedUser(false);
    setIsLoading(false);
  }, []);

  // Load on mount, then re-fetch when auth state changes (sign-in / sign-out)
  useEffect(() => {
    loadConversations();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          loadConversations();
        } else {
          clearUser();
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, loadConversations, clearUser]);

  const refresh = useCallback(async () => {
    await loadConversations();
  }, [loadConversations]);

  return {
    conversations,
    isLoading,
    isVerifiedUser,
    refresh,
  };
}

/**
 * Generate a title from conversation data if not set
 */
function generateTitle(firstUserMessage: string | null, isAppeal: boolean): string {
  if (isAppeal) {
    return "Appeal Help";
  }

  if (firstUserMessage) {
    const content = firstUserMessage.slice(0, 30);
    return content.length < firstUserMessage.length ? `${content}...` : content;
  }

  return "Coverage Question";
}

/**
 * Generate a preview snippet from the conversation
 */
function generatePreview(lastAssistantMessage: string | null): string {
  if (!lastAssistantMessage) {
    return "No messages yet";
  }

  const preview = lastAssistantMessage.slice(0, 50);
  return preview.length < lastAssistantMessage.length ? `${preview}...` : preview;
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

/**
 * Conversation Persistence Service
 *
 * Handles saving and loading conversations and messages to/from Supabase.
 */

import { createClient } from "./supabase";
import { MEDICARE_CONSTANTS } from "@/config";
import type { Database } from "@/types/database";

type Conversation = Database["public"]["Tables"]["conversations"]["Row"];
type Message = Database["public"]["Tables"]["messages"]["Row"];
type ConversationInsert = Database["public"]["Tables"]["conversations"]["Insert"];
type MessageInsert = Database["public"]["Tables"]["messages"]["Insert"];

export interface ConversationData {
  id: string;
  title: string | null;
  status: string;
  isAppeal: boolean;
  messages: MessageData[];
  createdAt: Date;
  completedAt: Date | null;
}

export interface MessageData {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Date;
  icd10Codes?: string[];
  cptCodes?: string[];
  npi?: string;
  policyRefs?: string[];
}

/**
 * Create a new conversation
 */
export async function createConversation(
  options: {
    userId?: string;
    phone?: string;
    isAppeal?: boolean;
    title?: string;
  } = {}
): Promise<string | null> {
  const supabase = createClient();

  const conversationData: ConversationInsert = {
    user_id: options.userId || null,
    phone: options.phone || null,
    is_appeal: options.isAppeal || false,
    title: options.title || null,
    status: "active",
    started_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("conversations")
    .insert(conversationData)
    .select("id")
    .single();

  if (error) {
    console.error("Failed to create conversation:", error);
    return null;
  }

  return data.id;
}

/**
 * Save a message to the database
 */
export async function saveMessage(
  conversationId: string,
  message: {
    role: "user" | "assistant" | "system";
    content: string;
    icd10Codes?: string[];
    cptCodes?: string[];
    npi?: string;
    policyRefs?: string[];
  }
): Promise<string | null> {
  const supabase = createClient();

  const messageData: MessageInsert = {
    conversation_id: conversationId,
    role: message.role,
    content: message.content,
    icd10_codes: message.icd10Codes || null,
    cpt_codes: message.cptCodes || null,
    npi: message.npi || null,
    policy_refs: message.policyRefs || null,
  };

  const { data, error } = await supabase
    .from("messages")
    .insert(messageData)
    .select("id")
    .single();

  if (error) {
    console.error("Failed to save message:", error);
    return null;
  }

  return data.id;
}

/**
 * Load a conversation with all its messages
 */
export async function loadConversation(
  conversationId: string
): Promise<ConversationData | null> {
  const supabase = createClient();

  // Fetch conversation
  const { data: conversation, error: convError } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (convError || !conversation) {
    console.error("Failed to load conversation:", convError);
    return null;
  }

  // Fetch messages
  const { data: messages, error: msgError } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });

  if (msgError) {
    console.error("Failed to load messages:", msgError);
    return null;
  }

  return {
    id: conversation.id,
    title: conversation.title,
    status: conversation.status,
    isAppeal: conversation.is_appeal || false,
    createdAt: new Date(conversation.created_at),
    completedAt: conversation.completed_at
      ? new Date(conversation.completed_at)
      : null,
    messages: (messages || []).map((msg) => ({
      id: msg.id,
      role: msg.role as "user" | "assistant" | "system",
      content: msg.content,
      timestamp: new Date(msg.created_at),
      icd10Codes: msg.icd10_codes || undefined,
      cptCodes: msg.cpt_codes || undefined,
      npi: msg.npi || undefined,
      policyRefs: msg.policy_refs || undefined,
    })),
  };
}

/**
 * Load recent conversations for a user
 */
export async function loadRecentConversations(
  options: {
    userId?: string;
    phone?: string;
    limit?: number;
  } = {}
): Promise<ConversationData[]> {
  const supabase = createClient();
  const limit = options.limit || 10;

  let query = supabase
    .from("conversations")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (options.userId) {
    query = query.eq("user_id", options.userId);
  } else if (options.phone) {
    query = query.eq("phone", options.phone);
  }

  const { data: conversations, error } = await query;

  if (error || !conversations) {
    console.error("Failed to load conversations:", error);
    return [];
  }

  return conversations.map((conv) => ({
    id: conv.id,
    title: conv.title,
    status: conv.status,
    isAppeal: conv.is_appeal || false,
    createdAt: new Date(conv.created_at),
    completedAt: conv.completed_at ? new Date(conv.completed_at) : null,
    messages: [], // Messages loaded separately on demand
  }));
}

/**
 * Update conversation status
 */
export async function updateConversationStatus(
  conversationId: string,
  status: "active" | "completed" | "archived",
  title?: string
): Promise<boolean> {
  const supabase = createClient();

  const updates: Record<string, unknown> = { status };

  if (status === "completed") {
    updates.completed_at = new Date().toISOString();
  }

  if (title) {
    updates.title = title;
  }

  const { error } = await supabase
    .from("conversations")
    .update(updates)
    .eq("id", conversationId);

  if (error) {
    console.error("Failed to update conversation:", error);
    return false;
  }

  return true;
}

/**
 * Submit feedback for a message
 * Anonymous users can provide feedback without authentication
 */
export async function submitMessageFeedback(
  messageId: string,
  rating: "up" | "down",
  userId?: string,
  correction?: string
): Promise<boolean> {
  const supabase = createClient();

  const params = {
    p_message_id: messageId,
    p_rating: rating,
    p_user_id: userId,
    p_correction: correction,
    p_feedback_type: "accuracy",
  };

  console.log("[Feedback] Submitting feedback:", JSON.stringify(params, null, 2));

  // Use the database function for proper feedback processing
  // All parameters except p_message_id are optional to support anonymous users
  // Valid feedback_type values: 'accuracy', 'clarity', 'completeness', 'other'
  const { data, error } = await supabase.rpc("process_feedback", params);

  if (error) {
    console.error("[Feedback] Failed to submit feedback:", error);
    return false;
  }

  console.log("[Feedback] Success, feedback_id:", data);
  return true;
}

/**
 * Save an appeal to the database
 */
export async function saveAppeal(
  conversationId: string,
  phone: string,
  appealData: {
    appealLetter: string;
    denialDate?: string;
    denialReason?: string;
    serviceDescription?: string;
    icd10Codes?: string[];
    cptCodes?: string[];
    ncdRefs?: string[];
    lcdRefs?: string[];
    pubmedRefs?: string[];
    userId?: string;
  }
): Promise<string | null> {
  const supabase = createClient();

  // Calculate deadline
  let deadline: string | null = null;
  if (appealData.denialDate) {
    const denialDate = new Date(appealData.denialDate);
    const deadlineDate = new Date(denialDate);
    deadlineDate.setDate(deadlineDate.getDate() + MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS);
    deadline = deadlineDate.toISOString();
  }

  const { data, error } = await supabase
    .from("appeals")
    .insert({
      conversation_id: conversationId,
      phone,
      user_id: appealData.userId || null,
      appeal_letter: appealData.appealLetter,
      denial_date: appealData.denialDate || null,
      denial_reason: appealData.denialReason || null,
      service_description: appealData.serviceDescription || null,
      icd10_codes: appealData.icd10Codes || null,
      cpt_codes: appealData.cptCodes || null,
      ncd_refs: appealData.ncdRefs || null,
      lcd_refs: appealData.lcdRefs || null,
      pubmed_refs: appealData.pubmedRefs || null,
      deadline,
      status: "draft",
      paid: false,
    })
    .select("id")
    .single();

  if (error) {
    console.error("Failed to save appeal:", error);
    return null;
  }

  // Increment appeal count
  await supabase.rpc("increment_appeal_count", {
    p_phone: phone,
    p_user_id: appealData.userId,
  });

  return data.id;
}

/**
 * Check appeal access for a user
 * Returns: 'free' (first appeal), 'paywall' (needs payment), 'allowed' (has subscription)
 */
export async function checkAppealAccess(
  phone: string,
  userId?: string
): Promise<{
  access: "free" | "paywall" | "allowed";
  appealCount: number;
  hasSubscription: boolean;
}> {
  const supabase = createClient();

  try {
    // First try the RPC function if available
    const { data: rpcResult, error: rpcError } = await supabase.rpc(
      "check_appeal_access",
      { p_phone: phone }
    );

    if (!rpcError && rpcResult) {
      // RPC returns 'free', 'paywall', or 'allowed'
      return {
        access: rpcResult as "free" | "paywall" | "allowed",
        appealCount: 0, // RPC doesn't return count
        hasSubscription: rpcResult === "allowed",
      };
    }

    // Fallback: Check manually
    // 1. Get appeal count from usage table
    const { data: usageData } = await supabase
      .from("usage")
      .select("appeal_count")
      .eq("phone", phone)
      .single();

    const appealCount = usageData?.appeal_count ?? 0;

    // 2. Check for active subscription
    let hasSubscription = false;
    if (userId) {
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("status, plan_type")
        .eq("user_id", userId)
        .eq("status", "active")
        .single();

      hasSubscription = !!subData;
    }

    // Determine access
    let access: "free" | "paywall" | "allowed";
    if (hasSubscription) {
      access = "allowed";
    } else if (appealCount === 0) {
      access = "free"; // First appeal is free
    } else {
      access = "paywall"; // Needs to pay for additional appeals
    }

    return { access, appealCount, hasSubscription };
  } catch (error) {
    console.error("Failed to check appeal access:", error);
    // Default to free on error (graceful degradation)
    return { access: "free", appealCount: 0, hasSubscription: false };
  }
}

/**
 * Get appeal count for a phone number
 */
export async function getAppealCount(phone: string): Promise<number> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("usage")
    .select("appeal_count")
    .eq("phone", phone)
    .single();

  if (error || !data) {
    return 0;
  }

  return data.appeal_count;
}

/**
 * Check if user has active subscription
 */
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", userId)
    .eq("status", "active")
    .single();

  return !error && !!data;
}

// Valid event types per database constraint
const VALID_EVENT_TYPES = [
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
] as const;

type ValidEventType = (typeof VALID_EVENT_TYPES)[number];

/**
 * Track a user event for analytics
 * All parameters are optional to support anonymous users
 */
export async function trackEvent(
  eventType: string,
  options: {
    phone?: string;
    conversationId?: string;
    appealId?: string;
    eventData?: Record<string, unknown>;
  } = {}
): Promise<void> {
  const supabase = createClient();

  console.log("[TrackEvent] Input:", { eventType, options });

  // Validate event type
  if (!VALID_EVENT_TYPES.includes(eventType as ValidEventType)) {
    console.error(
      "[TrackEvent] Invalid event type:",
      eventType,
      "| Valid types:",
      VALID_EVENT_TYPES.join(", ")
    );
    return;
  }

  // UUID validation regex
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  // Only pass IDs if they're valid UUIDs (database requires UUID format)
  const conversationId = options.conversationId && uuidRegex.test(options.conversationId)
    ? options.conversationId
    : undefined;
  const appealId = options.appealId && uuidRegex.test(options.appealId)
    ? options.appealId
    : undefined;

  console.log("[TrackEvent] UUID validation:", {
    inputConvId: options.conversationId,
    validatedConvId: conversationId,
    inputAppealId: options.appealId,
    validatedAppealId: appealId,
  });

  const params = {
    p_event_type: eventType,
    p_phone: options.phone,
    p_conversation_id: conversationId,
    p_appeal_id: appealId,
    p_event_data: options.eventData as Record<string, string | number | boolean | null> | undefined,
  };

  console.log("[TrackEvent] Calling RPC with params:", JSON.stringify(params, null, 2));

  try {
    const { data, error } = await supabase.rpc("track_user_event", params);

    if (error) {
      console.error("[TrackEvent] RPC error:", {
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      });
    } else {
      console.log("[TrackEvent] Success, event_id:", data);
    }
  } catch (error) {
    // Non-blocking - just log
    console.error("[TrackEvent] Exception:", error);
  }
}

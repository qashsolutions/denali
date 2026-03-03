/**
 * Conversation Persistence Service
 *
 * Client-side functions for conversations, appeals, feedback, and events.
 * All DB access goes through API routes — no direct RDS calls from client.
 */

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
 * Load a conversation with all its messages.
 * Anonymous conversations are accessible by ID (UUID is unguessable).
 * Authenticated users can only access their own conversations.
 */
export async function loadConversation(
  conversationId: string
): Promise<ConversationData | null> {
  try {
    const res = await fetch(`/api/conversations/${conversationId}`, {
      credentials: "include",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.conversation) return null;

    const conv = data.conversation;
    return {
      id: conv.id,
      title: conv.title,
      status: conv.status,
      isAppeal: conv.isAppeal || false,
      createdAt: new Date(conv.createdAt),
      completedAt: conv.completedAt ? new Date(conv.completedAt) : null,
      messages: (conv.messages || []).map((msg: {
        id: string;
        role: string;
        content: string;
        createdAt: string;
        icd10Codes?: string[];
        cptCodes?: string[];
        npi?: string;
        policyRefs?: string[];
      }) => ({
        id: msg.id,
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
        timestamp: new Date(msg.createdAt),
        icd10Codes: msg.icd10Codes || undefined,
        cptCodes: msg.cptCodes || undefined,
        npi: msg.npi || undefined,
        policyRefs: msg.policyRefs || undefined,
      })),
    };
  } catch (err) {
    console.error("[loadConversation] Failed:", err);
    return null;
  }
}

/**
 * Summary of an appeal record for inline display
 */
export interface AppealSummary {
  id: string;
  appealLetter: string;
  denialReason: string | null;
  denialDate: string | null;
  deadline: string | null;
  carcCodes: string[];
  cptCodes: string[];
  lcdRefs: string[];
  ncdRefs: string[];
  status: string;
  createdAt: Date;
}

/**
 * Load appeals associated with a conversation.
 */
export async function loadAppealsForConversation(
  conversationId: string
): Promise<AppealSummary[]> {
  try {
    const res = await fetch(`/api/appeals?conversationId=${encodeURIComponent(conversationId)}`, {
      credentials: "include",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.appeals || []).map((a: {
      id: string;
      appealLetter: string;
      denialReason: string | null;
      denialDate: string | null;
      deadline: string | null;
      carcCodes: string[];
      cptCodes: string[];
      lcdRefs: string[];
      ncdRefs: string[];
      status: string;
      createdAt: string;
    }) => ({
      ...a,
      createdAt: new Date(a.createdAt),
    }));
  } catch (err) {
    console.error("[loadAppealsForConversation] Failed:", err);
    return [];
  }
}

/**
 * Claim an anonymous conversation for the authenticated user.
 */
export async function claimConversation(
  conversationId: string
): Promise<boolean> {
  try {
    const res = await fetch("/api/conversations/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ conversationId }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.claimed;
  } catch (err) {
    console.error("[claimConversation] Failed:", err);
    return false;
  }
}

/**
 * Submit feedback for a message.
 * Anonymous users can provide feedback.
 */
export async function submitMessageFeedback(
  messageId: string,
  rating: "up" | "down",
  userId?: string,
  correction?: string
): Promise<boolean> {
  try {
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        messageId,
        rating,
        userId,
        correction,
      }),
    });
    return res.ok;
  } catch (err) {
    console.error("[submitMessageFeedback] Failed:", err);
    return false;
  }
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
 * Track a user event for analytics.
 * Respects analytics consent — only tracks if user has explicitly opted in.
 */
export async function trackEvent(
  eventType: string,
  options: {
    phone?: string;
    conversationId?: string;
    appealId?: string;
    eventData?: Record<string, unknown>;
    analyticsConsent?: boolean;
  } = {}
): Promise<void> {
  // Validate event type
  if (!VALID_EVENT_TYPES.includes(eventType as ValidEventType)) {
    console.error("[trackEvent] Invalid event type:", eventType);
    return;
  }

  // Respect analytics consent
  if (options.analyticsConsent !== true) return;

  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        eventType,
        phone: options.phone,
        conversationId: options.conversationId,
        appealId: options.appealId,
        eventData: options.eventData,
      }),
    });
  } catch (err) {
    console.error("[trackEvent] Failed:", err);
  }
}


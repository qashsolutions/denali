"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Message } from "@/types";
import type { ChecklistData } from "@/components/chat/PrintableChecklist";
import type { SessionState } from "@/lib/claude";
import { MEDICARE_CONSTANTS } from "@/config";
import {
  saveMessage,
  loadConversation,
  loadAppealsForConversation,
  claimConversation,
  submitMessageFeedback,
  trackEvent,
} from "@/lib/conversation-service";

export interface AppealLetterData {
  letterContent: string;
  denialCodes: string[];
  policyReferences: string[];
  denialDate: string | null;
  appealDeadline: string | null;
  conversationId: string | null;
}

export interface UseChatOptions {
  conversationId?: string;
  userId?: string;
  initialMessages?: Message[];
  onError?: (error: Error) => void;
}

export type ChatAction =
  | { type: "none" }
  | { type: "show_print"; data: ChecklistData }
  | { type: "prompt_email"; existingEmail: string | null }
  | { type: "email_sent"; email: string }
  | { type: "show_appeal"; data: AppealLetterData }
  | { type: "report_outcome"; appealId: string };

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  suggestions: string[];
  conversationId: string | null;
  currentAction: ChatAction;
  checklistData: ChecklistData | null;
  userEmail: string | null;
  appealData: AppealLetterData | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  resetChat: () => void;
  submitFeedback: (messageId: string, rating: "up" | "down") => Promise<void>;
  triggerPrint: () => void;
  triggerEmail: () => void;
  triggerOutcomeReport: () => void;
  showAppealModal: () => void;
  setUserEmail: (email: string) => void;
  sendEmail: (email: string) => Promise<void>;
  submitAppealOutcome: (outcome: "approved" | "denied" | "partial", daysToDecision?: number) => Promise<void>;
  dismissAction: () => void;
}

// Extract checklist data from Claude's response
function extractChecklistData(content: string): ChecklistData | null {
  // Look for checklist patterns in the response
  const hasChecklist =
    content.includes("□") ||
    content.includes("**What the doctor needs") ||
    content.includes("documentation");

  if (!hasChecklist) return null;

  // Extract service name from context
  let serviceName = "Medicare Service";
  if (content.toLowerCase().includes("mri")) {
    serviceName = content.toLowerCase().includes("lumbar")
      ? "Lumbar Spine MRI"
      : content.toLowerCase().includes("knee")
      ? "Knee MRI"
      : "MRI";
  } else if (content.toLowerCase().includes("ct") || content.toLowerCase().includes("scan")) {
    serviceName = "CT Scan";
  } else if (content.toLowerCase().includes("replacement")) {
    serviceName = content.toLowerCase().includes("knee")
      ? "Knee Replacement"
      : content.toLowerCase().includes("hip")
      ? "Hip Replacement"
      : "Joint Replacement";
  } else if (content.toLowerCase().includes("therapy")) {
    serviceName = "Physical Therapy";
  }

  // Extract requirements (lines starting with □ or checkboxes)
  const requirements: string[] = [];
  const requirementMatches = content.match(/□\s*([^\n]+)/g);
  if (requirementMatches) {
    requirementMatches.forEach((match) => {
      const cleaned = match.replace(/□\s*/, "").trim();
      if (cleaned && !cleaned.includes("**")) {
        requirements.push(cleaned);
      }
    });
  }

  // Extract questions (lines with quotes or starting with -)
  const questions: string[] = [];
  const questionMatches = content.match(/-\s*['"]([^'"]+)['"]/g) || content.match(/-\s*"([^"]+)"/g);
  if (questionMatches) {
    questionMatches.forEach((match) => {
      const cleaned = match.replace(/^-\s*/, "").trim();
      if (cleaned) {
        questions.push(cleaned);
      }
    });
  }

  // If we couldn't extract specific items, use defaults based on service
  if (requirements.length === 0) {
    requirements.push(
      "Medical necessity documented",
      "Relevant symptoms and duration noted",
      "Prior treatments documented if applicable"
    );
  }

  if (questions.length === 0) {
    questions.push(
      '"Can you note in my chart how long I\'ve had these symptoms?"',
      '"Can you document what treatments I\'ve already tried?"',
      '"Is there anything else Medicare needs documented?"'
    );
  }

  return {
    serviceName,
    generatedDate: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    requirements: requirements.slice(0, 5),
    questions: questions.slice(0, 4),
  };
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { initialMessages = [], onError, userId } = options;

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(
    options.conversationId || null
  );
  const [currentAction, setCurrentAction] = useState<ChatAction>({ type: "none" });
  const [checklistData, setChecklistData] = useState<ChecklistData | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sessionState, setSessionState] = useState<SessionState | null>(null);
  const [appealData, setAppealData] = useState<AppealLetterData | null>(null);
  const [appealId, setAppealId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const isInitializedRef = useRef(false);

  // Load existing conversation if ID provided
  useEffect(() => {
    if (options.conversationId && !isInitializedRef.current) {
      isInitializedRef.current = true;
      loadConversation(options.conversationId).then((data) => {
        if (data) {
          setMessages(
            data.messages.map((msg) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp,
              icd10Codes: msg.icd10Codes,
              cptCodes: msg.cptCodes,
              npi: msg.npi,
              policyRefs: msg.policyRefs,
            }))
          );
          setConversationId(data.id);
        }
      });

      // Also load appeals for this conversation
      loadAppealsForConversation(options.conversationId).then((appeals) => {
        if (appeals.length > 0) {
          const latest = appeals[0];
          setAppealData({
            letterContent: latest.appealLetter,
            denialCodes: latest.carcCodes,
            policyReferences: [...latest.lcdRefs, ...latest.ncdRefs],
            denialDate: latest.denialDate,
            appealDeadline: latest.deadline,
            conversationId: options.conversationId || null,
          });
          setAppealId(latest.id);
        }
      });
    }
  }, [options.conversationId]);

  // Claim anonymous conversation for authenticated user
  useEffect(() => {
    if (userId && conversationId) {
      claimConversation(conversationId).catch((err) =>
        console.warn("Failed to claim conversation:", err)
      );
    }
  }, [userId, conversationId]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Create user message
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setError(null);
    setSuggestions([]);
    setCurrentAction({ type: "none" });

    try {
      // Track conversation ID locally (server creates the conversation)
      let currentConversationId = conversationId;

      // Prepare messages for API
      const apiMessages = [...messages, userMessage].map((msg) => ({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      }));

      // Call the chat API
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: apiMessages,
          conversationId: currentConversationId,
          sessionState,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      const data = await response.json();

      // Update conversation ID from server response
      if (data.conversationId && !currentConversationId) {
        currentConversationId = data.conversationId;
        setConversationId(data.conversationId);

        // Claim the conversation immediately so message saves work
        // (messages RLS requires conversation to be owned by auth.uid())
        if (userId) {
          await claimConversation(data.conversationId).catch((err) =>
            console.warn("Failed to claim conversation:", err)
          );
        }
      }

      // Update session state
      if (data.sessionState) {
        setSessionState(data.sessionState);
      }

      // Save user message to database (after claim so RLS passes)
      if (currentConversationId) {
        saveMessage(currentConversationId, {
          role: "user",
          content: userMessage.content,
        }).catch((err) => console.warn("Failed to save user message:", err));
      }

      // Create assistant message
      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: data.content,
        timestamp: new Date(),
      };

      // Save assistant message to database
      if (currentConversationId) {
        const savedMsgId = await saveMessage(currentConversationId, {
          role: "assistant",
          content: assistantMessage.content,
        });
        if (savedMsgId) {
          assistantMessage.id = savedMsgId;
        }
      }

      setMessages((prev) => [...prev, assistantMessage]);
      setSuggestions(data.suggestions || []);

      // Capture appealId from API response
      if (data.appealId) {
        setAppealId(data.appealId);
      }

      // Check if response generated an appeal letter
      if (data.toolsUsed?.includes("generate_appeal_letter") && data.sessionState) {
        const ss = data.sessionState as SessionState;
        let deadline: string | null = null;
        if (ss.denialDate) {
          const deadlineDate = new Date(ss.denialDate);
          deadlineDate.setDate(deadlineDate.getDate() + MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS);
          deadline = deadlineDate.toISOString();
        }
        const appeal: AppealLetterData = {
          letterContent: data.appealLetter || data.content,
          denialCodes: ss.denialCodes || [],
          policyReferences: ss.policyReferences || [],
          denialDate: ss.denialDate || null,
          appealDeadline: deadline,
          conversationId: currentConversationId || null,
        };
        setAppealData(appeal);
        // Don't auto-open modal — inline AppealCard will render instead
        trackEvent("appeal_completed", {
          conversationId: currentConversationId || undefined,
          appealId: data.appealId || undefined,
        });
      } else {
        // Check if response contains checklist data
        const extractedChecklist = extractChecklistData(data.content);
        if (extractedChecklist) {
          setChecklistData(extractedChecklist);
        }

        // Handle special actions based on user input
        const lower = content.toLowerCase();
        if (lower.includes("print") && (lower.includes("checklist") || lower.includes("now"))) {
          const printData = checklistData || extractedChecklist;
          if (printData) {
            setCurrentAction({ type: "show_print", data: printData });
          }
        } else if (lower.includes("email") && (lower.includes("me") || lower.includes("to me"))) {
          setCurrentAction({ type: "prompt_email", existingEmail: userEmail });
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const error = err instanceof Error ? err : new Error("Failed to send message");
      setError(error);
      onError?.(error);

      // Add error message to chat
      const errorMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setSuggestions(["Try again", "Start a new question"]);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, onError, checklistData, userEmail, messages, sessionState, userId]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSuggestions([]); // No suggestions until Claude responds
    setConversationId(null);
    setError(null);
    setChecklistData(null);
    setCurrentAction({ type: "none" });
    setSessionState(null);
    setAppealData(null);
    setAppealId(null);
  }, []);

  const submitFeedback = useCallback(async (messageId: string, rating: "up" | "down") => {
    console.log("[submitFeedback] Starting:", { messageId, rating, conversationId });
    try {
      // Submit feedback to database
      const success = await submitMessageFeedback(messageId, rating);
      console.log("[submitFeedback] submitMessageFeedback result:", success);

      if (success) {
        // Track the feedback event - use correct event types from constraint
        const eventType = rating === "up" ? "feedback_positive" : "feedback_negative";
        console.log("[submitFeedback] Tracking event:", eventType);
        await trackEvent(eventType, {
          conversationId: conversationId || undefined,
          eventData: { messageId, rating },
        });
        console.log("[submitFeedback] trackEvent completed");
      }
    } catch (err) {
      console.error("[submitFeedback] Failed:", err);
    }
  }, [conversationId]);

  const triggerPrint = useCallback(() => {
    if (checklistData) {
      setCurrentAction({ type: "show_print", data: checklistData });
    } else {
      // Generate default checklist if none exists
      const defaultChecklist: ChecklistData = {
        serviceName: "Medicare Service",
        generatedDate: new Date().toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        }),
        requirements: [
          "Medical necessity documented",
          "Relevant symptoms and duration noted",
          "Prior treatments documented if applicable",
          "Physical exam findings recorded",
        ],
        questions: [
          '"Can you note in my chart how long I\'ve had these symptoms?"',
          '"Can you document what treatments I\'ve already tried?"',
          '"Is there anything else Medicare needs documented?"',
        ],
      };
      setChecklistData(defaultChecklist);
      setCurrentAction({ type: "show_print", data: defaultChecklist });
    }
  }, [checklistData]);

  const triggerEmail = useCallback(() => {
    setCurrentAction({ type: "prompt_email", existingEmail: userEmail });
  }, [userEmail]);

  const sendEmail = useCallback(async (email: string) => {
    // Save email for future use
    setUserEmail(email);

    const data = checklistData;
    if (!data) {
      console.error("No checklist data to send");
      return;
    }

    try {
      // Call Supabase Edge function to send email
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (supabaseUrl && supabaseKey) {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/send-checklist-email`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${supabaseKey}`,
            },
            body: JSON.stringify({
              email,
              checklist: data,
              conversationId,
            }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to send email");
        }
      } else {
        // Development fallback
        console.log(`[DEV] Would send checklist to ${email}`);
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      setCurrentAction({ type: "email_sent", email });

      // Add confirmation message
      const confirmMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: `Done! I've sent the checklist to **${email}**. Check your inbox (and spam folder, just in case).`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, confirmMessage]);
      setSuggestions(["Print checklist", "What if it's denied?", "New question"]);

      // Clear action after a moment
      setTimeout(() => setCurrentAction({ type: "none" }), 500);
    } catch (error) {
      console.error("Failed to send email:", error);

      // Show error message
      const errorMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: `Sorry, I couldn't send the email. Please try again or use the print option instead.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setSuggestions(["Print checklist", "Try email again", "New question"]);
      setCurrentAction({ type: "none" });
    }
  }, [checklistData, conversationId]);

  const triggerOutcomeReport = useCallback(() => {
    if (appealId) {
      setCurrentAction({ type: "report_outcome", appealId });
    }
  }, [appealId]);

  const showAppealModal = useCallback(() => {
    if (appealData) {
      setCurrentAction({ type: "show_appeal", data: appealData });
    }
  }, [appealData]);

  const submitAppealOutcome = useCallback(async (
    outcome: "approved" | "denied" | "partial",
    daysToDecision?: number
  ) => {
    if (!appealId) return;

    try {
      const response = await fetch("/api/appeal-outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ appealId, outcome, daysToDecision }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit outcome");
      }

      // Add confirmation message
      const outcomeLabels = { approved: "approved", denied: "denied", partial: "partially approved" };
      const confirmMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: `Thank you for letting us know your appeal was **${outcomeLabels[outcome]}**. This helps us improve our recommendations for others.`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, confirmMessage]);
      setCurrentAction({ type: "none" });

      trackEvent("outcome_reported", {
        conversationId: conversationId || undefined,
        appealId,
        eventData: { outcome, daysToDecision },
      });
    } catch (err) {
      console.error("Failed to submit appeal outcome:", err);
      const errorMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "Sorry, I couldn't save your outcome. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setCurrentAction({ type: "none" });
    }
  }, [appealId, conversationId]);

  const dismissAction = useCallback(() => {
    setCurrentAction({ type: "none" });
  }, []);

  return {
    messages,
    isLoading,
    error,
    suggestions,
    conversationId,
    currentAction,
    checklistData,
    userEmail,
    appealData,
    sendMessage,
    clearMessages,
    resetChat: clearMessages, // Alias for sidebar integration
    submitFeedback,
    triggerPrint,
    triggerEmail,
    triggerOutcomeReport,
    showAppealModal,
    setUserEmail,
    sendEmail,
    submitAppealOutcome,
    dismissAction,
  };
}

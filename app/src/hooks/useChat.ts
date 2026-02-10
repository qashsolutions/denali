"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type { Message } from "@/types";
import type { FileAttachment } from "@/types/attachment";
import type { ChecklistData } from "@/components/chat/PrintableChecklist";
import { type SessionState, createDefaultSessionState } from "@/lib/claude";
import { MEDICARE_CONSTANTS } from "@/config";
import {
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
  initialSessionState?: Partial<SessionState>;
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
  sendMessage: (content: string, attachment?: FileAttachment) => Promise<void>;
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
  const [sessionState, setSessionState] = useState<SessionState | null>(
    options.initialSessionState
      ? { ...createDefaultSessionState(), ...options.initialSessionState }
      : null
  );
  const [appealData, setAppealData] = useState<AppealLetterData | null>(null);
  const [appealId, setAppealId] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const loadedConversationRef = useRef<string | null>(null);

  // Sync initialSessionState when health data loads asynchronously.
  // Only merge if no messages sent yet (to avoid overwriting server-returned state).
  useEffect(() => {
    if (options.initialSessionState && messages.length === 0) {
      setSessionState(prev => {
        // Don't overwrite if server already returned a richer state
        if (prev && prev.userName) return prev;
        return { ...createDefaultSessionState(), ...prev, ...options.initialSessionState };
      });
    }
  }, [options.initialSessionState, messages.length]);

  // Load existing conversation if ID provided (or changed via sidebar click)
  useEffect(() => {
    if (!options.conversationId) return;
    // Skip if we already loaded this exact conversation
    if (loadedConversationRef.current === options.conversationId) return;
    loadedConversationRef.current = options.conversationId;

    // Reset state for the new conversation
    setMessages([]);
    setSuggestions([]);
    setChecklistData(null);
    setCurrentAction({ type: "none" });
    setSessionState(null);
    setAppealData(null);
    setAppealId(null);
    setConversationId(options.conversationId);

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
  }, [options.conversationId]);

  // Claim anonymous conversation for authenticated user
  useEffect(() => {
    if (userId && conversationId) {
      claimConversation(conversationId).catch((err) =>
        console.warn("Failed to claim conversation:", err)
      );
    }
  }, [userId, conversationId]);

  const sendMessage = useCallback(async (content: string, attachment?: FileAttachment) => {
    if (!content.trim() && !attachment) return;

    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Client-side timeout: abort if no response within 5.5 minutes
    // (Vercel maxDuration is 300s; this gives a buffer for network latency)
    const timeoutId = setTimeout(() => {
      abortControllerRef.current?.abort();
    }, 330_000);

    // Create user message (with attachment marker for display)
    let displayContent = content.trim();
    if (attachment) {
      const marker = `[Attached: ${attachment.fileName}]`;
      displayContent = displayContent ? `${displayContent}\n\n${marker}` : marker;
    }
    const userMessage: Message = {
      id: generateId(),
      role: "user",
      content: displayContent,
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
          ...(attachment ? { attachment } : {}),
        }),
        signal: abortControllerRef.current.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        // Handle trial expired / locked out (403)
        if (response.status === 403 && errorData.code === "TRIAL_EXPIRED") {
          const expiredMsg: Message = {
            id: generateId(),
            role: "assistant",
            content: "Your free trial has ended. **Upgrade** to keep chatting with Denali and generating appeal letters.",
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, expiredMsg]);
          setSuggestions(["Upgrade plan"]);
          setIsLoading(false);
          clearTimeout(timeoutId);
          return;
        }

        // Handle rate limiting (429)
        if (response.status === 429 && errorData.code === "RATE_LIMITED") {
          const rateLimitMsg: Message = {
            id: generateId(),
            role: "assistant",
            content: errorData.isAuthenticated
              ? `You've reached your daily limit of ${errorData.limit} messages. You can continue tomorrow, or upgrade for unlimited access.`
              : `You've used your free message for today. **Sign up** for a 14-day trial with 3 messages per day.`,
            timestamp: new Date(),
          };
          setMessages((prev) => [...prev, rateLimitMsg]);
          setSuggestions(
            errorData.isAuthenticated
              ? ["Upgrade plan"]
              : ["Sign up"]
          );
          setIsLoading(false);
          clearTimeout(timeoutId);
          return;
        }

        throw new Error(errorData.error || `API error: ${response.status}`);
      }

      // Check if response is SSE stream or JSON
      const contentType = response.headers.get("Content-Type") || "";
      const isStream = contentType.includes("text/event-stream");

      let data: {
        content: string;
        suggestions: string[];
        conversationId: string;
        sessionState: SessionState;
        toolsUsed: string[];
        appealId?: string;
        appealLetter?: string;
      };

      if (isStream && response.body) {
        // SSE streaming: read events incrementally for real-time text display
        const streamingMsgId = generateId();
        const streamingMessage: Message = {
          id: streamingMsgId,
          role: "assistant",
          content: "",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, streamingMessage]);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let streamedText = "";
        data = { content: "", suggestions: [], conversationId: "", sessionState: {} as SessionState, toolsUsed: [] };

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events (separated by double newlines)
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            if (!part.trim()) continue;
            const lines = part.split("\n");
            let eventType = "";
            let eventData = "";

            for (const line of lines) {
              if (line.startsWith("event: ")) {
                eventType = line.slice(7);
              } else if (line.startsWith("data: ")) {
                eventData = line.slice(6);
              }
            }
            if (!eventData) continue;

            try {
              const parsed = JSON.parse(eventData);

              if (eventType === "delta") {
                // Append streaming text to the assistant message
                streamedText += parsed.text;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.id === streamingMsgId) {
                    return [...prev.slice(0, -1), { ...last, content: streamedText }];
                  }
                  return prev;
                });
              } else if (eventType === "tool") {
                // Tool being executed — clear streamed text, show in console
                streamedText = "";
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.id === streamingMsgId) {
                    return [...prev.slice(0, -1), { ...last, content: "" }];
                  }
                  return prev;
                });
                console.log("[useChat] Tool executing:", parsed.name);
              } else if (eventType === "done") {
                // Final metadata — replace streamed text with clean content
                data = parsed;
                setMessages((prev) => {
                  const last = prev[prev.length - 1];
                  if (last?.id === streamingMsgId) {
                    return [...prev.slice(0, -1), { ...last, content: data.content }];
                  }
                  return prev;
                });
              } else if (eventType === "error") {
                throw new Error(parsed.error || "Stream error");
              }
            } catch (parseErr) {
              if (parseErr instanceof Error && parseErr.message !== "Stream error") {
                console.warn("[useChat] Failed to parse SSE event:", parseErr);
              } else {
                throw parseErr;
              }
            }
          }
        }
      } else {
        // JSON fallback (non-streaming response)
        data = await response.json();

        const assistantMessage: Message = {
          id: generateId(),
          role: "assistant",
          content: data.content,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMessage]);
      }

      // Update session state
      if (data.sessionState) {
        setSessionState(data.sessionState);
      }

      // Messages are saved server-side by route.ts using authSupabase.
      if (data.conversationId && !currentConversationId) {
        currentConversationId = data.conversationId;
        setConversationId(data.conversationId);
      }
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
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === "AbortError") {
        // Distinguish user-initiated abort from timeout abort
        // If loading is still true, this was a timeout (not a user navigating away)
        const errorMessage: Message = {
          id: generateId(),
          role: "assistant",
          content: "This is taking longer than usual. Please try again — it usually works on the second try.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setSuggestions(["Try again", "Start a new question"]);
        setIsLoading(false);
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
  }, [conversationId, onError, checklistData, userEmail, messages, sessionState]);

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

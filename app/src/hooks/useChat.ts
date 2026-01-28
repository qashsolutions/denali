"use client";

import { useState, useCallback, useRef } from "react";
import type { Message } from "@/types";
import type { ChecklistData } from "@/components/chat/PrintableChecklist";

export interface UseChatOptions {
  conversationId?: string;
  initialMessages?: Message[];
  onError?: (error: Error) => void;
}

export type ChatAction =
  | { type: "none" }
  | { type: "show_print"; data: ChecklistData }
  | { type: "prompt_email"; existingEmail: string | null }
  | { type: "email_sent"; email: string };

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  suggestions: string[];
  conversationId: string | null;
  currentAction: ChatAction;
  checklistData: ChecklistData | null;
  userEmail: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  submitFeedback: (messageId: string, rating: "up" | "down") => Promise<void>;
  triggerPrint: () => void;
  triggerEmail: () => void;
  setUserEmail: (email: string) => void;
  sendEmail: (email: string) => Promise<void>;
  dismissAction: () => void;
}

// Mock checklist data based on conversation
function generateChecklistData(): ChecklistData {
  return {
    serviceName: "Lumbar Spine MRI",
    generatedDate: new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    requirements: [
      "Pain has lasted more than 6 weeks",
      "Prior treatments tried (physical therapy, medication)",
      "Neurological symptoms if present (numbness, weakness)",
      "Physical exam findings documented",
      "Medical necessity clearly stated",
    ],
    questions: [
      '"Can you note in my chart how long I\'ve had this pain?"',
      '"Can you document that I\'ve tried [treatments] without enough relief?"',
      '"Can you describe how this affects my daily activities?"',
      '"Is there anything else Medicare needs documented?"',
    ],
  };
}

// Mock responses for development
const MOCK_RESPONSES: Record<string, { content: string; suggestions: string[] }> = {
  default: {
    content: "I'd be happy to help you understand Medicare coverage. Could you tell me a bit more about your situation? What service or procedure are you asking about?",
    suggestions: ["MRI scan", "Physical therapy", "Surgery"],
  },
  mri: {
    content: "I can help with MRI coverage. Medicare typically covers MRI scans when they're medically necessary.\n\nTo give you specific guidance, I have a few questions:\n\nHow long have you been experiencing symptoms?",
    suggestions: ["Less than 6 weeks", "6 weeks to 3 months", "More than 3 months"],
  },
  duration: {
    content: "Thank you. That's helpful information.\n\nHas your doctor recommended any other treatments first, like physical therapy or medication?",
    suggestions: ["Yes, I've tried other treatments", "No, not yet", "I'm not sure"],
  },
  treatments: {
    content: "Good to know. One more question:\n\nAre you experiencing any symptoms that radiate to other areas, like pain going down your leg or arm?",
    suggestions: ["Yes, radiating symptoms", "No, localized only"],
  },
  guidance: {
    content: "Based on what you've told me, here's what Medicare typically requires for MRI approval:\n\n**Documentation Checklist:**\n□ Duration of symptoms (you mentioned this)\n□ Prior treatments tried\n□ Neurological symptoms if present\n□ Physical exam findings\n\n**What to ask your doctor to document:**\n• How long you've had symptoms\n• What treatments you've already tried\n• Any weakness, numbness, or radiating pain\n• Why an MRI is needed for diagnosis\n\nWould you like me to create a printable version of this checklist?",
    suggestions: ["Print checklist", "Email to me", "What if it's denied?"],
  },
  appeal: {
    content: "I'm sorry to hear about your denial. I can help you understand the appeal process.\n\nCould you tell me:\n1. What service was denied?\n2. What reason did they give for the denial?",
    suggestions: ["Show me the appeal process", "I have my denial letter"],
  },
};

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getMockResponse(content: string, hasChecklist: boolean): {
  content: string;
  suggestions: string[];
  actionType?: "print" | "email";
} {
  const lower = content.toLowerCase();

  // Handle print request
  if (lower.includes("print") && (lower.includes("checklist") || lower.includes("now"))) {
    return {
      content: "Opening your printable checklist now. You can print it directly or save as PDF.",
      suggestions: ["Email to me", "What if it's denied?", "New question"],
      actionType: "print",
    };
  }

  // Handle email request
  if (lower.includes("email") && (lower.includes("me") || lower.includes("to me"))) {
    return {
      content: "I'll send the checklist to your email.",
      suggestions: ["Print checklist", "What if it's denied?", "New question"],
      actionType: "email",
    };
  }

  if (lower.includes("mri") || lower.includes("scan")) {
    return MOCK_RESPONSES.mri;
  }
  if (lower.includes("week") || lower.includes("month") || lower.includes("less than") || lower.includes("more than")) {
    return MOCK_RESPONSES.duration;
  }
  if (lower.includes("tried") || lower.includes("treatment") || lower.includes("therapy") || lower.includes("medication")) {
    return MOCK_RESPONSES.treatments;
  }
  if (lower.includes("radiat") || lower.includes("leg") || lower.includes("arm") || lower.includes("yes, ") || lower.includes("no, ")) {
    return MOCK_RESPONSES.guidance;
  }
  if (lower.includes("denied") || lower.includes("denial") || lower.includes("appeal")) {
    return MOCK_RESPONSES.appeal;
  }

  return MOCK_RESPONSES.default;
}

export function useChat(options: UseChatOptions = {}): UseChatReturn {
  const { initialMessages = [], onError } = options;

  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([
    "Will Medicare cover my MRI?",
    "Help me appeal a denial",
  ]);
  const [conversationId, setConversationId] = useState<string | null>(
    options.conversationId || null
  );
  const [currentAction, setCurrentAction] = useState<ChatAction>({ type: "none" });
  const [checklistData, setChecklistData] = useState<ChecklistData | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

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
      // Generate conversation ID if not exists
      if (!conversationId) {
        setConversationId(`conv_${Date.now()}`);
      }

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 400));

      // Get mock response
      const mockResponse = getMockResponse(content, !!checklistData);

      // Generate checklist data if showing guidance
      if (mockResponse === MOCK_RESPONSES.guidance) {
        setChecklistData(generateChecklistData());
      }

      // Create assistant message
      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: mockResponse.content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setSuggestions(mockResponse.suggestions);

      // Handle special actions
      if (mockResponse.actionType === "print") {
        const data = checklistData || generateChecklistData();
        setChecklistData(data);
        setCurrentAction({ type: "show_print", data });
      } else if (mockResponse.actionType === "email") {
        setCurrentAction({ type: "prompt_email", existingEmail: userEmail });
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      const error = err instanceof Error ? err : new Error("Failed to send message");
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, onError, checklistData, userEmail]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSuggestions([
      "Will Medicare cover my MRI?",
      "Help me appeal a denial",
    ]);
    setConversationId(null);
    setError(null);
    setChecklistData(null);
    setCurrentAction({ type: "none" });
  }, []);

  const submitFeedback = useCallback(async (messageId: string, rating: "up" | "down") => {
    try {
      console.log(`Feedback for ${messageId}: ${rating}`);
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    }
  }, []);

  const triggerPrint = useCallback(() => {
    const data = checklistData || generateChecklistData();
    setChecklistData(data);
    setCurrentAction({ type: "show_print", data });
  }, [checklistData]);

  const triggerEmail = useCallback(() => {
    setCurrentAction({ type: "prompt_email", existingEmail: userEmail });
  }, [userEmail]);

  const sendEmail = useCallback(async (email: string) => {
    // Save email for future use
    setUserEmail(email);

    const data = checklistData || generateChecklistData();

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
    sendMessage,
    clearMessages,
    submitFeedback,
    triggerPrint,
    triggerEmail,
    setUserEmail,
    sendEmail,
    dismissAction,
  };
}

"use client";

import { useState, useCallback, useRef } from "react";
import type { Message } from "@/types";

interface UseChatOptions {
  conversationId?: string;
  initialMessages?: Message[];
  onError?: (error: Error) => void;
}

interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  suggestions: string[];
  conversationId: string | null;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
  submitFeedback: (messageId: string, rating: "up" | "down") => Promise<void>;
}

// Mock responses for development - will be replaced with Edge function calls
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
    suggestions: ["Print checklist", "What if it's denied?", "New question"],
  },
  appeal: {
    content: "I'm sorry to hear about your denial. I can help you understand the appeal process.\n\nCould you tell me:\n1. What service was denied?\n2. What reason did they give for the denial?",
    suggestions: ["Show me the appeal process", "I have my denial letter"],
  },
};

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getMockResponse(content: string): { content: string; suggestions: string[] } {
  const lower = content.toLowerCase();

  if (lower.includes("mri") || lower.includes("scan")) {
    return MOCK_RESPONSES.mri;
  }
  if (lower.includes("week") || lower.includes("month") || lower.includes("less than") || lower.includes("more than")) {
    return MOCK_RESPONSES.duration;
  }
  if (lower.includes("tried") || lower.includes("treatment") || lower.includes("therapy") || lower.includes("medication")) {
    return MOCK_RESPONSES.treatments;
  }
  if (lower.includes("radiat") || lower.includes("leg") || lower.includes("arm") || lower.includes("yes") || lower.includes("no")) {
    return MOCK_RESPONSES.guidance;
  }
  if (lower.includes("denied") || lower.includes("denial") || lower.includes("appeal")) {
    return MOCK_RESPONSES.appeal;
  }
  if (lower.includes("print") || lower.includes("checklist")) {
    return {
      content: "I've prepared a printable checklist for you. Click the button below to print or save it.",
      suggestions: ["Print now", "Email to me", "New question"],
    };
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

    try {
      // Generate conversation ID if not exists
      if (!conversationId) {
        setConversationId(`conv_${Date.now()}`);
      }

      // TODO: Replace with actual Edge function call
      // const response = await fetch('/api/chat', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ message: content, conversationId }),
      //   signal: abortControllerRef.current.signal,
      // });

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 500));

      // Get mock response
      const mockResponse = getMockResponse(content);

      // Create assistant message
      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: mockResponse.content,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setSuggestions(mockResponse.suggestions);
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        return; // Request was cancelled
      }
      const error = err instanceof Error ? err : new Error("Failed to send message");
      setError(error);
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [conversationId, onError]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setSuggestions([
      "Will Medicare cover my MRI?",
      "Help me appeal a denial",
    ]);
    setConversationId(null);
    setError(null);
  }, []);

  const submitFeedback = useCallback(async (messageId: string, rating: "up" | "down") => {
    try {
      // TODO: Replace with actual Edge function call
      console.log(`Feedback for ${messageId}: ${rating}`);

      // await fetch('/api/feedback', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ messageId, rating }),
      // });
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    }
  }, []);

  return {
    messages,
    isLoading,
    error,
    suggestions,
    conversationId,
    sendMessage,
    clearMessages,
    submitFeedback,
  };
}

"use client";

import { Suspense, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PageContainer, Container } from "@/components/layout/Container";
import { Message, LoadingMessage } from "@/components/chat/Message";
import { ChatInput } from "@/components/chat/ChatInput";
import { Suggestions } from "@/components/chat/Suggestions";
import { useTheme } from "@/hooks/useTheme";
import { useChat } from "@/hooks/useChat";

function ChatContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isDark, toggleTheme } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    messages,
    isLoading,
    suggestions,
    sendMessage,
    submitFeedback,
  } = useChat();

  // Handle initial message from URL params
  useEffect(() => {
    const initialMessage = searchParams.get("message");
    if (initialMessage && messages.length === 0) {
      sendMessage(initialMessage);
    }
  }, [searchParams, messages.length, sendMessage]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleBack = () => {
    router.push("/");
  };

  const handleSuggestionSelect = (suggestion: string) => {
    sendMessage(suggestion);
  };

  return (
    <PageContainer>
      <Header
        showBack
        onBack={handleBack}
        showThemeToggle
        onThemeToggle={toggleTheme}
        isDark={isDark}
      />

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          <Container className="py-4">
            {messages.length === 0 && !isLoading ? (
              <EmptyState onSuggestionSelect={handleSuggestionSelect} />
            ) : (
              <div className="space-y-1">
                {messages
                  .filter((message) => message.role !== "system")
                  .map((message) => (
                    <Message
                      key={message.id}
                      id={message.id}
                      role={message.role as "user" | "assistant"}
                      content={message.content}
                      timestamp={message.timestamp}
                      showFeedback={message.role === "assistant"}
                      onFeedback={(rating) => submitFeedback(message.id, rating)}
                    />
                  ))}
                {isLoading && <LoadingMessage />}
                <div ref={messagesEndRef} />
              </div>
            )}
          </Container>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && !isLoading && (
          <div className="px-4 py-2 border-t border-[var(--border)] bg-[var(--bg-primary)]">
            <Container>
              <Suggestions
                suggestions={suggestions}
                onSelect={handleSuggestionSelect}
                disabled={isLoading}
              />
            </Container>
          </div>
        )}

        {/* Chat Input */}
        <div className="p-4 pb-8 bg-[var(--bg-primary)] border-t border-[var(--border)]">
          <Container>
            <ChatInput
              onSend={sendMessage}
              disabled={isLoading}
              placeholder="Type your message..."
            />
          </Container>
        </div>
      </main>
    </PageContainer>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatLoadingFallback />}>
      <ChatContent />
    </Suspense>
  );
}

function ChatLoadingFallback() {
  return (
    <PageContainer>
      <Header />
      <main className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-[var(--text-secondary)]">
          Loading...
        </div>
      </main>
    </PageContainer>
  );
}

function EmptyState({
  onSuggestionSelect,
}: {
  onSuggestionSelect: (suggestion: string) => void;
}) {
  const commonQuestions = [
    "Will Medicare cover my MRI?",
    "What does my doctor need to document?",
    "Help me appeal a denial",
    "How do I know if a service is covered?",
  ];

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-[var(--accent-primary)]/20 flex items-center justify-center mb-4">
        <ChatIcon className="w-8 h-8 text-[var(--accent-primary)]" />
      </div>
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
        How can I help?
      </h2>
      <p className="text-[var(--text-secondary)] mb-6 max-w-sm">
        Ask me about Medicare coverage, what your doctor needs to document, or
        help with an appeal.
      </p>

      <div className="w-full max-w-sm space-y-2">
        {commonQuestions.map((question, index) => (
          <button
            key={index}
            onClick={() => onSuggestionSelect(question)}
            className="w-full text-left px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent-primary)] transition-colors text-sm"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}

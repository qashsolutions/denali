"use client";

import { Suspense, useEffect, useRef, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { PageContainer, Container } from "@/components/layout/Container";
import { Message, LoadingMessage } from "@/components/chat/Message";
import { ChatInput } from "@/components/chat/ChatInput";
import { PrintableChecklist } from "@/components/chat/PrintableChecklist";
import { EmailPrompt } from "@/components/chat/EmailPrompt";
import { useTheme } from "@/components/ThemeProvider";
import { useChat } from "@/hooks/useChat";
import { MountainIcon, SunIcon, MoonIcon } from "@/components/icons";
import { BRAND } from "@/config";

function ChatContent() {
  const searchParams = useSearchParams();
  const { isDark, toggleTheme } = useTheme();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pendingInput, setPendingInput] = useState<string | undefined>(undefined);

  const {
    messages,
    isLoading,
    suggestions,
    currentAction,
    sendMessage,
    submitFeedback,
    dismissAction,
    sendEmail,
    triggerEmail,
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

  // Initial cards: send immediately
  const handleInitialCardSelect = (question: string) => {
    sendMessage(question);
  };

  // Suggestion buttons (after Claude responds): populate text box for review
  const handleSuggestionSelect = (suggestion: string) => {
    setPendingInput(suggestion);
  };

  const handlePendingInputUsed = useCallback(() => {
    setPendingInput(undefined);
  }, []);

  const handlePrintComplete = useCallback(() => {
    // Track print event (would call API in production)
    console.log("Print completed");
  }, []);

  const handleEmailFromPrint = useCallback(() => {
    dismissAction();
    triggerEmail();
  }, [dismissAction, triggerEmail]);

  return (
    <PageContainer>
      {/* Branded Header */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[var(--bg-primary)]/90 border-b border-[var(--border)]/50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            {/* Logo + Brand */}
            <Link href="/" className="flex items-center gap-3 group">
              <MountainIcon className="w-10 h-8 transition-transform group-hover:scale-105" />
              <span className="text-lg font-bold text-[var(--text-primary)]">
                {BRAND.NAME}
              </span>
            </Link>

            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors hover:bg-[var(--border)]"
              aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
            >
              {isDark ? (
                <SunIcon className="w-5 h-5 text-yellow-400" />
              ) : (
                <MoonIcon className="w-5 h-5 text-[var(--text-secondary)]" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto">
          <Container className="py-4">
            {messages.length === 0 && !isLoading ? (
              <EmptyState onSuggestionSelect={handleInitialCardSelect} />
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

                {/* Email Prompt - inline in messages */}
                {currentAction.type === "prompt_email" && (
                  <div className="max-w-[85%]">
                    <EmailPrompt
                      existingEmail={currentAction.existingEmail}
                      onConfirm={sendEmail}
                      onCancel={dismissAction}
                    />
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </Container>
        </div>

        {/* Chat Input with integrated suggestions */}
        <div className="p-4 bg-[var(--bg-primary)] border-t border-[var(--border)]">
          <Container>
            <ChatInput
              onSend={sendMessage}
              disabled={isLoading}
              placeholder="Type your message..."
              externalValue={pendingInput}
              onExternalValueUsed={handlePendingInputUsed}
              suggestions={currentAction.type === "none" ? suggestions : []}
              onSuggestionClick={handleSuggestionSelect}
            />
          </Container>
        </div>

        {/* Compact Footer */}
        <footer className="py-3 px-4 bg-[var(--bg-secondary)] border-t border-[var(--border)]">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs text-[var(--text-muted)]">
              {BRAND.NAME} · {BRAND.COMPANY_ATTRIBUTION} · Coverage guidance only, not medical advice
            </p>
          </div>
        </footer>
      </main>

      {/* Print Preview Modal */}
      {currentAction.type === "show_print" && (
        <PrintableChecklist
          data={currentAction.data}
          onClose={dismissAction}
          onPrint={handlePrintComplete}
          onEmail={handleEmailFromPrint}
        />
      )}
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
      <header className="sticky top-0 z-50 backdrop-blur-md bg-[var(--bg-primary)]/90 border-b border-[var(--border)]/50">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-3">
              <MountainIcon className="w-10 h-8" />
              <span className="text-lg font-bold text-[var(--text-primary)]">
                {BRAND.NAME}
              </span>
            </Link>
          </div>
        </div>
      </header>
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

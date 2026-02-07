"use client";

import { Suspense, useEffect, useRef, useCallback, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Container } from "@/components/layout/Container";
import { Sidebar, SidebarToggle } from "@/components/layout/Sidebar";
import { Message, LoadingMessage } from "@/components/chat/Message";
import { ChatInput } from "@/components/chat/ChatInput";
import { PrintableChecklist } from "@/components/chat/PrintableChecklist";
import { EmailPrompt } from "@/components/chat/EmailPrompt";
import {
  AppealCard,
  AppealLetterModal,
  AppealOutcomePrompt,
} from "@/components/appeal";
import { useChat } from "@/hooks/useChat";
import { useAuth } from "@/hooks/useAuth";
import { BRAND } from "@/config";

function ClaimsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { authState } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pendingInput, setPendingInput] = useState<string | undefined>(
    undefined
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paymentToast, setPaymentToast] = useState<string | null>(null);

  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment === "success") {
      setPaymentToast("Payment successful! Your plan has been upgraded.");
      const timer = setTimeout(() => {
        window.location.replace("/app/claims");
      }, 2000);
      return () => clearTimeout(timer);
    } else if (payment === "cancelled") {
      setPaymentToast("Payment was cancelled.");
      router.replace("/app/claims");
      const timer = setTimeout(() => setPaymentToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  const urlConversationId = searchParams.get("id") || undefined;

  const {
    messages,
    isLoading,
    suggestions,
    currentAction,
    appealData,
    sendMessage,
    submitFeedback,
    dismissAction,
    sendEmail,
    triggerEmail,
    triggerOutcomeReport,
    showAppealModal,
    submitAppealOutcome,
    resetChat,
    conversationId,
  } = useChat({
    conversationId: urlConversationId,
    userId: authState.userId || undefined,
  });

  useEffect(() => {
    const initialMessage = searchParams.get("message");
    if (initialMessage && messages.length === 0) {
      sendMessage(initialMessage);
    }
  }, [searchParams, messages.length, sendMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setSidebarOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleInitialCardSelect = (question: string) => sendMessage(question);
  const handleSuggestionSelect = (suggestion: string) =>
    setPendingInput(suggestion);
  const handlePendingInputUsed = useCallback(() => setPendingInput(undefined), []);
  const handlePrintComplete = useCallback(() => {}, []);
  const handleEmailFromPrint = useCallback(() => {
    dismissAction();
    triggerEmail();
  }, [dismissAction, triggerEmail]);
  const handleReportOutcome = useCallback(() => {
    dismissAction();
    triggerOutcomeReport();
  }, [dismissAction, triggerOutcomeReport]);
  const handleNewChat = useCallback(() => {
    resetChat();
    router.push("/app/claims");
  }, [resetChat, router]);

  return (
    <div className="flex flex-1 min-h-0">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentConversationId={conversationId ?? undefined}
        onNewChat={handleNewChat}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center h-12 px-4 md:hidden">
          <SidebarToggle onClick={() => setSidebarOpen(true)} />
          <span className="ml-2 text-sm font-medium text-[var(--text-primary)]">
            Claims & Appeals
          </span>
        </div>

        {paymentToast && (
          <div className="mx-4 mt-2 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-300 text-sm text-center">
            {paymentToast}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <Container className="py-4">
            {messages.length === 0 && !isLoading ? (
              <ClaimsEmptyState onSuggestionSelect={handleInitialCardSelect} />
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
                      onFeedback={(rating) =>
                        submitFeedback(message.id, rating)
                      }
                    />
                  ))}
                {isLoading && <LoadingMessage />}

                {currentAction.type === "prompt_email" && (
                  <div className="max-w-[85%]">
                    <EmailPrompt
                      existingEmail={currentAction.existingEmail}
                      onConfirm={sendEmail}
                      onCancel={dismissAction}
                    />
                  </div>
                )}

                {currentAction.type === "report_outcome" && (
                  <div className="max-w-[85%]">
                    <AppealOutcomePrompt
                      onSubmit={submitAppealOutcome}
                      onCancel={dismissAction}
                    />
                  </div>
                )}

                {appealData && currentAction.type !== "show_appeal" && (
                  <AppealCard data={appealData} onView={showAppealModal} />
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </Container>
        </div>

        <div className="p-4 bg-[var(--bg-primary)] border-t border-[var(--border)]">
          <Container>
            <ChatInput
              onSend={sendMessage}
              disabled={isLoading}
              placeholder="Describe your denial or ask about coverage..."
              externalValue={pendingInput}
              onExternalValueUsed={handlePendingInputUsed}
              suggestions={
                currentAction.type === "none" ? suggestions : []
              }
              onSuggestionClick={handleSuggestionSelect}
            />
          </Container>
        </div>

        <footer className="py-2 px-4 bg-[var(--bg-secondary)] border-t border-[var(--border)]">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs text-[var(--text-muted)]">
              {BRAND.NAME} · Coverage guidance only, not medical advice
            </p>
          </div>
        </footer>
      </div>

      {currentAction.type === "show_print" && (
        <PrintableChecklist
          data={currentAction.data}
          onClose={dismissAction}
          onPrint={handlePrintComplete}
          onEmail={handleEmailFromPrint}
        />
      )}

      {currentAction.type === "show_appeal" && appealData && (
        <AppealLetterModal
          data={appealData}
          onClose={dismissAction}
          onReportOutcome={handleReportOutcome}
        />
      )}
    </div>
  );
}

export default function AppClaimsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-[var(--text-secondary)]">
            Loading...
          </div>
        </div>
      }
    >
      <ClaimsContent />
    </Suspense>
  );
}

function ClaimsEmptyState({
  onSuggestionSelect,
}: {
  onSuggestionSelect: (suggestion: string) => void;
}) {
  const claimsQuestions = [
    "Will Medicare cover my MRI?",
    "Help me appeal a denial",
    "What does code CO-50 mean?",
    "What does my doctor need to document?",
  ];

  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="w-16 h-16 rounded-full bg-amber-500/20 flex items-center justify-center mb-4">
        <ClaimsEmptyIcon className="w-8 h-8 text-amber-500" />
      </div>
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
        Claims & Appeals
      </h2>
      <p className="text-[var(--text-secondary)] mb-6 max-w-sm">
        Get coverage guidance, understand denial codes, or create appeal letters
        with the right citations.
      </p>

      <div className="w-full max-w-sm space-y-2">
        {claimsQuestions.map((question, index) => (
          <button
            key={index}
            onClick={() => onSuggestionSelect(question)}
            className="w-full text-left px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:border-amber-500 transition-colors text-sm"
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}

function ClaimsEmptyIcon({ className }: { className?: string }) {
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
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
    </svg>
  );
}

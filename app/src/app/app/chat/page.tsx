"use client";

import { Suspense, useEffect, useRef, useCallback, useState, useMemo } from "react";
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
import { CmsPledge } from "@/components/ui";
import { useChat } from "@/hooks/useChat";
import { useAuth } from "@/hooks/useAuth";
import { useHealthData } from "@/hooks/useHealthData";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useDiabetesSnapshots } from "@/hooks/useDiabetesSnapshots";
import { classifyDiabetesStatus, classifyObesityStatus } from "@/lib/fhir/transforms";
import {
  ShieldCheckIcon,
  ScaleIcon,
  DiabetesIcon,
  DocumentTextIcon,
  HeartPulseIcon,
  ClipboardCheckIcon,
} from "@/components/icons";
import { getGreeting } from "@/lib/utils";
import type { SessionState } from "@/lib/session-state";
import { getUploadLimitForPlan } from "@/config/pricing";


function ChatContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { authState } = useAuth();
  const { isOnline } = useOnlineStatus();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [pendingInput, setPendingInput] = useState<string | undefined>(
    undefined
  );
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paymentToast, setPaymentToast] = useState<string | null>(null);

  // Health data → sessionState bridge
  const { coverage, claims, labs, conditions, medications, screenings, providers, hospitalizations, isConnected } = useHealthData();
  const { a1cHistory } = useDiabetesSnapshots();

  // Compute upload limit based on user's plan
  const uploadLimit = useMemo(() => {
    return getUploadLimitForPlan(
      authState.plan || null,
      authState.isAdmin || false,
      !!authState.email
    );
  }, [authState.plan, authState.isAdmin, authState.email]);

  const initialSessionState = useMemo(() => {
    if (!isConnected) return undefined;

    const conditionsForState = conditions.map(c => ({ code: c.code, name: c.name, category: c.category }));
    const medsForState = medications.map(m => ({
      name: m.name,
      status: m.status,
      isDiabetesMed: m.isDiabetesMed,
      isObesityMed: m.isObesityMed,
      daysSupply: m.daysSupply,
      isBrandName: m.isBrandName,
      gapDays: m.gapDays,
    }));

    const { classification: diabetesClassification } = classifyDiabetesStatus(conditions, labs, medications);
    const { classification: obesityClassification } = classifyObesityStatus(conditions, medications);

    const partial: Partial<SessionState> = {
      healthDataAvailable: true,
      activeCoverage: coverage.filter(c => c.status === "Active").map(c => c.type),
      recentDenials: claims.filter(c => c.status === "Denied").slice(0, 5).map(c => ({
        serviceDate: c.serviceDate,
        procedure: c.procedures[0] || c.type,
        denialCode: c.carcCodes?.[0] || "",
        denialReason: c.denialReasons?.[0] || "Claim denied",
      })),
      labs: labs.map(l => ({ name: l.name, value: l.value, unit: l.unit, date: l.date })),
      conditions: conditionsForState,
      medications: medsForState,
      diabetesClassification,
      obesityClassification,
      screenings: screenings.map(s => ({
        screeningType: s.screeningType,
        displayName: s.displayName,
        lastDate: s.lastDate,
        monthsSinceLast: s.monthsSinceLast,
        isOverdue: s.isOverdue,
      })),
      providers: providers.slice(0, 10).map(p => ({
        name: p.name,
        specialty: p.specialty,
        visitCount: p.visitCount,
        lastSeen: p.lastSeen,
      })),
      hospitalizations: hospitalizations.map(h => ({
        admissionDate: h.admissionDate,
        dischargeDate: h.dischargeDate,
        lengthOfStay: h.lengthOfStay,
        diagnoses: h.diagnoses,
        provider: h.provider,
        daysSinceDischarge: h.daysSinceDischarge,
        needsFollowUp: h.needsFollowUp,
      })),
      recentClaims: claims.slice(0, 5).map(c => ({
        serviceDate: c.serviceDate,
        type: c.type,
        provider: c.provider,
        procedures: c.procedures,
        diagnosis: c.diagnosis,
        totalCharged: c.totalCharged,
        medicarePaid: c.medicarePaid,
        youOwe: c.youOwe,
        status: c.status,
        denialReasons: c.denialReasons,
      })),
    };

    // Auto-detect Medicare type from Blue Button coverage
    const coverageTypes = partial.activeCoverage || [];
    if (coverageTypes.some(t => t.includes("Part C") || t.includes("Advantage"))) {
      partial.medicareType = "advantage";
      const partC = coverage.find(c =>
        c.status === "Active" && (c.type.includes("Part C") || c.type.includes("Advantage"))
      );
      if (partC?.planName) {
        partial.maPlanName = partC.planName;
      }
    } else if (coverageTypes.some(t => t.includes("Part A") || t.includes("Part B"))) {
      partial.medicareType = "original";
    }

    // Add longitudinal lab trends if available
    if (a1cHistory.length > 0) {
      partial.labTrends = a1cHistory.map(s => ({
        date: s.date,
        value: s.value,
        loincCode: s.loincCode,
      }));
    }

    return partial;
  }, [isConnected, coverage, claims, labs, conditions, medications, screenings, providers, hospitalizations, a1cHistory]);

  useEffect(() => {
    const payment = searchParams.get("payment");
    if (payment === "success") {
      setPaymentToast("Payment successful! Your plan has been upgraded.");
      const timer = setTimeout(() => {
        window.location.replace("/app/chat");
      }, 2000);
      return () => clearTimeout(timer);
    } else if (payment === "cancelled") {
      setPaymentToast("Payment was cancelled.");
      router.replace("/app/chat");
      const timer = setTimeout(() => setPaymentToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, router]);

  const urlConversationId = searchParams.get("id") || undefined;
  const topic = searchParams.get("topic");

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
    initialSessionState,
  });

  useEffect(() => {
    // Support both ?message= and ?q= (backward compat from diabetes page)
    const initialMessage = searchParams.get("message") || searchParams.get("q");
    if (initialMessage && messages.length === 0) {
      sendMessage(initialMessage);
    } else if (topic === "diabetes" && messages.length === 0) {
      sendMessage("What should I know about diabetes and Medicare coverage?");
    }
  }, [searchParams, topic, messages.length, sendMessage]);

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

  // Chat page lifecycle: lock body scroll + suppress Supabase AbortErrors
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handleRejection = (e: PromiseRejectionEvent) => {
      if (e.reason?.name === "AbortError") e.preventDefault();
    };
    window.addEventListener("unhandledrejection", handleRejection);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("unhandledrejection", handleRejection);
    };
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
    router.push("/app/chat");
  }, [resetChat, router]);

  return (
    <div className="fixed top-14 sm:top-16 bottom-16 md:bottom-0 left-0 right-0 flex bg-[var(--bg-primary)]">
      {/* Sidebar — only visible when toggled on mobile; hidden on desktop in app shell */}
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentConversationId={conversationId ?? undefined}
        onNewChat={handleNewChat}
      />

      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        {/* Mobile sidebar toggle */}
        <div className="flex items-center h-12 px-4 md:hidden">
          <SidebarToggle onClick={() => setSidebarOpen(true)} />
          <span className="ml-2 text-sm font-medium text-[var(--text-primary)]">
            Ask Denali
          </span>
        </div>

        {/* Payment toast */}
        {paymentToast && (
          <div className="mx-4 mt-2 px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/30 text-green-700 dark:text-green-300 text-sm text-center">
            {paymentToast}
          </div>
        )}

        {/* Messages Area — flex-col + mt-auto anchors messages to the bottom */}
        <div className="flex-1 overflow-y-auto flex flex-col">
          {messages.length === 0 && !isLoading ? (
            <Container className="py-4">
              <EmptyState onSuggestionSelect={handleInitialCardSelect} topic={topic} email={authState.email} />
            </Container>
          ) : (
            <Container className="py-4 mt-auto">
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
            </Container>
          )}
        </div>

        {/* Chat Input */}
        <div className="flex-shrink-0 p-4 bg-[var(--bg-primary)] border-t border-[var(--border)]">
          <Container>
            <div className="flex justify-center mb-2">
              <CmsPledge type="ai" />
            </div>
            <ChatInput
              onSend={sendMessage}
              disabled={isLoading || !isOnline}
              placeholder={isOnline ? "Ask about Medicare, coverage, or health..." : "Chat requires an internet connection"}
              externalValue={pendingInput}
              onExternalValueUsed={handlePendingInputUsed}
              suggestions={
                currentAction.type === "none" ? suggestions : []
              }
              onSuggestionClick={handleSuggestionSelect}
              maxFileSizeBytes={uploadLimit}
            />
          </Container>
        </div>

      </div>

      {/* Modals */}
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

export default function AppChatPage() {
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
      <ChatContent />
    </Suspense>
  );
}

const EMPTY_STATE_CARDS = [
  {
    icon: ShieldCheckIcon,
    color: "#3b82f6",
    title: "Check Coverage",
    description: "Will Medicare cover my procedure?",
    message: "I want to check if Medicare covers a procedure",
  },
  {
    icon: ScaleIcon,
    color: "#ef4444",
    title: "Appeal a Denial",
    description: "Fight back when Medicare says no",
    message: "Medicare denied my claim and I need help appealing",
  },
  {
    icon: DocumentTextIcon,
    color: "#f59e0b",
    title: "Understand My Bill",
    description: "Make sense of an EOB or medical bill",
    message: "Show me my most recent Medicare claim and help me understand what I owe and why",
  },
  {
    icon: HeartPulseIcon,
    color: "#ec4899",
    title: "Check My Symptoms",
    description: "What care might Medicare cover?",
    message: "I have symptoms and want to know what Medicare might cover",
  },
  {
    icon: ClipboardCheckIcon,
    color: "#10b981",
    title: "Preventive Care",
    description: "Free screenings you may be due for",
    message: "What free preventive screenings am I eligible for with Medicare?",
  },
  {
    icon: DiabetesIcon,
    color: "#8b5cf6",
    title: "Diabetes Care",
    description: "Coverage, screenings, and prevention",
    message: "What should I know about diabetes and Medicare coverage?",
  },
] as const;

function EmptyState({
  onSuggestionSelect,
  email,
}: {
  onSuggestionSelect: (suggestion: string) => void;
  topic?: string | null;
  email?: string | null;
}) {
  const greeting = getGreeting();
  const firstName = email ? email.split("@")[0].replace(/[._+]/g, " ").split(" ")[0] : null;
  const displayGreeting = firstName
    ? `${greeting}, ${firstName.charAt(0).toUpperCase() + firstName.slice(1)}`
    : greeting;

  return (
    <div className="flex flex-col items-center justify-center py-8 sm:py-12 text-center">
      <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
        {displayGreeting}
      </h2>
      <p className="text-[var(--text-secondary)] mb-6 max-w-md">
        Ask anything about your Medicare coverage, bills, symptoms, or health — in plain English.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3 max-w-xl w-full">
        {EMPTY_STATE_CARDS.map((card) => (
          <button
            key={card.title}
            onClick={() => onSuggestionSelect(card.message)}
            className="flex flex-col items-center gap-2 text-center px-3 py-4 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent-primary)] transition-colors group"
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{
                backgroundColor: `color-mix(in srgb, ${card.color} 15%, transparent)`,
                color: card.color,
              }}
            >
              <card.icon className="w-5 h-5" strokeWidth={2} />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold text-[var(--text-primary)] group-hover:text-[var(--accent-primary)] transition-colors">
                {card.title}
              </div>
              <div className="text-xs text-[var(--text-secondary)] mt-0.5 leading-snug">
                {card.description}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

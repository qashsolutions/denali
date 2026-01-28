"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { PageContainer, Container } from "@/components/layout/Container";
import { ChatInput } from "@/components/chat/ChatInput";
import { QuickAction } from "@/components/chat/Suggestions";
import { useTheme } from "@/hooks/useTheme";
import { getGreeting } from "@/lib/utils";

export default function WelcomePage() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const [userName] = useState<string | null>(null); // Will come from auth later

  const greeting = getGreeting();
  const timeIcon = getTimeIcon();

  const handleNewQuestion = () => {
    router.push("/chat");
  };

  const handlePastQuestions = () => {
    // TODO: Navigate to history when built
    router.push("/chat");
  };

  const handleSend = (message: string) => {
    // Navigate to chat with initial message
    router.push(`/chat?message=${encodeURIComponent(message)}`);
  };

  return (
    <PageContainer>
      <Header
        showThemeToggle
        onThemeToggle={toggleTheme}
        isDark={isDark}
      />

      <main className="flex-1 flex flex-col">
        <Container className="flex-1 flex flex-col gap-6 py-4">
          {/* Greeting Card */}
          <div className="bg-gradient-to-br from-[var(--bg-secondary)] to-[var(--bg-tertiary)] rounded-2xl p-6 border border-[var(--border)]/30">
            <div className="flex items-start gap-4 mb-4">
              <div className="w-10 h-10 rounded-full bg-[var(--accent-primary)]/20 flex items-center justify-center text-xl">
                {timeIcon}
              </div>
              <div>
                <p className="text-sm text-[var(--text-secondary)]">{greeting}</p>
                <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
                  {userName || "there"}
                </h1>
              </div>
            </div>
            <p className="text-[var(--text-secondary)]">
              What can I help you with today?
            </p>
          </div>

          {/* Quick Actions */}
          <div>
            <p className="text-label text-[var(--text-muted)] mb-3">
              QUICK ACTIONS
            </p>
            <div className="grid grid-cols-2 gap-3">
              <QuickAction
                icon={<ChatIcon className="w-5 h-5" />}
                label="New Question"
                description="Ask about coverage"
                onClick={handleNewQuestion}
              />
              <QuickAction
                icon={<HistoryIcon className="w-5 h-5" />}
                label="Past Questions"
                description="View history"
                onClick={handlePastQuestions}
              />
            </div>
          </div>

          {/* Common Topics */}
          <div>
            <p className="text-label text-[var(--text-muted)] mb-3">
              COMMON TOPICS
            </p>
            <div className="space-y-2">
              <TopicButton onClick={() => handleSend("Will Medicare cover my MRI?")}>
                Will Medicare cover my MRI?
              </TopicButton>
              <TopicButton onClick={() => handleSend("What does my doctor need to document?")}>
                What does my doctor need to document?
              </TopicButton>
              <TopicButton onClick={() => handleSend("Help me appeal a denial")}>
                Help me appeal a denial
              </TopicButton>
            </div>
          </div>
        </Container>

        {/* Chat Input */}
        <div className="p-4 pb-8 bg-[var(--bg-primary)] border-t border-[var(--border)]">
          <Container>
            <ChatInput
              onSend={handleSend}
              placeholder="Type your question..."
            />
          </Container>
        </div>
      </main>
    </PageContainer>
  );
}

function getTimeIcon(): string {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "☀️";
  if (hour >= 12 && hour < 17) return "🌤️";
  if (hour >= 17 && hour < 21) return "🌙";
  return "🌙";
}

function TopicButton({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] text-[var(--text-primary)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--accent-primary)] transition-colors"
    >
      {children}
    </button>
  );
}

function ChatIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function HistoryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

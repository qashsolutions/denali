"use client";

import { useState } from "react";
import { BottomTabs } from "@/components/layout/BottomTabs";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ProfileCompletionModal } from "@/components/profile/ProfileCompletionModal";
import { useAuth } from "@/hooks/useAuth";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { authState } = useAuth();
  const [completionDismissed, setCompletionDismissed] = useState(false);

  // Foundation Stage 1.C: show post-verification birth_year capture modal
  // once per session when authenticated user has not yet provided it.
  const showCompletion =
    !authState.isLoading &&
    !!authState.userId &&
    authState.birthYear === null &&
    !completionDismissed;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <main className="flex-1 pb-16 md:pb-0">{children}</main>

      {/* Desktop footer — same as landing/legal pages */}
      <div className="hidden md:block">
        <LandingFooter />
      </div>

      <BottomTabs />

      <ProfileCompletionModal
        isOpen={showCompletion}
        onClose={() => setCompletionDismissed(true)}
      />
    </div>
  );
}

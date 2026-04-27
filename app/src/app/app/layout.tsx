"use client";

import { useState } from "react";
import { BottomTabs } from "@/components/layout/BottomTabs";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { ProfileCompletionModal } from "@/components/profile/ProfileCompletionModal";
import { useAuth } from "@/hooks/useAuth";
import { canShowBirthYearModal } from "@/lib/profile-cadence";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { authState } = useAuth();
  const [completionDismissed, setCompletionDismissed] = useState(false);

  // Foundation Stage 1.C: cadence-aware birth-year prompt.
  // Server-side eligibility (canShowBirthYearModal) honors the
  // dismissed_at 7-day cooldown and disabled flag.
  // Session-only completionDismissed is the immediate-close
  // fast-path while server writes are in flight.
  const showCompletion =
    canShowBirthYearModal(authState) && !completionDismissed;

  async function handleSave(birthYear: number) {
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ birth_year: birthYear }),
      credentials: "include",
    });
    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;
      throw new Error(body?.error ?? "Failed to save birth year");
    }
  }

  async function handleDismiss() {
    const res = await fetch("/api/profile/birth-year-reminder/dismiss", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to dismiss reminder");
  }

  async function handleDisable() {
    const res = await fetch("/api/profile/birth-year-reminder/disable", {
      method: "POST",
      credentials: "include",
    });
    if (!res.ok) throw new Error("Failed to disable reminder");
  }

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
        onSave={handleSave}
        onDismiss={handleDismiss}
        onDisable={handleDisable}
        onClose={() => setCompletionDismissed(true)}
      />
    </div>
  );
}

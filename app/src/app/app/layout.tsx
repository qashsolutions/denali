"use client";

import { BottomTabs } from "@/components/layout/BottomTabs";
import { LandingFooter } from "@/components/landing";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <main className="flex-1 pb-16 md:pb-0">{children}</main>

      {/* Desktop footer — same as landing/legal pages */}
      <div className="hidden md:block">
        <LandingFooter />
      </div>

      <BottomTabs />
    </div>
  );
}

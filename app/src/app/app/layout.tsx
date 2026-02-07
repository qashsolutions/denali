"use client";

import { BottomTabs } from "@/components/layout/BottomTabs";
import { AppHeader } from "@/components/layout/AppHeader";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <AppHeader />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <BottomTabs />
    </div>
  );
}

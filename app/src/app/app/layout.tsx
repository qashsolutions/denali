"use client";

import { BottomTabs } from "@/components/layout/BottomTabs";
import { AppHeader } from "@/components/layout/AppHeader";
import { BRAND } from "@/config";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <AppHeader />
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <footer className="hidden md:block py-2 px-4 bg-[var(--bg-secondary)] border-t border-[var(--border)]">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xs text-[var(--text-muted)]">
            {BRAND.NAME} · Coverage guidance only, not medical advice
          </p>
        </div>
      </footer>
      <BottomTabs />
    </div>
  );
}

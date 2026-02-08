"use client";

import Link from "next/link";
import { BottomTabs } from "@/components/layout/BottomTabs";
import { MountainIcon } from "@/components/icons";
import { BRAND } from "@/config";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <main className="flex-1 pb-16 md:pb-0">{children}</main>

      {/* Desktop footer — horizontal: brand left, links right */}
      <footer className="hidden md:block py-3 px-6 bg-[var(--bg-secondary)] border-t border-[var(--border)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Left: Logo + Disclaimer + Copyright */}
          <div className="flex items-center gap-3 text-xs text-[var(--text-muted)]">
            <Link href="/" className="flex items-center gap-1.5 shrink-0">
              <MountainIcon className="w-5 h-4" />
              <span className="text-sm font-bold text-[var(--text-primary)]">
                Denali<span className="text-[var(--accent-secondary)]">Health</span>
              </span>
            </Link>
            <span className="text-[var(--border)]">|</span>
            <span>Coverage guidance only, not medical advice</span>
            <span className="text-[var(--border)]">|</span>
            <span>{BRAND.COPYRIGHT_TEXT}</span>
          </div>

          {/* Right: Legal links */}
          <div className="flex items-center gap-4">
            <Link
              href="/faq"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-secondary)] transition-colors"
            >
              FAQ
            </Link>
            <Link
              href="/privacy"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-secondary)] transition-colors"
            >
              Privacy
            </Link>
            <Link
              href="/hipaa"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-secondary)] transition-colors"
            >
              HIPAA
            </Link>
          </div>
        </div>
      </footer>

      <BottomTabs />
    </div>
  );
}

"use client";

import Link from "next/link";
import { BottomTabs } from "@/components/layout/BottomTabs";
import { MountainIcon } from "@/components/icons";
import { BRAND } from "@/config";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <main className="flex-1 pb-16 md:pb-0">{children}</main>
      <footer className="hidden md:block py-6 px-4 bg-[var(--bg-secondary)] border-t border-[var(--border)]">
        <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-3">
          {/* Logo + Brand */}
          <Link href="/app" className="flex items-center gap-2">
            <MountainIcon className="w-7 h-5" />
            <span className="text-sm font-bold text-[var(--text-primary)]">
              Denali<span className="text-[var(--accent-secondary)]">Health</span>
            </span>
          </Link>

          {/* Company attribution */}
          <p className="text-xs text-[var(--text-muted)]">
            {BRAND.COMPANY_ATTRIBUTION}
          </p>

          {/* Links */}
          <div className="flex gap-4">
            <Link
              href="/blog"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-secondary)] transition-colors"
            >
              Blog
            </Link>
            <Link
              href="/faq"
              className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-secondary)] transition-colors"
            >
              FAQ
            </Link>
          </div>

          {/* Disclaimer + Copyright */}
          <p className="text-xs text-[var(--text-muted)]">
            Coverage guidance only, not medical advice
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            {BRAND.COPYRIGHT_TEXT}
          </p>
        </div>
      </footer>
      <BottomTabs />
    </div>
  );
}

"use client";

import Link from "next/link";
import { BottomTabs } from "@/components/layout/BottomTabs";
import { MountainIcon } from "@/components/icons";
import { BRAND } from "@/config";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-primary)]">
      <main className="flex-1 pb-16 md:pb-0">{children}</main>

      {/* Desktop footer */}
      <footer className="hidden md:block py-6 px-6 bg-[var(--bg-secondary)] border-t border-[var(--border)]">
        <div className="max-w-6xl mx-auto">
          {/* Row 1: Logo left, links right */}
          <div className="flex items-start justify-between mb-3">
            <div>
              <Link href="/" className="flex items-center gap-2 mb-1">
                <MountainIcon className="w-6 h-6" />
                <span className="text-lg font-bold text-[var(--text-primary)]">
                  Denali<span className="text-[var(--brand-purple)]">Health</span>
                </span>
              </Link>
            </div>
            <div className="flex items-center gap-5 pt-1">
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
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-secondary)] transition-colors"
              >
                Terms
              </Link>
              <Link
                href="/hipaa"
                className="text-xs text-[var(--text-muted)] hover:text-[var(--accent-secondary)] transition-colors"
              >
                HIPAA
              </Link>
            </div>
          </div>

          {/* Row 2: HIPAA/BAA notice — full width */}
          <p className="text-lg font-bold text-black dark:text-white mb-3">
            denali.health is built on HIPAA-ready infrastructure, including Claude via AWS Bedrock under a signed Business Associate Agreement with AWS.
          </p>

          {/* Row 3: Disclaimer + Copyright */}
          <div className="pt-3 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-muted)]">
            <p>Coverage guidance only, not medical advice. This product is not endorsed or certified by CMS or HHS.</p>
            <p className="shrink-0">{BRAND.COPYRIGHT_TEXT}</p>
          </div>
        </div>
      </footer>

      <BottomTabs />
    </div>
  );
}

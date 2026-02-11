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
        <div className="max-w-6xl mx-auto flex items-start justify-between">
          {/* Left: Logo + Disclaimer + Copyright */}
          <div>
            <Link href="/" className="flex items-center gap-2 mb-1">
              <MountainIcon className="w-6 h-6" />
              <span className="text-lg font-bold text-[var(--text-primary)]">
                Denali<span className="text-[var(--accent-secondary)]">Health</span>
              </span>
            </Link>
            <p className="text-xs text-[var(--text-muted)] mb-1">
              Coverage guidance only, not medical advice. This product is not endorsed or certified by CMS or HHS.
            </p>
            <p className="text-xs text-[var(--text-muted)]">
              {BRAND.COPYRIGHT_TEXT}
            </p>
          </div>

          {/* Right: Legal links */}
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
      </footer>

      <BottomTabs />
    </div>
  );
}

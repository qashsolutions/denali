"use client";

import Link from "next/link";
import { MountainIcon, SunIcon, MoonIcon, ChatBubbleIcon } from "../icons";
import { useTheme } from "@/hooks/useTheme";

interface LandingHeaderProps {
  settings: Record<string, string>;
}

export function LandingHeader({ settings }: LandingHeaderProps) {
  const { isDark, toggleTheme } = useTheme();
  const brandName = settings.brand_name || "DenaliHealth";
  const tagline = settings.tagline || "Medicare denials—addressed proactively";

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[var(--bg-primary)]/90 border-b border-[var(--border)]/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo + Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <MountainIcon className="w-10 h-8 sm:w-12 sm:h-10 transition-transform group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                {brandName}
              </span>
              <span className="hidden sm:block text-xs text-[var(--text-muted)] leading-tight">
                {tagline}
              </span>
            </div>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="w-10 h-10 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors hover:bg-[var(--border)]"
              aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
            >
              {isDark ? (
                <SunIcon className="w-5 h-5 text-yellow-400" />
              ) : (
                <MoonIcon className="w-5 h-5 text-[var(--text-secondary)]" />
              )}
            </button>

            {/* Chat Quick Access */}
            <Link
              href="/chat"
              className="flex items-center gap-2 px-4 h-10 rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white font-medium text-sm transition-opacity hover:opacity-90"
            >
              <ChatBubbleIcon className="w-4 h-4" strokeWidth={2} />
              <span className="hidden sm:inline">Ask a Question</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

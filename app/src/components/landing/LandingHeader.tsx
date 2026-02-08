"use client";

import Link from "next/link";
import {
  MountainIcon,
  SunIcon,
  MoonIcon,
  ChatBubbleIcon,
  HeartPulseIcon,
  DiabetesIcon,
  ClaimsIcon,
} from "../icons";
import { useTheme } from "@/components/ThemeProvider";

interface LandingHeaderProps {
  settings: Record<string, string>;
}

const NAV_ITEMS = [
  { label: "Health Records", href: "/app/health", Icon: HeartPulseIcon },
  { label: "AI Assistant", href: "/app/chat", Icon: ChatBubbleIcon },
  { label: "Diabetes", href: "/app/diabetes", Icon: DiabetesIcon },
  { label: "Claims & Appeals", href: "/app/claims", Icon: ClaimsIcon },
] as const;

export function LandingHeader({ settings }: LandingHeaderProps) {
  const { isDark, toggleTheme } = useTheme();
  const brandName = settings.brand_name || "DenaliHealth";
  const tagline = settings.tagline || "Your Medicare companion for rural America";

  // Split brand name to color "Health" separately
  const healthIndex = brandName.indexOf("Health");
  const prefix = healthIndex >= 0 ? brandName.slice(0, healthIndex) : brandName;
  const suffix = healthIndex >= 0 ? "Health" : "";

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[var(--bg-primary)]/90 border-b border-[var(--border)]/50">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Logo + Brand */}
          <Link href="/" className="flex items-center gap-3 group">
            <MountainIcon className="w-10 h-8 sm:w-12 sm:h-10 transition-transform group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="text-lg sm:text-xl font-bold text-[var(--text-primary)]">
                {prefix}
                {suffix && (
                  <span className="text-[var(--accent-secondary)]">{suffix}</span>
                )}
              </span>
              <span className="hidden sm:block text-xs text-[var(--text-muted)] leading-tight">
                {tagline}
              </span>
            </div>
          </Link>

          {/* Feature Nav (desktop) */}
          <nav className="hidden md:flex items-center gap-1" aria-label="Features">
            {NAV_ITEMS.map(({ label, href, Icon }) => (
              <Link
                key={href}
                href={href}
                className="relative group flex items-center justify-center w-10 h-10 rounded-lg text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
                aria-label={label}
              >
                <Icon className="w-5 h-5" />
                {/* Tooltip */}
                <span className="absolute top-full mt-2 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md bg-[var(--text-primary)] text-[var(--bg-primary)] text-xs font-medium whitespace-nowrap opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all duration-150">
                  {label}
                </span>
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Blog Link */}
            <Link
              href="/blog"
              className="text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors hidden sm:inline"
            >
              Blog
            </Link>

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

            {/* Get Started CTA */}
            <Link
              href="/app"
              className="flex items-center gap-2 px-4 h-10 rounded-full bg-gradient-to-r from-[var(--accent-primary)] to-[var(--accent-secondary)] text-white font-medium text-sm transition-opacity hover:opacity-90"
            >
              <ChatBubbleIcon className="w-4 h-4" strokeWidth={2} />
              <span className="hidden sm:inline">Get Started</span>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}

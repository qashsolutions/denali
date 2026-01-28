"use client";

import { cn } from "@/lib/utils";

export interface HeaderProps {
  showBack?: boolean;
  onBack?: () => void;
  showThemeToggle?: boolean;
  onThemeToggle?: () => void;
  isDark?: boolean;
  showSettings?: boolean;
  onSettings?: () => void;
}

export function Header({
  showBack = false,
  onBack,
  showThemeToggle = true,
  onThemeToggle,
  isDark = true,
  showSettings = false,
  onSettings,
}: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4">
      <div className="flex items-center gap-3">
        {showBack && onBack ? (
          <button
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
            aria-label="Go back"
          >
            <ChevronLeftIcon className="w-6 h-6 text-[var(--text-primary)]" />
          </button>
        ) : (
          <Logo />
        )}
      </div>

      <div className="flex items-center gap-2">
        {showSettings && onSettings && (
          <button
            onClick={onSettings}
            className="w-11 h-11 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors hover:bg-[var(--border)]"
            aria-label="Open settings"
          >
            <SettingsIcon className="w-5 h-5 text-[var(--text-secondary)]" />
          </button>
        )}
        {showThemeToggle && onThemeToggle && (
          <button
            onClick={onThemeToggle}
            className="w-11 h-11 rounded-full bg-[var(--bg-tertiary)] flex items-center justify-center transition-colors hover:bg-[var(--border)]"
            aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
          >
            {isDark ? (
              <SunIcon className="w-5 h-5 text-yellow-400" />
            ) : (
              <MoonIcon className="w-5 h-5 text-[var(--text-secondary)]" />
            )}
          </button>
        )}
      </div>
    </header>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      {/* Mountain Logo */}
      <div className="relative w-12 h-10">
        <svg viewBox="0 0 48 40" className="w-full h-full">
          <path d="M12 35 L24 10 L36 35 Z" fill="#3b82f6" opacity="0.8" />
          <path d="M24 35 L36 15 L48 35 Z" fill="#8b5cf6" opacity="0.8" />
        </svg>
      </div>
      <div>
        <span className="text-xl font-bold text-[var(--text-primary)]">
          denali
        </span>
        <span className="text-sm text-[var(--text-secondary)]">.health</span>
      </div>
    </div>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function SunIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function MoonIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

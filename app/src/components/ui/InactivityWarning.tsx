"use client";

import { useIdleTimeout } from "@/hooks/useIdleTimeout";

/**
 * Fixed banner shown below AppHeader when session is about to expire.
 * Same positioning pattern as OfflineBanner.
 * Renders nothing for anonymous users or when not in warning state.
 */
export function InactivityWarning() {
  const { showWarning, secondsRemaining, staySignedIn } = useIdleTimeout();

  if (!showWarning) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div
      className="fixed top-[72px] sm:top-[88px] left-0 right-0 z-30 flex items-center justify-between gap-2 px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)] border-l-4 border-l-amber-500"
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center gap-2">
        <svg
          className="w-4 h-4 text-amber-500 shrink-0"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
          />
        </svg>
        <span className="text-sm text-[var(--text-secondary)]">
          Session expiring in {timeDisplay}
        </span>
      </div>
      <button
        onClick={staySignedIn}
        className="px-3 py-1 rounded-full text-xs font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 transition-colors shrink-0"
      >
        Stay signed in
      </button>
    </div>
  );
}

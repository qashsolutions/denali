"use client";

import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Fixed banner shown below AppHeader when offline.
 * Auto-dismisses when connection restores.
 */
export function OfflineBanner() {
  const { isOnline } = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div
      className="fixed top-16 sm:top-20 left-0 right-0 z-30 flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)] border-l-4 border-l-amber-500"
      role="status"
      aria-live="polite"
    >
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
          d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
        />
      </svg>
      <span className="text-sm text-[var(--text-secondary)]">
        You&apos;re offline — viewing saved data
      </span>
    </div>
  );
}

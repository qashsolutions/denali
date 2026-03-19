"use client";

import { useIdleTimeout } from "@/hooks/useIdleTimeout";

/**
 * Modal overlay shown when session is about to expire or has expired.
 * Forces user to acknowledge before continuing or being signed out.
 * Renders nothing for anonymous users or when not in warning/expired state.
 */
export function InactivityWarning() {
  const { showWarning, secondsRemaining, staySignedIn, isExpired, confirmSignOut } = useIdleTimeout();

  if (!showWarning && !isExpired) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeDisplay = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="idle-title"
      aria-describedby="idle-desc"
    >
      <div className="mx-4 w-full max-w-sm rounded-xl bg-[var(--bg-primary)] p-6 shadow-xl border border-[var(--border)]">
        {isExpired ? (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100">
                <svg className="w-5 h-5 text-red-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <h2 id="idle-title" className="text-lg font-semibold text-[var(--text-primary)]">
                Session Expired
              </h2>
            </div>
            <p id="idle-desc" className="text-sm text-[var(--text-secondary)] mb-5">
              You&apos;ve been inactive for 30 minutes. For your security, you&apos;ll need to sign in again.
            </p>
            <button
              onClick={confirmSignOut}
              className="w-full px-4 py-2.5 rounded-lg text-sm font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 transition-opacity"
            >
              Okay
            </button>
          </>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-amber-100">
                <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
              </div>
              <h2 id="idle-title" className="text-lg font-semibold text-[var(--text-primary)]">
                Still there?
              </h2>
            </div>
            <p id="idle-desc" className="text-sm text-[var(--text-secondary)] mb-1">
              Your session will expire in
            </p>
            <p className="text-2xl font-mono font-bold text-[var(--accent-primary)] mb-4">
              {timeDisplay}
            </p>
            <p className="text-xs text-[var(--text-secondary)] mb-5">
              For your security, inactive sessions are locked after 30 minutes.
            </p>
            <div className="flex gap-3">
              <button
                onClick={staySignedIn}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-[var(--accent-primary)] text-white hover:opacity-90 transition-opacity"
              >
                Stay signed in
              </button>
              <button
                onClick={confirmSignOut}
                className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-secondary)] transition-colors"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

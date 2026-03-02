"use client";

import { useState } from "react";
import Link from "next/link";
import { AUTH_MESSAGES } from "@/config/ui";
import { MountainIcon } from "@/components/icons";

/**
 * Friendly session-expired page shown when the 7-day maximum session
 * lifetime is exceeded. The middleware clears all auth cookies before
 * redirecting here, so the user is fully signed out.
 *
 * This page does NOT auto-redirect — it gives the user context about
 * why they need to sign in again, reducing surprise/frustration.
 */
export default function SessionExpiredPage() {
  const [acknowledged, setAcknowledged] = useState(false);

  if (acknowledged) {
    // Redirect to landing (which has the sign-in flow)
    if (typeof window !== "undefined") {
      window.location.href = "/";
    }
    return null;
  }

  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh] px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-blue-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z"
              />
            </svg>
          </div>
        </div>

        {/* Message */}
        <div>
          <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
            {AUTH_MESSAGES.SESSION_EXPIRED_TITLE}
          </h1>
          <p className="text-[var(--text-secondary)] text-sm leading-relaxed">
            {AUTH_MESSAGES.SESSION_EXPIRED_MESSAGE}
          </p>
        </div>

        {/* Security note */}
        <div className="bg-[var(--bg-secondary)] rounded-lg px-4 py-3 text-xs text-[var(--text-secondary)]">
          <div className="flex items-start gap-2">
            <svg
              className="w-4 h-4 text-green-500 mt-0.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
              />
            </svg>
            <span>
              This is a standard security measure for healthcare apps. Your data and
              conversations are safe — just verify it&apos;s you.
            </span>
          </div>
        </div>

        {/* CTA */}
        <button
          onClick={() => setAcknowledged(true)}
          className="w-full py-3 px-4 rounded-lg font-medium text-white bg-[var(--accent-primary)] hover:opacity-90 transition-opacity"
        >
          Sign in to continue
        </button>

        {/* Brand */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--text-tertiary)]">
          <MountainIcon className="w-3.5 h-3.5" />
          <span>DenaliHealth</span>
        </div>
      </div>
    </div>
  );
}

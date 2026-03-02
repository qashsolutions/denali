"use client";

import Link from "next/link";
import { AUTH_MESSAGES } from "@/config/ui";

/**
 * Shown on the chat page when the user has not enrolled in MFA.
 * Blocks chat access but allows navigation to other features
 * (health page for Blue Button, settings for MFA setup).
 */
export function MFARequiredGate() {
  return (
    <div className="flex-1 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-5">
        {/* Shield icon */}
        <div className="flex justify-center">
          <div className="w-14 h-14 rounded-full bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
            <svg
              className="w-7 h-7 text-amber-500"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m0-10.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            {AUTH_MESSAGES.MFA_REQUIRED_TITLE}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {AUTH_MESSAGES.MFA_REQUIRED_MESSAGE}
          </p>
        </div>

        {/* Steps */}
        <div className="bg-[var(--bg-secondary)] rounded-lg px-4 py-3 text-left space-y-2">
          <p className="text-xs font-medium text-[var(--text-primary)]">
            Quick setup (takes ~1 minute):
          </p>
          <ol className="text-xs text-[var(--text-secondary)] space-y-1.5 list-decimal list-inside">
            <li>Download an authenticator app (Google Authenticator or Authy)</li>
            <li>Go to Settings &gt; Security and tap &quot;Enable MFA&quot;</li>
            <li>Scan the QR code and enter the 6-digit code</li>
          </ol>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Link
            href="/app/settings"
            className="w-full py-3 px-4 rounded-lg font-medium text-white bg-[var(--accent-primary)] hover:opacity-90 transition-opacity text-center"
          >
            Go to Settings to enable MFA
          </Link>
          <Link
            href="/app/health"
            className="text-sm text-[var(--text-secondary)] hover:text-[var(--accent-primary)] transition-colors"
          >
            Or connect your Medicare data first →
          </Link>
        </div>
      </div>
    </div>
  );
}

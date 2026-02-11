"use client";

import { MountainIcon, HeartPulseIcon, ChatBubbleIcon } from "@/components/icons";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] px-4 text-center">
      <MountainIcon className="w-14 h-14 mb-6 opacity-50" />

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
        You&apos;re offline
      </h1>
      <p className="text-[var(--text-secondary)] mb-8 max-w-sm">
        Check your internet connection and try again. Some features need a
        connection to work.
      </p>

      <div className="flex flex-col gap-3 w-full max-w-xs mb-8">
        <Link
          href="/app/health"
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <HeartPulseIcon className="w-5 h-5 text-rose-500 shrink-0" />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            View saved health records
          </span>
        </Link>
        <Link
          href="/app/chat"
          className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[var(--bg-secondary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)] transition-colors"
        >
          <ChatBubbleIcon className="w-5 h-5 text-blue-500 shrink-0" />
          <span className="text-sm font-medium text-[var(--text-primary)]">
            View past conversations
          </span>
        </Link>
      </div>

      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 rounded-full bg-[var(--accent-primary)] text-white font-medium hover:opacity-90 transition-opacity"
      >
        Try Again
      </button>
    </div>
  );
}

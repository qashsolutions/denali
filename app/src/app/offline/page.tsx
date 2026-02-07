"use client";

import { MountainIcon } from "@/components/icons";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--bg-primary)] px-4 text-center">
      <MountainIcon className="w-16 h-14 mb-6 opacity-50" />

      <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
        You&apos;re offline
      </h1>
      <p className="text-[var(--text-secondary)] mb-8 max-w-sm">
        Check your internet connection and try again. Some features need a
        connection to work.
      </p>

      <button
        onClick={() => window.location.reload()}
        className="px-6 py-3 rounded-full bg-[var(--accent-primary)] text-white font-medium hover:opacity-90 transition-opacity"
      >
        Try Again
      </button>
    </div>
  );
}

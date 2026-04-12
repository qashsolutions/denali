"use client";

import { useState } from "react";

interface ConnectionStatusProps {
  lastSynced: Date | null;
  onRefresh: () => Promise<void>;
  onDisconnect: () => Promise<void>;
}

export function ConnectionStatus({
  lastSynced,
  onRefresh,
  onDisconnect,
}: ConnectionStatusProps) {
  const [confirming, setConfirming] = useState(false);
  const timeAgo = lastSynced ? formatTimeAgo(lastSynced) : null;

  if (confirming) {
    return (
      <div className="bg-[var(--bg-secondary)] rounded-xl border border-red-500/20 px-4 py-3">
        <p className="text-sm font-medium text-red-600 mb-2">
          Are you sure you want to disconnect your Medicare account?
        </p>
        <p className="text-xs text-[var(--text-muted)] mb-3">
          This will permanently delete all cached health data, health reports,
          and diabetes insights. This action cannot be undone.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setConfirming(false)}
            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--text-secondary)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-tertiary)]/80 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => {
              setConfirming(false);
              onDisconnect();
            }}
            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-red-600 hover:bg-red-700 transition-colors"
          >
            Yes, Disconnect
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] px-4 py-3">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <span className="text-sm text-[var(--text-secondary)]">
          Connected to Medicare
        </span>
        {timeAgo && (
          <span className="text-xs text-[var(--text-muted)]">
            · Synced {timeAgo}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onRefresh}
          className="text-xs font-medium text-[var(--accent-primary)] hover:underline px-2 py-1"
        >
          Refresh
        </button>
        <button
          onClick={() => setConfirming(true)}
          className="text-xs font-medium text-[var(--text-muted)] hover:text-red-500 px-2 py-1"
        >
          Disconnect
        </button>
      </div>
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

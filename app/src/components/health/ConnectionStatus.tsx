"use client";

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
  const timeAgo = lastSynced ? formatTimeAgo(lastSynced) : null;

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
          onClick={onDisconnect}
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

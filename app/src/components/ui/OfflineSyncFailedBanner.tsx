"use client";

import { useState, useEffect } from "react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

/**
 * Banner shown when the SW or client-side queue permanently drops an offline item.
 * Listens for the 'offline-sync-failed' custom event dispatched by:
 *   - layout.tsx (relays SW QUEUE_ITEM_FAILED message)
 *   - offline-sync.ts (client-side queue processor)
 * Auto-dismisses after 10 seconds. Tap to dismiss immediately.
 */
export function OfflineSyncFailedBanner() {
  const { isOnline } = useOnlineStatus();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener("offline-sync-failed", handler);
    return () => window.removeEventListener("offline-sync-failed", handler);
  }, []);

  useEffect(() => {
    if (!visible) return;
    const timer = setTimeout(() => setVisible(false), 10000);
    return () => clearTimeout(timer);
  }, [visible]);

  // Don't render when offline — OfflineBanner occupies this position
  // Queue replay only happens after reconnect, so this only shows when online
  if (!visible || !isOnline) return null;

  return (
    <div
      className="fixed top-[72px] sm:top-[88px] left-0 right-0 z-30 flex items-center gap-2 px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)] border-l-4 border-l-red-500 cursor-pointer"
      role="alert"
      aria-live="assertive"
      onClick={() => setVisible(false)}
    >
      <svg
        className="w-4 h-4 text-red-500 shrink-0"
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
        Some offline data couldn&apos;t be saved. Please try again.
      </span>
    </div>
  );
}

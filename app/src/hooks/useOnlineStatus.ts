"use client";

import { useState, useEffect, useRef } from "react";

interface UseOnlineStatusReturn {
  isOnline: boolean;
  /** True if user was offline at any point during this session */
  wasOffline: boolean;
}

/**
 * Tracks browser online/offline status.
 * SSR-safe: always initializes to true (matching server render),
 * then syncs real value in useEffect to avoid hydration mismatch.
 */
export function useOnlineStatus(): UseOnlineStatusReturn {
  const [isOnline, setIsOnline] = useState(true);
  const wasOfflineRef = useRef(false);

  useEffect(() => {
    // Sync actual online status after hydration
    setIsOnline(navigator.onLine);
    if (!navigator.onLine) wasOfflineRef.current = true;

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => {
      setIsOnline(false);
      wasOfflineRef.current = true;
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline, wasOffline: wasOfflineRef.current };
}

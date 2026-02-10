"use client";

import { useState, useEffect, useRef } from "react";

interface UseOnlineStatusReturn {
  isOnline: boolean;
  /** True if user was offline at any point during this session */
  wasOffline: boolean;
}

/**
 * Tracks browser online/offline status.
 * SSR-safe: defaults to online during server rendering.
 */
export function useOnlineStatus(): UseOnlineStatusReturn {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const wasOfflineRef = useRef(false);

  useEffect(() => {
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

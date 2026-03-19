"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { SESSION_TIMEOUT } from "@/config/ui";

interface UseIdleTimeoutReturn {
  showWarning: boolean;
  secondsRemaining: number;
  staySignedIn: () => void;
  isAuthenticated: boolean;
  isExpired: boolean;
  confirmSignOut: () => void;
}

/**
 * Tracks user inactivity and shows warning at SESSION_TIMEOUT.WARNING_MS.
 * At SESSION_TIMEOUT.INACTIVITY_MS, shows expired modal — does NOT auto-sign out.
 * User must click "Okay" (confirmSignOut) to complete sign-out.
 * Auth-gated: no-op for anonymous users.
 */
export function useIdleTimeout(): UseIdleTimeoutReturn {
  const [showWarning, setShowWarning] = useState(false);
  const [isExpired, setIsExpired] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(180);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const lastUpdateRef = useRef(Date.now());

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
    setIsExpired(false);
  }, []);

  const confirmSignOut = useCallback(() => {
    setShowWarning(false);
    setIsExpired(false);
    fetch("/api/auth/idle-lock", { method: "POST" }).finally(() => {
      window.dispatchEvent(new CustomEvent("auth-state-change", { detail: null }));
    });
  }, []);

  // Auth state tracking via custom event
  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.authenticated) {
          setIsAuthenticated(true);
          resetActivity();
        }
      })
      .catch(() => {});

    function handleAuthChange(e: Event) {
      const user = (e as CustomEvent<{ email: string; userId: string } | null>).detail;
      setIsAuthenticated(!!user);
      if (user) resetActivity();
    }

    window.addEventListener("auth-state-change", handleAuthChange);
    return () => window.removeEventListener("auth-state-change", handleAuthChange);
  }, [resetActivity]);

  // Activity listeners (throttled to 1s) — disabled when expired (force modal)
  useEffect(() => {
    if (!isAuthenticated || isExpired) return;

    const handleActivity = () => {
      const now = Date.now();
      if (now - lastUpdateRef.current > 1000) {
        lastUpdateRef.current = now;
        lastActivityRef.current = now;
        setShowWarning(false);
      }
    };

    const events = ["mousemove", "keydown", "click", "touchstart", "scroll"] as const;
    events.forEach((e) => window.addEventListener(e, handleActivity, { passive: true }));

    return () => {
      events.forEach((e) => window.removeEventListener(e, handleActivity));
    };
  }, [isAuthenticated, isExpired]);

  // Check interval (every 30s normally, every 1s during warning)
  useEffect(() => {
    if (!isAuthenticated || isExpired) return;

    const check = () => {
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= SESSION_TIMEOUT.INACTIVITY_MS) {
        // Don't auto-sign out — show expired modal, user must click "Okay"
        setShowWarning(false);
        setIsExpired(true);
        setSecondsRemaining(0);
        return;
      }

      if (elapsed >= SESSION_TIMEOUT.WARNING_MS) {
        setShowWarning(true);
        const remaining = Math.ceil(
          (SESSION_TIMEOUT.INACTIVITY_MS - elapsed) / 1000
        );
        setSecondsRemaining(Math.max(0, remaining));
      } else {
        setShowWarning(false);
      }
    };

    check();

    const id = setInterval(check, showWarning ? 1000 : 30000);
    return () => clearInterval(id);
  }, [isAuthenticated, showWarning, isExpired]);

  return { showWarning, secondsRemaining, staySignedIn: resetActivity, isAuthenticated, isExpired, confirmSignOut };
}

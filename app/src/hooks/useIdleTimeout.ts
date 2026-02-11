"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getClient } from "@/lib/supabase";
import { SESSION_TIMEOUT } from "@/config/ui";

interface UseIdleTimeoutReturn {
  showWarning: boolean;
  secondsRemaining: number;
  staySignedIn: () => void;
  isAuthenticated: boolean;
}

/**
 * Tracks user inactivity and signs out after SESSION_TIMEOUT.INACTIVITY_MS.
 * Shows a warning banner at SESSION_TIMEOUT.WARNING_MS.
 * Auth-gated: no-op for anonymous users.
 */
export function useIdleTimeout(): UseIdleTimeoutReturn {
  const [showWarning, setShowWarning] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(120);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const lastActivityRef = useRef(Date.now());
  const lastUpdateRef = useRef(Date.now());

  const resetActivity = useCallback(() => {
    lastActivityRef.current = Date.now();
    setShowWarning(false);
  }, []);

  // Auth state tracking
  useEffect(() => {
    const supabase = getClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setIsAuthenticated(!!session?.user);
        if (session?.user) {
          resetActivity();
        }
      }
    );
    return () => subscription.unsubscribe();
  }, [resetActivity]);

  // Activity listeners (throttled to 1s)
  useEffect(() => {
    if (!isAuthenticated) return;

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
  }, [isAuthenticated]);

  // Check interval (every 30s normally, every 1s during warning)
  useEffect(() => {
    if (!isAuthenticated) return;

    const check = () => {
      const elapsed = Date.now() - lastActivityRef.current;

      if (elapsed >= SESSION_TIMEOUT.INACTIVITY_MS) {
        getClient().auth.signOut();
        setShowWarning(false);
        // Redirect handled by auth state change in AppHeader/useAuth
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

    // Run immediately on mount
    check();

    // Fast interval during warning for countdown, slow otherwise
    const id = setInterval(check, showWarning ? 1000 : 30000);
    return () => clearInterval(id);
  }, [isAuthenticated, showWarning]);

  return { showWarning, secondsRemaining, staySignedIn: resetActivity, isAuthenticated };
}

"use client";

import { useState, useEffect, useCallback } from "react";
import type { AlertType } from "@/config/alerts";
import { ALERT_TYPES } from "@/config/alerts";

type AlertPreferences = Record<AlertType, boolean>;
type AlertEligibility = Record<AlertType, boolean>;

const DEFAULT_PREFS: AlertPreferences = {
  appeal_deadline: false,
  med_refill: false,
  new_denial: false,
  data_refresh: false,
};

const DEFAULT_ELIGIBILITY: AlertEligibility = {
  appeal_deadline: false,
  med_refill: false,
  new_denial: false,
  data_refresh: false,
};

interface UseAlertPreferencesReturn {
  preferences: AlertPreferences;
  eligibility: AlertEligibility;
  isLoading: boolean;
  plan: string | null;
  updatePreference: (type: AlertType, enabled: boolean) => Promise<void>;
}

export function useAlertPreferences(): UseAlertPreferencesReturn {
  const [preferences, setPreferences] = useState<AlertPreferences>(DEFAULT_PREFS);
  const [eligibility, setEligibility] = useState<AlertEligibility>(DEFAULT_ELIGIBILITY);
  const [isLoading, setIsLoading] = useState(true);
  const [plan, setPlan] = useState<string | null>(null);

  const loadPrefs = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/alerts/preferences");
      if (res.ok) {
        const data = await res.json();
        const prefs = { ...DEFAULT_PREFS };
        const elig = { ...DEFAULT_ELIGIBILITY };
        for (const type of ALERT_TYPES) {
          if (data.preferences?.[type] !== undefined) {
            prefs[type] = data.preferences[type];
          }
          if (data.eligibility?.[type] !== undefined) {
            elig[type] = data.eligibility[type];
          }
        }
        setPreferences(prefs);
        setEligibility(elig);
        setPlan(data.plan ?? null);
      }
    } catch (error) {
      console.warn("Failed to fetch alert preferences:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearPrefs = useCallback(() => {
    setPreferences(DEFAULT_PREFS);
    setEligibility(DEFAULT_ELIGIBILITY);
    setPlan(null);
    setIsLoading(false);
  }, []);

  // Load on mount, then re-fetch when auth state changes (sign-in / sign-out)
  useEffect(() => {
    loadPrefs();

    function handleAuthChange(e: Event) {
      const user = (e as CustomEvent<{ email: string; userId: string } | null>).detail;
      if (user) {
        loadPrefs();
      } else {
        clearPrefs();
      }
    }

    window.addEventListener("auth-state-change", handleAuthChange);
    return () => window.removeEventListener("auth-state-change", handleAuthChange);
  }, [loadPrefs, clearPrefs]);

  const updatePreference = useCallback(
    async (type: AlertType, enabled: boolean) => {
      // Optimistic update
      setPreferences((prev) => ({ ...prev, [type]: enabled }));

      try {
        const res = await fetch("/api/alerts/preferences", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ alertType: type, enabled }),
        });

        if (!res.ok) {
          // Revert on failure
          setPreferences((prev) => ({ ...prev, [type]: !enabled }));
        }
      } catch {
        setPreferences((prev) => ({ ...prev, [type]: !enabled }));
      }
    },
    []
  );

  return { preferences, eligibility, isLoading, plan, updatePreference };
}

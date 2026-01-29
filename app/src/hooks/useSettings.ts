"use client";

import { useState, useEffect, useCallback } from "react";

export interface UserSettings {
  textScale: number; // 0.9 - 1.2
}

const DEFAULT_SETTINGS: UserSettings = {
  textScale: 1,
};

const STORAGE_KEY = "denali-settings";

/**
 * Hook to manage user accessibility settings
 * Persists to localStorage and applies to document
 */
export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  // Also clean up any old high-contrast setting
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<UserSettings>;
        // Only keep textScale, ignore deprecated settings
        setSettings({
          textScale: parsed.textScale ?? DEFAULT_SETTINGS.textScale,
        });
      }

      // Clean up deprecated high-contrast attribute
      document.documentElement.removeAttribute("data-high-contrast");
    } catch {
      // Ignore parse errors
    }
    setIsLoaded(true);
  }, []);

  // Apply settings to document
  useEffect(() => {
    if (!isLoaded) return;

    // Text scale
    document.documentElement.style.setProperty(
      "--text-scale",
      String(settings.textScale)
    );
  }, [settings, isLoaded]);

  // Save settings to localStorage
  const updateSettings = useCallback((updates: Partial<UserSettings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...updates };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }, []);

  // Individual setter for text scale
  const setTextScale = useCallback(
    (scale: number) => {
      // Clamp to valid range
      const clamped = Math.max(0.9, Math.min(1.2, scale));
      updateSettings({ textScale: clamped });
    },
    [updateSettings]
  );

  const resetSettings = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Ignore storage errors
    }

    // Clean up deprecated attribute
    document.documentElement.removeAttribute("data-high-contrast");
  }, []);

  return {
    settings,
    isLoaded,
    updateSettings,
    setTextScale,
    resetSettings,
  };
}

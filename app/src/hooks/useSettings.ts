"use client";

import { useState, useEffect, useCallback } from "react";

export interface UserSettings {
  textScale: number; // 0.8 - 1.5
  highContrast: boolean;
  reduceMotion: boolean;
  theme: "auto" | "light" | "dark";
}

const DEFAULT_SETTINGS: UserSettings = {
  textScale: 1,
  highContrast: false,
  reduceMotion: false,
  theme: "auto",
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
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Partial<UserSettings>;
        setSettings((prev) => ({ ...prev, ...parsed }));
      }
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

    // High contrast
    document.documentElement.setAttribute(
      "data-high-contrast",
      String(settings.highContrast)
    );

    // Reduce motion - browser handles this via media query,
    // but we can add a class for additional control
    document.documentElement.classList.toggle(
      "reduce-motion",
      settings.reduceMotion
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

  // Individual setters for convenience
  const setTextScale = useCallback(
    (scale: number) => {
      // Clamp to valid range
      const clamped = Math.max(0.8, Math.min(1.5, scale));
      updateSettings({ textScale: clamped });
    },
    [updateSettings]
  );

  const setHighContrast = useCallback(
    (enabled: boolean) => {
      updateSettings({ highContrast: enabled });
    },
    [updateSettings]
  );

  const setReduceMotion = useCallback(
    (enabled: boolean) => {
      updateSettings({ reduceMotion: enabled });
    },
    [updateSettings]
  );

  const setTheme = useCallback(
    (theme: "auto" | "light" | "dark") => {
      updateSettings({ theme });
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
  }, []);

  return {
    settings,
    isLoaded,
    updateSettings,
    setTextScale,
    setHighContrast,
    setReduceMotion,
    setTheme,
    resetSettings,
  };
}

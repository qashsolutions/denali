/**
 * ThemeMode — the user's Light / Dark / System appearance choice.
 *
 * `useTheme()` resolves the active palette from the effective scheme, which
 * this module supplies: an explicit Light/Dark override, or "system" to
 * follow `useColorScheme()`. The choice persists locally in expo-secure-store
 * (a UI preference, not a secret — but SecureStore is already a dependency and
 * there is no plaintext-prefs store on device). Nothing leaves the device;
 * this is invariant-neutral (no health data, no server round-trip).
 *
 * `resolveScheme` is a pure helper (live state as explicit args) so the
 * mode→scheme decision is unit-testable without rendering — per the
 * stale-closure rule in mobile/CLAUDE.md.
 */

import * as SecureStore from "expo-secure-store";
import React from "react";

import { MODE_KEY, VALID_MODES, type ThemeMode } from "./themeScheme";

// Re-export the pure core so existing consumers can keep importing from
// "@/theme/ThemeMode" (the resolver/types live in ./themeScheme for testability).
export {
  resolveScheme,
  type ThemeMode,
  type EffectiveScheme,
  type SystemScheme,
} from "./themeScheme";

interface ThemeModeContextValue {
  /** The user's choice. Defaults to "system" until the stored value loads. */
  mode: ThemeMode;
  /** Set + persist the choice. Fire-and-forget persistence. */
  setMode: (mode: ThemeMode) => void;
}

const ThemeModeContext = React.createContext<ThemeModeContextValue>({
  mode: "system",
  setMode: () => {},
});

export function ThemeModeProvider({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  const [mode, setModeState] = React.useState<ThemeMode>("system");

  // Hydrate the stored choice once on mount. Non-blocking — the app renders
  // in "system" until this resolves (sub-ms SecureStore read on warm devices).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await SecureStore.getItemAsync(MODE_KEY);
        if (!cancelled && stored != null && VALID_MODES.has(stored)) {
          setModeState(stored as ThemeMode);
        }
      } catch (err) {
        console.warn("[ThemeMode] load failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = React.useCallback((next: ThemeMode) => {
    // UI updates immediately; persistence is fire-and-forget (never block
    // the toggle on the keystore write).
    setModeState(next);
    SecureStore.setItemAsync(MODE_KEY, next).catch((err) =>
      console.warn("[ThemeMode] persist failed", err),
    );
  }, []);

  const value = React.useMemo<ThemeModeContextValue>(
    () => ({ mode, setMode }),
    [mode, setMode],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      {children}
    </ThemeModeContext.Provider>
  );
}

/**
 * Read the current mode + setter. Returns the "system" default outside a
 * provider, so `useTheme()` stays safe if a consumer mounts without one.
 */
export function useThemeMode(): ThemeModeContextValue {
  return React.useContext(ThemeModeContext);
}

/** Test-only: the SecureStore label, for persistence assertions. */
export const __MODE_KEY_FOR_TESTS = MODE_KEY;

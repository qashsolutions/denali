/**
 * Theme-mode pure core — types + the mode→scheme resolver, with NO JSX and NO
 * native imports so vitest can prove the branch logic directly. The React
 * provider/hook live in ThemeMode.tsx (Maestro's surface); this file is the
 * unit-testable seam (pure helpers, live state as explicit args — per the
 * stale-closure rule in mobile/CLAUDE.md).
 */

export type ThemeMode = "light" | "dark" | "system";
export type EffectiveScheme = "light" | "dark";

/** What `useColorScheme()` can return — broadened so the resolver is total.
 *  ("unspecified" is Android's no-preference value; treated as light.) */
export type SystemScheme = "light" | "dark" | "unspecified" | null | undefined;

/** Persisted key. Versioned so a future schema change can't misread it. */
export const MODE_KEY = "denali.theme.mode.v1";

export const VALID_MODES: ReadonlySet<string> = new Set<ThemeMode>([
  "light",
  "dark",
  "system",
]);

/**
 * Resolve the effective light/dark scheme from the user's mode and the
 * OS-reported scheme. "system" follows the OS (anything not "dark" → light,
 * to match the web default and useTheme's historical behavior).
 */
export function resolveScheme(
  mode: ThemeMode,
  systemScheme: SystemScheme,
): EffectiveScheme {
  if (mode === "light" || mode === "dark") return mode;
  return systemScheme === "dark" ? "dark" : "light";
}

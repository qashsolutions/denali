/**
 * useTheme — Phase 1 mobile theme hook.
 *
 * Returns the full token bundle plus the active light/dark palette resolved
 * from the OS color scheme. Consumers prefer `active` for color values and
 * dip into `theme.typography` / `theme.spacing` / `theme.radii` for the
 * mode-independent tokens.
 *
 * Usage:
 *   const { active, theme } = useTheme();
 *   const styles = useMemo(() => StyleSheet.create({
 *     container: {
 *       backgroundColor: active.bgPrimary,
 *       padding: theme.spacing.md,
 *       borderRadius: theme.radii.lg,
 *     },
 *     title: {
 *       color: active.textPrimary,
 *       fontSize: theme.typography.sizes["2xl"],
 *       fontFamily: theme.typography.fonts.serif,
 *     },
 *   }), [active, theme]);
 *
 * Phase 1 invariant: tokens come from useTheme(), never from inline hex
 * literals in components. mobile/CLAUDE.md § Conformance checklist enforces
 * this; mobile-privacy-invariant-guard audits it.
 *
 * Notes:
 *   - useColorScheme() returns "light" | "dark" | null. null defaults to
 *     "light" to match the web's behavior when no preference is reported
 *     (matches Tailwind's "light is default" convention even though web's
 *     globals.css ships dark as :root — see tokens.ts header).
 *   - Memoized so the returned object is stable across re-renders when the
 *     scheme hasn't changed; component-level StyleSheet.create() can rely
 *     on referential stability when memoized with `active` / `theme` deps.
 */

import { useMemo } from "react";
import { useColorScheme } from "react-native";

import type { Theme, ThemeColors } from "@/contracts";

import { tokens } from "./tokens";

export interface UseThemeResult {
  /** The resolved palette for the current OS color scheme. */
  active: ThemeColors;
  /** The full token bundle (typography, spacing, radii, both palettes). */
  theme: Theme;
}

export function useTheme(): UseThemeResult {
  const scheme = useColorScheme();

  return useMemo<UseThemeResult>(() => {
    const active: ThemeColors =
      scheme === "dark" ? tokens.colors.dark : tokens.colors.light;
    return { active, theme: tokens };
  }, [scheme]);
}

export default useTheme;

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
 *   - The effective scheme is the user's Light/Dark/System choice resolved
 *     against `useColorScheme()` (see src/theme/ThemeMode.tsx). "system"
 *     follows the OS; null/undefined OS scheme defaults to "light".
 *   - BOTH `active` (the 11-slot ThemeColors) AND `redesign` (the richer
 *     washes/teal/ink vocabulary that components consume directly) switch
 *     by scheme — a dark `active` alone would leave every `redesign.*`
 *     consumer rendering light colors.
 *   - Memoized on the resolved scheme so the returned object is stable
 *     across re-renders when the scheme hasn't changed; component-level
 *     StyleSheet.create() can rely on referential stability when memoized
 *     with `active` / `theme` / `redesign` deps.
 */

import { useMemo } from "react";
import { useColorScheme } from "react-native";

import type { Theme, ThemeColors } from "@/contracts";

import { resolveScheme, useThemeMode } from "./ThemeMode";
import { redesign, redesignDark, tokens, type RedesignPalette } from "./tokens";

export interface UseThemeResult {
  /** The resolved palette for the current (light|dark) scheme. */
  active: ThemeColors;
  /** The full token bundle (typography, spacing, radii, both palettes). */
  theme: Theme;
  /**
   * Redesign-specific named tokens (washes, blue, teal-deep, card radius)
   * that have no slot in the frozen ThemeColors contract. Switches with the
   * scheme. Additive — same single source (src/theme/tokens.ts).
   */
  redesign: RedesignPalette;
  /** The resolved scheme — "light" | "dark" — after the mode override. */
  scheme: "light" | "dark";
}

export function useTheme(): UseThemeResult {
  const systemScheme = useColorScheme();
  const { mode } = useThemeMode();
  const scheme = resolveScheme(mode, systemScheme);

  return useMemo<UseThemeResult>(() => {
    const dark = scheme === "dark";
    return {
      active: dark ? tokens.colors.dark : tokens.colors.light,
      theme: tokens,
      redesign: dark ? redesignDark : redesign,
      scheme,
    };
  }, [scheme]);
}

export default useTheme;

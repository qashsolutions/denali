/**
 * Phase 1 mobile design tokens — single source of truth for native styling.
 *
 * Values mirror app/src/app/globals.css EXACTLY (no invented shades, no
 * rounding). A drift test at src/theme/__tests__/tokens.test.ts parses
 * globals.css and asserts these values still match.
 *
 * ────────────────────────────────────────────────────────────────────────
 * STYLING APPROACH: typed StyleSheet via useTheme() hook.
 * ────────────────────────────────────────────────────────────────────────
 *
 * The agent definition (.claude/agents/mobile-theme-bridge.md) and the spec
 * (docs/design/phase-1-45plus.md §54-55) name two viable approaches:
 *   1. NativeWind (Tailwind authoring parity on RN)
 *   2. Typed StyleSheet theme + useTheme() hook
 *
 * Wave 1 ships option 2. Rationale:
 *
 *   • Expo SDK 56 + RN 0.85.3 + React 19.2.3 + New Architecture is bleeding
 *     edge. NativeWind v4.2.4 (latest stable, 2026-Q1) pulls in
 *     react-native-css-interop@0.2.4 which requires
 *     react-native-reanimated>=3.6.2 — Reanimated's New-Arch story on
 *     RN 0.85 is not broadly validated as of work date 2026-06-04.
 *     NativeWind v5 (5.0.0-preview.4) is preview-only with no stability
 *     guarantee.
 *   • The frozen contract at src/contracts/Theme.ts was designed for a
 *     useTheme() hook ("a useTheme(): Theme hook returning colors,
 *     typography, spacing, etc."). The typed StyleSheet path is the
 *     contract-native path.
 *   • Pass 2 (mobile-app-shell timeline + onboarding-builder + upload UI)
 *     can layer NativeWind on top if the team later wants Tailwind authoring
 *     parity — this token module would seed tailwind.config.js verbatim, so
 *     the migration is mechanical. The reverse (yanking NativeWind out
 *     mid-build) is harder.
 *
 * If/when NativeWind is added, this module remains the source of truth and
 * tailwind.config.js reads from it. The conformance rule ("no hardcoded
 * colors/spacing/radii in components") is enforced either way.
 *
 * ────────────────────────────────────────────────────────────────────────
 * COLOR PALETTE MIRRORING
 * ────────────────────────────────────────────────────────────────────────
 *
 * globals.css layout (as of 2026-06-04, file is 423 lines):
 *   • Lines  8-39   :root            — non-color tokens (fonts, space, radii)
 *   • Lines 45-93   :root            — DARK palette (web's default)
 *   • Lines 99-147  [data-theme=dark] — DARK explicit (duplicate of above)
 *   • Lines 153-201 [data-theme=light] — LIGHT palette
 *   • Lines 410-423 @theme inline    — Tailwind v4 color-utility bindings
 *
 * Web defaults to dark and lets the user toggle to light. Mobile uses
 * useColorScheme() (the OS theme) — see src/theme/useTheme.ts. The token
 * values are identical between the two platforms.
 *
 * ────────────────────────────────────────────────────────────────────────
 * WAVE-1 POST-AUDIT AMENDMENT (added 2026-06-04 during the controlled thaw)
 * ────────────────────────────────────────────────────────────────────────
 *
 * The Theme contract was extended to mirror globals.css fully:
 *   • bgTertiary added to ThemeColors
 *   • ThemeChatColors (user-bubble-from/to, assistant-bubble)
 *   • ThemeConditionAccents (auth-blue / check-teal / appeal-coral /
 *     health-red / diabetes-violet — each {base, light, bg})
 *   • ThemeBrand (purple — mode-agnostic)
 *   • space3 + space5 on ThemeSpacing (the 12px + 20px intermediates)
 *
 * See docs/history/phase-1-mobile-decisions.md § "Theme contract Wave-1
 * amendment" for the rationale. mobile-theme-bridge will extend the drift
 * test to cover the new tokens.
 */

import type { Theme, ThemeColors, ThemeChatColors, ThemeConditionAccents } from "@/contracts";

/**
 * Dark palette — mirrors globals.css :root (lines 45-93) which is also
 * duplicated under [data-theme="dark"] (lines 99-147). Both blocks are
 * byte-identical for the keys we expose.
 */
const darkColors: ThemeColors = {
  // Backgrounds (lines 47-49 / 101-103)
  bgPrimary: "#1A1612",
  bgSecondary: "#241F1A",
  bgTertiary: "#362F28",

  // Text (lines 52-54 / 106-108)
  textPrimary: "#ffffff",
  textSecondary: "#A09488",
  textMuted: "#6B5F55",

  // Accents (lines 57-58 / 111-112)
  accentPrimary: "#D4845A",
  accentSecondary: "#A08468",

  // Structural (line 69 / 123)
  border: "#3A3228",

  // Semantic (lines 61-63 / 115-117)
  success: "#10b981",
  warning: "#f59e0b",
  error: "#ef4444",
};

/**
 * Light palette — mirrors globals.css [data-theme="light"] (lines 153-201).
 */
const lightColors: ThemeColors = {
  // Backgrounds (lines 155-157)
  bgPrimary: "#FEFCF8",
  bgSecondary: "#FFFEFA",
  bgTertiary: "#F5F0E8",

  // Text (lines 160-162)
  textPrimary: "#2C1810",
  textSecondary: "#6B5B4E",
  textMuted: "#A89888",

  // Accents (lines 165-166)
  accentPrimary: "#C26A3E",
  accentSecondary: "#8B6D4F",

  // Structural (line 177)
  border: "#E8DFD3",

  // Semantic (lines 169-171)
  success: "#2D8659",
  warning: "#C26A3E",
  error: "#C44536",
};

/**
 * Chat-surface colors — globals.css lines 66-68 (dark) and 174-176 (light).
 */
const darkChat: ThemeChatColors = {
  userBubbleFrom: "#D4845A",
  userBubbleTo: "#B8704E",
  assistantBubble: "#241F1A",
};

const lightChat: ThemeChatColors = {
  userBubbleFrom: "#C26A3E",
  userBubbleTo: "#A85A33",
  assistantBubble: "#FFFEFA",
};

/**
 * Domain-condition accents — globals.css lines 74-88 (dark) and 182-196 (light).
 * Each family follows the {base, light, bg} triplet from globals.css's
 * --<family> / --<family>-light / --<family>-bg pattern.
 */
const darkConditions: ThemeConditionAccents = {
  authBlue: { base: "#3B6DE0", light: "#5B8AF0", bg: "#1a2744" },
  checkTeal: { base: "#0EA574", light: "#2FC495", bg: "#132e24" },
  appealCoral: { base: "#E05C3B", light: "#F0785B", bg: "#2e1a16" },
  healthRed: { base: "#E04B5A", light: "#F06B7A", bg: "#2e1619" },
  diabetesViolet: { base: "#8B5CF6", light: "#A78BFA", bg: "#1e1636" },
};

const lightConditions: ThemeConditionAccents = {
  authBlue: { base: "#3B6DE0", light: "#5B8AF0", bg: "#EEF3FD" },
  checkTeal: { base: "#5A8A6E", light: "#7BA88F", bg: "#F0F4EE" },
  appealCoral: { base: "#B8704E", light: "#CC8B6C", bg: "#F5EDE6" },
  healthRed: { base: "#B3695A", light: "#CC8577", bg: "#F6EEEA" },
  diabetesViolet: { base: "#7B6B8A", light: "#9688A3", bg: "#F1EEF3" },
};

/**
 * Phase 1 token bundle. Satisfies the frozen Theme contract at
 * src/contracts/Theme.ts.
 */
export const tokens = {
  colors: {
    light: lightColors,
    dark: darkColors,
    chat: { light: lightChat, dark: darkChat },
    conditions: { light: lightConditions, dark: darkConditions },
    /** Mode-agnostic brand colors. globals.css line 13: --brand-purple. */
    brand: { purple: "#7c3aed" },
  },

  typography: {
    /**
     * Font families. Web globals.css lines 10-12:
     *   --font-sans:  DM Sans + system fallbacks
     *   --font-serif: Instrument Serif + Georgia fallback
     *   --font-mono:  SF Mono / Fira Code / etc.
     *
     * On RN we name the canonical face. Future work: load the actual
     * Instrument Serif + DM Sans via expo-font so headings render in the
     * right typeface. Until then, RN falls back to the platform sans
     * (San Francisco on iOS, Roboto on Android), which is the same fallback
     * chain the web uses — no visual surprise.
     */
    fonts: {
      sans: "DM Sans",
      serif: "Instrument Serif",
      mono: "SF Mono",
    },

    /**
     * Type scale — pixel values. Web html sets 16px base and lets the user
     * scale via --text-scale (0.8-1.5). Mobile honors the OS text-size
     * setting natively, so we don't replicate the scale factor here.
     *
     * Step ratio chosen to match the web's component sizes:
     *   - .text-suggestion  → 0.875rem  → 14px → "sm"
     *   - .text-body        → 1rem      → 16px → "base"
     *   - .text-greeting    → 1.75rem   → 28px → "3xl"
     *   - .text-label       → 0.75rem   → 12px → "xs"
     */
    sizes: {
      xs: 12,
      sm: 14,
      base: 16,
      lg: 18,
      xl: 20,
      "2xl": 24,
      "3xl": 28,
    },

    /**
     * Weights — matches Tailwind defaults the web uses.
     * .text-greeting=700, .text-label=600, .text-suggestion=500, body=400.
     */
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },

    /**
     * Line heights — multipliers (RN convention for lineHeight is absolute,
     * but we expose ratios so consumers can multiply against the size they
     * pick: lineHeight: tokens.typography.sizes.base * tokens.typography.lineHeights.normal).
     * Values match common web patterns: .text-greeting line-height=1.2 → tight;
     * .text-body line-height=1.5 → normal; .prose-chat line-height=1.6 → relaxed.
     */
    lineHeights: {
      tight: 1.2,
      normal: 1.5,
      relaxed: 1.6,
    },
  },

  /**
   * Spacing scale. globals.css lines 19-27 expose --space-1 through
   * --space-12 in rem; we mirror the values in px (1rem = 16px web baseline).
   *
   *   --space-1  = 0.25rem  =  4px  → xs
   *   --space-2  = 0.5rem   =  8px  → sm
   *   --space-3  = 0.75rem  = 12px  → space3 (intermediate)
   *   --space-4  = 1rem     = 16px  → md
   *   --space-5  = 1.25rem  = 20px  → space5 (intermediate)
   *   --space-6  = 1.5rem   = 24px  → lg
   *   --space-8  = 2rem     = 32px  → xl
   *   --space-10 = 2.5rem   = 40px  → 2xl
   *   --space-12 = 3rem     = 48px  → 3xl
   *
   * Wave-1 amendment: space3 + space5 added so the contract fully mirrors
   * globals.css's 9-step scale. See header for the rationale.
   */
  spacing: {
    xs: 4,
    sm: 8,
    space3: 12,
    md: 16,
    space5: 20,
    lg: 24,
    xl: 32,
    "2xl": 40,
    "3xl": 48,
  },

  /**
   * Border radii. globals.css lines 30-34:
   *   --radius-sm   = 0.375rem = 6px
   *   --radius-md   = 0.5rem   = 8px
   *   --radius-lg   = 0.75rem  = 12px
   *   --radius-xl   = 1rem     = 16px
   *   --radius-full = 9999px
   */
  radii: {
    sm: 6,
    md: 8,
    lg: 12,
    xl: 16,
    full: 9999,
  },
} as const satisfies Theme;

/**
 * Re-export the typed bundle as `Theme` for consumers who only need the
 * runtime values (vs. the type).
 */
export default tokens;

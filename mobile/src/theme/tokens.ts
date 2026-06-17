/**
 * Phase 1 mobile design tokens — single source of truth for native styling.
 *
 * REDESIGN STEP 1 (2026-06-09): the palette now mirrors the "Alpine
 * clarity" direction in docs/design/denali-redesign-mockups.html (:root
 * block) EXACTLY — cool paper / slate ink / glacier teal — replacing the
 * web's cream/terracotta. The drift test at
 * src/theme/__tests__/tokens.test.ts parses the mockup HTML and asserts
 * these values still match. Non-color tokens (spacing, radii) still
 * mirror app/src/app/globals.css.
 *
 * The mockup defines the light appearance. A companion DARK appearance
 * ("Alpine night") was derived from it on 2026-06-14: the same cool /
 * glacier-teal identity inverted for low-light — deep slate-navy paper,
 * near-white cool ink, brightened glacier teal. The severity tokens
 * (sage / amber / alarm washes + their text colors) keep their semantic
 * hue separation and pass WCAG AA for pill text and disclaimer copy
 * (asserted in src/theme/__tests__/tokens.test.ts). Selection is driven by
 * the Settings Light / Dark / System control over `useColorScheme()` —
 * see src/theme/ThemeMode.tsx + useTheme.ts.
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
 *
 *     AMENDMENT (2026-06-14, decision D18): the Reanimated New-Arch caution
 *     above is LIFTED — react-native-reanimated@4 + react-native-worklets ARE
 *     now installed and verified on-device (Tier-4 gestures). This does NOT
 *     reopen the NativeWind decision: the typed-StyleSheet theme remains the
 *     source of truth; Reanimated is used directly for motion, not via
 *     NativeWind's css-interop.
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
 * COLOR PALETTE SOURCE
 * ────────────────────────────────────────────────────────────────────────
 *
 * Colors come from the redesign mockup's :root block
 * (docs/design/denali-redesign-mockups.html) — see the `redesign` export
 * below for the full named vocabulary. The mobile app adopts the redesign
 * first; the web app migrates later. The dark companion (`redesignDark`)
 * is derived from this light vocabulary, key-for-key. `useTheme.ts` selects
 * between them per the resolved scheme (Settings override → OS scheme).
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
 * Redesign palette — mirrors the :root block of
 * docs/design/denali-redesign-mockups.html EXACTLY. These named tokens are
 * the redesign's full vocabulary; ThemeColors keys below map onto them.
 *
 * `tealDeep` is the contrast-safe teal for TEXT (the base `teal` is a
 * fill/stroke accent — too low-contrast for copy on paper/surface).
 */
export const redesign = {
  /** Cool high-altitude light — screen background. */
  paper: "#F4F7F9",
  /** Cards. */
  surface: "#FFFFFF",
  /** Deep slate-navy — primary text. */
  ink: "#142433",
  /** Secondary text. */
  ink2: "#566472",
  /** Tertiary / captions / disclaimer. */
  ink3: "#93A1AC",
  /** Hairlines. */
  line: "#E4EBF0",
  /** Softer hairline / neutral tertiary fill. */
  line2: "#EEF3F6",
  /** Glacier teal — the single accent. */
  teal: "#0E8C86",
  /** Contrast-safe teal for any teal-colored TEXT. */
  tealDeep: "#0A6B66",
  /** Soft active / pill background. */
  tealWash: "#E4F1F0",
  /** Calm secondary data line (e.g. diastolic). */
  blue: "#4E8FA6",
  /** Reserved attention (calm). */
  amber: "#B0791F",
  /** Calm reference band / watch-pill background. */
  amberWash: "#F6ECD7",
  /** Calm "typical range" band. */
  sageWash: "#E7F0EA",
  /**
   * Alarm red — INTENTIONAL ADDITION beyond the mockup :root (the mockup
   * defines no alarm state). Carried over from the pre-redesign palette.
   * Consumers: severe screener bands and crisis-path UI ONLY.
   */
  alarm: "#C44536",
  /**
   * Light alarm wash — companion to `alarm`, built to the same
   * construction as the other *-wash tokens (pale tint of the base hue
   * for pill/band backgrounds). Same two consumers as `alarm`.
   */
  alarmWash: "#F8E9E5",
  /** Neutral pill background (mockup .pill-soft). */
  pillSoft: "#EEF2F5",
  /**
   * Trend-chart severity band fills — brighter + more saturated than the *Wash
   * pill tints so large band areas read as DISTINCT at a glance (the washes are
   * tuned for small pills and go nearly invisible across a chart). Same
   * green / neutral / amber / red severity semantics as the pills; chart-only.
   */
  bandOk: "#D4EBDC",
  bandSoft: "#E6ECF1",
  bandWatch: "#F7E2AE",
  bandAlarm: "#F7CFC6",
  /** Card corner radius (mockup --r: 18px). */
  rCard: 18,
  /** Icon-chip corner radius (mockup .cicon border-radius: 10px). */
  rChip: 10,
} as const;

/**
 * Widened shape shared by the light (`redesign`) + dark (`redesignDark`)
 * vocabularies: color tokens are `string`, the two radii are `number`. The
 * `as const` light object is assignable to this (narrow → widened); the dark
 * object is typed against it so the two can never drift in key set.
 */
export type RedesignPalette = {
  [K in keyof typeof redesign]: (typeof redesign)[K] extends number
    ? number
    : string;
};

/**
 * Alpine-night dark palette — the dark companion to `redesign`, derived
 * 2026-06-14. Same key set + identity (cool paper, glacier teal), inverted
 * for low-light. Radii (rCard / rChip) are appearance-independent and carry
 * the light values unchanged. Contrast for the clinical surfaces (disclaimer
 * copy, severity pill text) is WCAG-AA-verified in tokens.test.ts.
 */
export const redesignDark: RedesignPalette = {
  /** Deep slate-navy — screen background (cool, not pure black). */
  paper: "#0E1822",
  /** Cards — lifted one step from paper. */
  surface: "#17252F",
  /** Near-white cool — primary text. */
  ink: "#EAF1F6",
  /** Secondary text. */
  ink2: "#A7B7C3",
  /** Tertiary / captions / disclaimer (AA on paper, 5.3:1). */
  ink3: "#7E8E9B",
  /** Hairlines. */
  line: "#283945",
  /** Softer hairline / neutral tertiary fill. */
  line2: "#1E2D38",
  /** Glacier teal — the single accent, brightened for dark. */
  teal: "#19A89F",
  /** Contrast-safe teal for any teal-colored TEXT (light teal on dark). */
  tealDeep: "#46CFC6",
  /** Soft active / pill background. */
  tealWash: "#103A36",
  /** Calm secondary data line (e.g. diastolic). */
  blue: "#6FAAC2",
  /** Reserved attention (calm). */
  amber: "#D8A341",
  /** Calm reference band / watch-pill background. */
  amberWash: "#3A2C12",
  /** Calm "typical range" band. */
  sageWash: "#16301F",
  /** Alarm red — severe screener bands + crisis-path UI ONLY. */
  alarm: "#E96458",
  /** Light alarm wash — severe band / pill background. */
  alarmWash: "#3C1C17",
  /** Neutral pill background. */
  pillSoft: "#20303A",
  /** Trend-chart severity band fills (dark) — see the light bandOk note. */
  bandOk: "#1C3D29",
  bandSoft: "#283845",
  bandWatch: "#4A3814",
  bandAlarm: "#4D241D",
  /** Radii are appearance-independent. */
  rCard: redesign.rCard,
  rChip: redesign.rChip,
};

/**
 * The redesign mockup ships a single light appearance. Both ThemeColors
 * palettes resolve to it (dark variant deferred — see file header).
 *
 * Mapping notes:
 *   - bgTertiary → line2 (the soft neutral fill; mockup has no third bg).
 *   - accentSecondary → tealDeep, per the contrast rule for teal text.
 *   - success → teal (the mockup reserves green washes for range bands,
 *     not semantic success); warning → amber.
 *   - error → alarm (the formalized alarm token — an intentional addition
 *     beyond the mockup, which defines no alarm state).
 */
const redesignColors: ThemeColors = {
  // Backgrounds
  bgPrimary: redesign.paper,
  bgSecondary: redesign.surface,
  bgTertiary: redesign.line2,

  // Text
  textPrimary: redesign.ink,
  textSecondary: redesign.ink2,
  textMuted: redesign.ink3,

  // Accents
  accentPrimary: redesign.teal,
  accentSecondary: redesign.tealDeep,

  // Structural
  border: redesign.line,

  // Semantic
  success: redesign.teal,
  warning: redesign.amber,
  error: redesign.alarm,
};

/**
 * Dark ThemeColors — the same key→token mapping as `redesignColors`, read
 * off the `redesignDark` vocabulary. error → alarm, success → teal, etc.
 */
const redesignDarkColors: ThemeColors = {
  // Backgrounds
  bgPrimary: redesignDark.paper,
  bgSecondary: redesignDark.surface,
  bgTertiary: redesignDark.line2,

  // Text
  textPrimary: redesignDark.ink,
  textSecondary: redesignDark.ink2,
  textMuted: redesignDark.ink3,

  // Accents
  accentPrimary: redesignDark.teal,
  accentSecondary: redesignDark.tealDeep,

  // Structural
  border: redesignDark.line,

  // Semantic
  success: redesignDark.teal,
  warning: redesignDark.amber,
  error: redesignDark.alarm,
};

const darkColors: ThemeColors = redesignDarkColors;
const lightColors: ThemeColors = redesignColors;

/**
 * Chat-surface colors — rethemed to the redesign accent: user bubble
 * gradient teal → teal-deep, assistant bubble on the card surface.
 */
const redesignChat: ThemeChatColors = {
  userBubbleFrom: redesign.teal,
  userBubbleTo: redesign.tealDeep,
  assistantBubble: redesign.surface,
};

const redesignDarkChat: ThemeChatColors = {
  userBubbleFrom: redesignDark.teal,
  userBubbleTo: redesignDark.tealDeep,
  assistantBubble: redesignDark.surface,
};

const darkChat: ThemeChatColors = redesignDarkChat;
const lightChat: ThemeChatColors = redesignChat;

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
     * Font families — redesign roles, mapped onto the frozen contract keys:
     *   sans  → BODY    = Inter        (mockup --body)
     *   serif → DISPLAY = Bricolage Grotesque (mockup --display)
     *   mono  → NUMBERS = Inter Tight  (mockup --num, tabular numerals)
     *
     * Values are the expo-font registration KEYS from src/theme/fonts.tsx
     * (RN has no CSS-style font stacks — one registered face per name).
     * Each key names the role's default face; weight-precise styling on
     * redesigned surfaces goes through fontStyle() in src/theme/fonts.tsx,
     * which also provides the OS-system-font floor when fonts haven't
     * loaded. Legacy screens pairing these families with fontWeight get
     * nearest-face/synthetic rendering — restyled in later redesign steps.
     */
    fonts: {
      sans: "Inter-Regular",
      serif: "Bricolage-SemiBold",
      mono: "InterTight-SemiBold",
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
      // base bumped 16 → 17 for the 45+ legibility floor (proposed a11y
      // acceptance criterion: body ≥17px, Dynamic Type still respected via
      // MAX_FONT_SCALE chrome caps). Colors-only token-drift test is unaffected.
      base: 17,
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

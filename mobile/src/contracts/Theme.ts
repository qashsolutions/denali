/**
 * Theme — frozen Phase 1 contract for the typed design-token shape.
 *
 * Implementation: mobile-theme-bridge agent owns src/theme/tokens.ts,
 * which exports a const object satisfying this interface.
 *
 * Values are mirrored from app/src/app/globals.css (CSS variables in the
 * :root block plus the Tailwind v4 @theme inline block around line 415-422).
 * A token-drift test verifies the mobile values still match the web's
 * source-of-truth.
 *
 * Consumers: every UI surface (theme-bridge components, onboarding,
 * upload review UI, app-shell timeline). They type-check against `Theme`
 * via a `useTheme(): Theme` hook (or a NativeWind-seeded token config
 * if that authoring approach is chosen).
 *
 * Contract history:
 *   - Wave 0 (2026-06-04): initial freeze.
 *   - Wave 1 amendment (post-audit): added `bgTertiary` to ThemeColors,
 *     ThemeChatColors, ThemeAccentFamily, ThemeConditionAccents,
 *     ThemeBrand, plus `space3` + `space5` on ThemeSpacing. Theme now
 *     fully mirrors globals.css. See
 *     docs/history/phase-1-mobile-decisions.md § "Theme contract Wave-1
 *     amendment" for the why.
 */

export interface ThemeColors {
  // Backgrounds
  bgPrimary: string;
  bgSecondary: string;
  /** Tertiary background — matches --bg-tertiary in globals.css. */
  bgTertiary: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Accent
  accentPrimary: string;
  accentSecondary: string;

  // Structural
  border: string;

  // Semantic
  success: string;
  warning: string;
  error: string;
}

/**
 * Chat-surface colors — matches --user-bubble-from, --user-bubble-to,
 * --assistant-bubble in globals.css. Varies by mode (light/dark).
 */
export interface ThemeChatColors {
  userBubbleFrom: string;
  userBubbleTo: string;
  assistantBubble: string;
}

/**
 * A semantic accent family — base, light variant, and contextual background.
 * Mirrors the `--<family>`, `--<family>-light`, `--<family>-bg` triplet from
 * globals.css.
 */
export interface ThemeAccentFamily {
  base: string;
  light: string;
  bg: string;
}

/**
 * Domain-condition accents — matches the auth-blue / check-teal /
 * appeal-coral / health-red / diabetes-violet triplet families in
 * globals.css. Varies by mode (light/dark).
 */
export interface ThemeConditionAccents {
  authBlue: ThemeAccentFamily;
  checkTeal: ThemeAccentFamily;
  appealCoral: ThemeAccentFamily;
  healthRed: ThemeAccentFamily;
  diabetesViolet: ThemeAccentFamily;
}

/**
 * Brand-level colors that do NOT vary by mode. Matches --brand-purple
 * in globals.css (the "Health" word in the logo treatment).
 */
export interface ThemeBrand {
  purple: string;
}

export interface ThemeTypography {
  fonts: {
    /** Body — matches --font-sans (DM Sans). */
    sans: string;
    /** Headings — matches --font-serif (Instrument Serif). */
    serif: string;
    /** Numeric / step labels — monospace. */
    mono: string;
  };
  sizes: {
    xs: number;
    sm: number;
    base: number;
    lg: number;
    xl: number;
    "2xl": number;
    "3xl": number;
  };
  weights: {
    regular: number;
    medium: number;
    semibold: number;
    bold: number;
  };
  lineHeights: {
    tight: number;
    normal: number;
    relaxed: number;
  };
}

/**
 * Spacing scale — the named tokens (xs/sm/md/lg/xl/2xl/3xl) follow the
 * standard mobile cadence; `space3` and `space5` are intermediate web-aligned
 * gaps (12px and 20px) that don't fit the named scale cleanly. Matches the
 * --space-3 and --space-5 CSS variables in globals.css.
 */
export interface ThemeSpacing {
  xs: number;
  sm: number;
  space3: number;
  md: number;
  space5: number;
  lg: number;
  xl: number;
  "2xl": number;
  "3xl": number;
}

export interface ThemeRadii {
  sm: number;
  md: number;
  lg: number;
  xl: number;
  full: number;
}

/**
 * Frozen Phase 1 contract. Implemented by mobile-theme-bridge in
 * src/theme/tokens.ts as a `const tokens: Theme = { ... } satisfies Theme`.
 *
 * Color structure:
 *   - `colors.light` / `colors.dark`: the standard per-mode `ThemeColors`.
 *   - `colors.chat.{light,dark}`: chat-surface bubble colors.
 *   - `colors.conditions.{light,dark}`: domain-condition accents.
 *   - `colors.brand`: mode-agnostic brand colors.
 */
export interface Theme {
  colors: {
    light: ThemeColors;
    dark: ThemeColors;
    chat: { light: ThemeChatColors; dark: ThemeChatColors };
    conditions: { light: ThemeConditionAccents; dark: ThemeConditionAccents };
    brand: ThemeBrand;
  };
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  radii: ThemeRadii;
}

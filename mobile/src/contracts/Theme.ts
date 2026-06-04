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
 */

export interface ThemeColors {
  // Backgrounds
  bgPrimary: string;
  bgSecondary: string;

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

export interface ThemeSpacing {
  xs: number;
  sm: number;
  md: number;
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
 */
export interface Theme {
  colors: {
    light: ThemeColors;
    dark: ThemeColors;
  };
  typography: ThemeTypography;
  spacing: ThemeSpacing;
  radii: ThemeRadii;
}

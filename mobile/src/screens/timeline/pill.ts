/**
 * Verdict-pill construction — shared by DomainCard (dashboard) and
 * TimelineCardView (detail / legacy timeline) so every pill in the app
 * renders identically. Translated from the mockup's pill classes
 * (docs/design/denali-redesign-mockups.html):
 *
 *   .pill-ok    → teal-wash bg, teal-deep text (contrast-safe teal TEXT)
 *   .pill-soft  → neutral wash, ink-2 text
 *   .pill-watch → amber-wash bg, amber text
 *   severe      → alarm-wash bg, alarm text (intentional addition; the
 *                 mockup defines no alarm state — see redesign tokens)
 *
 * Band → tint mapping is keyed on the stable BandId, never on display
 * strings, so string-table edits can't change severity styling.
 */

import type { TextStyle, ViewStyle } from "react-native";

import { fontStyle } from "@/theme/fonts";
import type { useTheme } from "@/theme/useTheme";

import type { BandId, TintClass } from "./interpretation/tableV1";

type Redesign = ReturnType<typeof useTheme>["redesign"];
type Theme = ReturnType<typeof useTheme>["theme"];

export interface PillTint {
  bg: string;
  fg: string;
}

/** Resolve a curated tint class to its pill colors. */
export function tintByClass(redesign: Redesign, cls: TintClass): PillTint {
  switch (cls) {
    case "ok":
      return { bg: redesign.tealWash, fg: redesign.tealDeep };
    case "soft":
      return { bg: redesign.pillSoft, fg: redesign.ink2 };
    case "watch":
      return { bg: redesign.amberWash, fg: redesign.amber };
    case "alarm":
      return { bg: redesign.alarmWash, fg: redesign.alarm };
  }
}

/**
 * Default bandId → tint class. The trend chart shares this so band
 * shading and pill colors can never disagree.
 */
export function tintClassForBand(band: {
  bandId: BandId;
  tint?: TintClass;
}): TintClass {
  // Curated per-band override (v1.3, table-owned) wins.
  if (band.tint) return band.tint;
  switch (band.bandId) {
    // ok — screen-negative / lowest-severity / in-range bands.
    case "negative":
    case "minimal":
    case "lower-risk":
    case "healthy-weight":
    case "bone-normal":
      return "ok";
    // soft — within-normal bands.
    case "lower-normal":
    case "higher-normal":
      return "soft";
    // watch — calm attention. WHO biomarker out-of-range bands stay "watch"
    // (calm), not "alarm" — clinical surfaces stay calm; the reviewer may
    // escalate via the table's per-band `tint` override before sign-off.
    case "mild":
    case "moderate":
    case "higher-risk":
    case "underweight":
    case "overweight":
    case "obesity":
    case "bone-low":
    case "osteoporosis":
      return "watch";
    // alarm — severe screener bands (alarm tokens' only UI consumer
    // besides the crisis path).
    case "moderately-severe":
    case "severe":
    case "likely-aud":
    case "positive":
      return "alarm";
  }
}

/**
 * Tint for a band: curated `tint` override wins; otherwise the default
 * bandId→class mapping applies.
 */
export function pillTintForBand(
  redesign: Redesign,
  band: { bandId: BandId; tint?: TintClass },
): PillTint {
  return tintByClass(redesign, tintClassForBand(band));
}

export function pillTintFor(redesign: Redesign, bandId: BandId): PillTint {
  return tintByClass(redesign, tintClassForBand({ bandId }));
}

/**
 * Pill layout fragments (mockup .pill: body 600 12.5px, 5px/11px padding,
 * fully rounded). Background/text colors come from pillTintFor at the
 * call site.
 */
export function makePillStyles(
  theme: Theme,
  fontsLoaded: boolean,
): { pill: ViewStyle; pillText: TextStyle } {
  return {
    pill: {
      paddingHorizontal: theme.spacing.space3 - 1,
      paddingVertical: theme.spacing.xs + 1,
      borderRadius: theme.radii.full,
      flexShrink: 0,
    },
    pillText: {
      fontSize: 12.5,
      letterSpacing: 0.13,
      ...fontStyle("body", 600, fontsLoaded),
    },
  };
}

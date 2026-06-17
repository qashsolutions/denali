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

import { tintClassForBand } from "./bandTint";
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

// The pure bandId → tint class mapping lives in bandTint.ts (RN-free so node
// consumers can use it). Re-exported (import below) so existing `from "./pill"`
// callers (TrendChart, etc.) are unchanged.
export { tintClassForBand };

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

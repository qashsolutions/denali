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

import type { BandId } from "./interpretation/tableV1";

type Redesign = ReturnType<typeof useTheme>["redesign"];
type Theme = ReturnType<typeof useTheme>["theme"];

export interface PillTint {
  bg: string;
  fg: string;
}

export function pillTintFor(redesign: Redesign, bandId: BandId): PillTint {
  switch (bandId) {
    // ok — screen-negative / lowest-severity bands.
    case "negative":
    case "minimal":
    case "lower-risk":
      return { bg: redesign.tealWash, fg: redesign.tealDeep };
    // soft — within-normal bands.
    case "lower-normal":
    case "higher-normal":
      return { bg: redesign.pillSoft, fg: redesign.ink2 };
    // watch — calm attention.
    case "mild":
    case "moderate":
    case "higher-risk":
      return { bg: redesign.amberWash, fg: redesign.amber };
    // alarm — severe screener bands (alarm tokens' only UI consumer
    // besides the crisis path).
    case "moderately-severe":
    case "severe":
    case "likely-aud":
    case "positive":
      return { bg: redesign.alarmWash, fg: redesign.alarm };
  }
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

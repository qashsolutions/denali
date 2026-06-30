/**
 * Motion tokens — the single source for durations + easing so micro-interactions
 * stay consistent and CALM (tasteful polish, not spectacle). Appearance-
 * independent; imported directly by motion components (not part of the frozen
 * Theme contract). Durations are deliberately short — a 45+ clinical app wants
 * motion that confirms, never motion that performs.
 */

import { Easing, type EasingFunction } from "react-native";

export const motion = {
  /** Milliseconds. */
  duration: {
    fast: 140, // press feedback
    base: 220, // entrances, fades
    slow: 320, // larger transitions
  },
  easing: {
    /** Decelerate-out — the default for entrances + most UI motion. */
    standard: Easing.out(Easing.cubic) as EasingFunction,
    /** Accelerate-in — for exits. */
    exit: Easing.in(Easing.cubic) as EasingFunction,
  },
} as const;

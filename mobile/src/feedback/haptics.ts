/**
 * Haptics — a thin, centralized, DEFENSIVE wrapper over expo-haptics. Every call
 * is fire-and-forget and fully guarded: if the native module is absent (e.g. a
 * JS reload before a native rebuild) or a call throws, it no-ops rather than
 * crashing. Centralized so a single Settings toggle can mute all of it later.
 *
 * Taste rule: haptics CONFIRM neutral actions (selection, success). We do NOT
 * buzz on the crisis / 988 path or severe-result reveals — that surface stays
 * calm and serious by design.
 */

import * as Haptics from "expo-haptics";

let enabled = true;

/** Mute/unmute all haptics (e.g. from a Settings toggle). */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

export function isHapticsEnabled(): boolean {
  return enabled;
}

function safe(run: () => Promise<unknown>): void {
  if (!enabled) return;
  try {
    void run().catch(() => {});
  } catch {
    // Native module missing (pre-rebuild) — degrade silently.
  }
}

/** Light tick for discrete selections (picking an option, toggling). */
export function hapticSelection(): void {
  safe(() => Haptics.selectionAsync());
}

/** Success notification — completed check-in, restore, save. */
export function hapticSuccess(): void {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}

/** Warning notification — a recoverable error (failed save, invalid input). */
export function hapticWarning(): void {
  safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
}

/** Light impact — primary button confirmation. */
export function hapticTap(): void {
  safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

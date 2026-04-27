/**
 * Birth-year modal cadence rules
 *
 * Pure function — no side effects, no network calls. Determines
 * whether the ProfileCompletionModal should be eligible to show
 * right now based on the authState's cadence fields.
 *
 * The modal is eligible when ALL of the following are true:
 *   1. User is authenticated (userId present, not loading)
 *   2. Birth year has not been provided (birthYear === null)
 *   3. Reminder is not permanently disabled (birthYearModalDisabled !== true)
 *   4. Either:
 *        - never dismissed (birthYearModalDismissedAt === null), OR
 *        - last dismissed >= 7 days ago
 *
 * Eligibility ≠ visibility. The layout adds a session-only
 * completionDismissed flag as a fast-path for immediate close
 * after any button click while the server write is in flight.
 */

import type { AuthState } from "@/hooks/useAuth";

const COOLDOWN_DAYS = 7;
const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;

export function canShowBirthYearModal(authState: AuthState): boolean {
  if (authState.isLoading) return false;
  if (!authState.userId) return false;
  if (authState.birthYear !== null) return false;
  if (authState.birthYearModalDisabled) return false;

  if (authState.birthYearModalDismissedAt === null) return true;

  const dismissedAt = Date.parse(authState.birthYearModalDismissedAt);
  if (Number.isNaN(dismissedAt)) return true; // Malformed → fail open (show modal)

  return Date.now() - dismissedAt >= COOLDOWN_MS;
}

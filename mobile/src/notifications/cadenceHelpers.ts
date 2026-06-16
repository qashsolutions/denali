/**
 * cadenceHelpers — pure, testable cadence and quiet-hours logic.
 *
 * No Date.now() inside — callers pass `now` as an explicit argument so
 * these are deterministic under vitest (stale-closure rule: pure helpers
 * with live state as explicit args, mobile/CLAUDE.md).
 *
 * No react-native / expo imports — node-safe for vitest.
 *
 * Privacy: zero PHI in any computed output. Notification copy is generic
 * behavioral nudging only. Invariant 1 is unaffected — nothing here
 * touches a network call or server.
 */

// ─── Quiet-hours window ───────────────────────────────────────────────────

/**
 * Earliest hour (inclusive, 0-23 local) when a reminder may fire.
 * Default 9 am. Notifications before this hour are clamped forward.
 */
export const QUIET_HOURS_START = 9;

/**
 * Latest hour (exclusive, 0-23 local) when a reminder may fire.
 * Default 8 pm. Notifications AT or after this hour are clamped to the
 * next day at QUIET_HOURS_START.
 */
export const QUIET_HOURS_END = 20;

/**
 * Preferred fire hour (within the quiet window, 0-23 local).
 * Reminders aim for mid-morning — gentle enough not to interrupt lunch,
 * clearly daytime so it reads as a proactive nudge.
 */
export const PREFERRED_HOUR = 10;

// ─── Cadence constants ────────────────────────────────────────────────────

/** Minimum days since last log-in before a "you haven't logged lately" nudge fires. */
export const NUDGE_AFTER_DAYS_IDLE = 3;

/** Days between periodic monthly check-in nudges (fires roughly monthly). */
export const MONTHLY_CHECKIN_DAYS = 30;

// ─── Types ────────────────────────────────────────────────────────────────

export interface NudgeSchedule {
  /** ISO8601 of the nearest upcoming local-calendar trigger date. */
  idleNudgeAt: Date | null;
  /** ISO8601 of the monthly check-in trigger date. */
  monthlyCheckinAt: Date;
}

// ─── Pure helpers ─────────────────────────────────────────────────────────

/**
 * Clamp a candidate Date into the quiet-hours window.
 *
 * Rules:
 *   - If the candidate's hour is already inside [QUIET_HOURS_START,
 *     QUIET_HOURS_END), leave the Date unchanged.
 *   - If the candidate is before QUIET_HOURS_START (too early), advance
 *     to QUIET_HOURS_START on the same calendar day.
 *   - If the candidate is at or after QUIET_HOURS_END (too late), advance
 *     to QUIET_HOURS_START on the NEXT calendar day.
 *
 * The returned Date preserves the minute/second of the candidate when
 * already inside the window; otherwise it sets minute=0, second=0 at
 * the clamped hour.
 *
 * @param candidate - The un-clamped fire time.
 * @returns A new Date (never mutates candidate).
 */
export function clampToQuietHours(candidate: Date): Date {
  const hour = candidate.getHours();

  if (hour >= QUIET_HOURS_START && hour < QUIET_HOURS_END) {
    // Already inside the window — return as-is.
    return new Date(candidate.getTime());
  }

  const result = new Date(candidate.getTime());

  if (hour < QUIET_HOURS_START) {
    // Too early — clamp forward to QUIET_HOURS_START same day.
    result.setHours(QUIET_HOURS_START, 0, 0, 0);
  } else {
    // At or after QUIET_HOURS_END — push to next day QUIET_HOURS_START.
    result.setDate(result.getDate() + 1);
    result.setHours(QUIET_HOURS_START, 0, 0, 0);
  }

  return result;
}

/**
 * Build the date for the next occurrence of PREFERRED_HOUR on a given
 * calendar day (or the next day if we're already past PREFERRED_HOUR
 * today). Used as a convenience helper inside computeNudgeSchedule.
 *
 * @param now - Current moment.
 * @param daysFromNow - How many days from `now` to target. 0 = today.
 * @returns A Date set to PREFERRED_HOUR:00:00 on the target day, clamped.
 */
export function preferredTimeOnDay(now: Date, daysFromNow: number): Date {
  const target = new Date(now.getTime());
  target.setDate(target.getDate() + daysFromNow);
  target.setHours(PREFERRED_HOUR, 0, 0, 0);
  return clampToQuietHours(target);
}

/**
 * Compute when an idle nudge should fire, given the last log date.
 *
 * Returns null when the user logged recently (within NUDGE_AFTER_DAYS_IDLE
 * days) — no nudge needed yet.
 *
 * When `lastLogAt` is null (never logged), treat as "never" and schedule
 * the nudge for NUDGE_AFTER_DAYS_IDLE days from now so new users aren't
 * immediately flooded.
 *
 * @param now - Current moment.
 * @param lastLogAt - ISO8601 string of the most recent observation
 *   effective_at, or null if no observations exist yet.
 * @returns A clamped Date for when the idle nudge should fire, or null.
 */
export function computeIdleNudgeDate(
  now: Date,
  lastLogAt: string | null,
): Date | null {
  if (lastLogAt == null) {
    // No log at all — schedule a gentle "get started" nudge in N days.
    return preferredTimeOnDay(now, NUDGE_AFTER_DAYS_IDLE);
  }

  const lastLog = new Date(lastLogAt);
  const daysSince =
    (now.getTime() - lastLog.getTime()) / (1000 * 60 * 60 * 24);

  if (daysSince < NUDGE_AFTER_DAYS_IDLE) {
    // Recent activity — no nudge.
    return null;
  }

  // User is idle: fire ASAP (today at preferred hour, clamped).
  return preferredTimeOnDay(now, 0);
}

/**
 * Compute when the next monthly check-in nudge should fire.
 *
 * Fires MONTHLY_CHECKIN_DAYS from now, at PREFERRED_HOUR local time,
 * clamped to quiet hours.
 *
 * @param now - Current moment.
 * @returns A clamped Date for the monthly check-in notification.
 */
export function computeMonthlyCheckinDate(now: Date): Date {
  return preferredTimeOnDay(now, MONTHLY_CHECKIN_DAYS);
}

/**
 * Main cadence entry point. Returns both trigger dates.
 *
 * @param now - Current moment (explicit, no Date.now() inside).
 * @param lastLogAt - ISO8601 of the latest observation effective_at, or null.
 * @returns NudgeSchedule with both trigger dates.
 */
export function computeNudgeSchedule(
  now: Date,
  lastLogAt: string | null,
): NudgeSchedule {
  return {
    idleNudgeAt: computeIdleNudgeDate(now, lastLogAt),
    monthlyCheckinAt: computeMonthlyCheckinDate(now),
  };
}

// ─── Notification copy (generic, no PHI) ─────────────────────────────────

/**
 * Notification identifier constants. Used by the scheduler to cancel
 * specific notifications by ID (expo-notifications requires a stable
 * string ID per `scheduleNotificationAsync` call to support
 * `cancelScheduledNotificationAsync`).
 */
export const NOTIFICATION_ID_IDLE = "denali.reminder.idle";
export const NOTIFICATION_ID_MONTHLY = "denali.reminder.monthly";

/**
 * Idle nudge copy — generic behavioral nudge, zero PHI, zero clinical
 * content. Safe to surface on lock screen + OS notification history.
 */
export const IDLE_NUDGE_TITLE = "Check in with Denali";
export const IDLE_NUDGE_BODY =
  "It's been a while. Open Denali to log how you're doing.";

/**
 * Monthly check-in copy — same PHI / clinical safety requirements.
 */
export const MONTHLY_CHECKIN_TITLE = "Monthly check-in";
export const MONTHLY_CHECKIN_BODY =
  "Time for a monthly check-in. Open Denali to review your progress.";

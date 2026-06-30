/**
 * cadenceHelpers — unit tests for all pure helpers.
 *
 * No react-native / expo imports — these run in vitest node env.
 * Live state passed as explicit args; no Date.now() inside the helpers.
 */

import { describe, expect, it } from "vitest";

import {
  clampToQuietHours,
  computeIdleNudgeDate,
  computeMonthlyCheckinDate,
  computeNudgeSchedule,
  IDLE_NUDGE_BODY,
  IDLE_NUDGE_TITLE,
  MONTHLY_CHECKIN_BODY,
  MONTHLY_CHECKIN_TITLE,
  MONTHLY_CHECKIN_DAYS,
  NUDGE_AFTER_DAYS_IDLE,
  PREFERRED_HOUR,
  preferredTimeOnDay,
  QUIET_HOURS_END,
  QUIET_HOURS_START,
} from "../cadenceHelpers";

// ─── clampToQuietHours ────────────────────────────────────────────────────

describe("clampToQuietHours", () => {
  it("returns the same time when already inside the window", () => {
    // 10:30 am is inside [9, 20)
    const candidate = new Date(2026, 5, 15, 10, 30, 0); // June 15 10:30
    const result = clampToQuietHours(candidate);
    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(30);
    expect(result.getDate()).toBe(15);
  });

  it("clamps midnight (0:00) forward to QUIET_HOURS_START same day", () => {
    const candidate = new Date(2026, 5, 15, 0, 0, 0);
    const result = clampToQuietHours(candidate);
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(QUIET_HOURS_START);
    expect(result.getMinutes()).toBe(0);
  });

  it("clamps 8:59 am forward to QUIET_HOURS_START same day", () => {
    const candidate = new Date(2026, 5, 15, 8, 59, 0);
    const result = clampToQuietHours(candidate);
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(QUIET_HOURS_START);
  });

  it("clamps QUIET_HOURS_END exactly to next day QUIET_HOURS_START", () => {
    // 20:00 is >= QUIET_HOURS_END (20) so must push to next day
    const candidate = new Date(2026, 5, 15, QUIET_HOURS_END, 0, 0);
    const result = clampToQuietHours(candidate);
    expect(result.getDate()).toBe(16);
    expect(result.getHours()).toBe(QUIET_HOURS_START);
    expect(result.getMinutes()).toBe(0);
  });

  it("clamps 23:59 to next day QUIET_HOURS_START", () => {
    const candidate = new Date(2026, 5, 15, 23, 59, 0);
    const result = clampToQuietHours(candidate);
    expect(result.getDate()).toBe(16);
    expect(result.getHours()).toBe(QUIET_HOURS_START);
  });

  it("does not mutate the input candidate", () => {
    const candidate = new Date(2026, 5, 15, 22, 0, 0);
    const originalTime = candidate.getTime();
    clampToQuietHours(candidate);
    expect(candidate.getTime()).toBe(originalTime);
  });

  it("window boundary: QUIET_HOURS_START itself is inside the window", () => {
    const candidate = new Date(2026, 5, 15, QUIET_HOURS_START, 0, 0);
    const result = clampToQuietHours(candidate);
    expect(result.getHours()).toBe(QUIET_HOURS_START);
    expect(result.getDate()).toBe(15);
  });

  it("window boundary: one minute before QUIET_HOURS_END is inside the window", () => {
    const candidate = new Date(2026, 5, 15, QUIET_HOURS_END - 1, 59, 0);
    const result = clampToQuietHours(candidate);
    expect(result.getHours()).toBe(QUIET_HOURS_END - 1);
    expect(result.getDate()).toBe(15);
  });
});

// ─── preferredTimeOnDay ───────────────────────────────────────────────────

describe("preferredTimeOnDay", () => {
  it("returns PREFERRED_HOUR on today when daysFromNow=0 and now is before it", () => {
    const now = new Date(2026, 5, 15, 7, 0, 0); // 7am — before preferred 10am
    const result = preferredTimeOnDay(now, 0);
    // 10am is inside window, no further clamping needed
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(PREFERRED_HOUR);
  });

  it("adds daysFromNow to the date", () => {
    const now = new Date(2026, 5, 15, 9, 0, 0);
    const result = preferredTimeOnDay(now, 5);
    expect(result.getDate()).toBe(20);
    expect(result.getHours()).toBe(PREFERRED_HOUR);
  });

  it("rolls over month boundary correctly", () => {
    // June 30 + 3 days = July 3
    const now = new Date(2026, 5, 30, 9, 0, 0);
    const result = preferredTimeOnDay(now, 3);
    expect(result.getMonth()).toBe(6); // July (0-indexed)
    expect(result.getDate()).toBe(3);
  });

  it("PREFERRED_HOUR is inside quiet window so clamp leaves it unchanged", () => {
    // Sanity: PREFERRED_HOUR must be inside [QUIET_HOURS_START, QUIET_HOURS_END)
    expect(PREFERRED_HOUR).toBeGreaterThanOrEqual(QUIET_HOURS_START);
    expect(PREFERRED_HOUR).toBeLessThan(QUIET_HOURS_END);

    const now = new Date(2026, 5, 15, 8, 0, 0);
    const result = preferredTimeOnDay(now, 0);
    expect(result.getHours()).toBe(PREFERRED_HOUR);
  });
});

// ─── computeIdleNudgeDate ─────────────────────────────────────────────────

describe("computeIdleNudgeDate", () => {
  it("returns null when user logged within NUDGE_AFTER_DAYS_IDLE", () => {
    const now = new Date(2026, 5, 15, 10, 0, 0);
    const recentLog = new Date(now.getTime());
    recentLog.setDate(recentLog.getDate() - (NUDGE_AFTER_DAYS_IDLE - 1));
    const result = computeIdleNudgeDate(now, recentLog.toISOString());
    expect(result).toBeNull();
  });

  it("returns null when user logged exactly NUDGE_AFTER_DAYS_IDLE - 0.1 days ago", () => {
    const now = new Date(2026, 5, 15, 10, 0, 0);
    const almostThreshold =
      now.getTime() - (NUDGE_AFTER_DAYS_IDLE - 0.1) * 24 * 60 * 60 * 1000;
    const result = computeIdleNudgeDate(now, new Date(almostThreshold).toISOString());
    expect(result).toBeNull();
  });

  it("returns a date when user is idle for exactly NUDGE_AFTER_DAYS_IDLE days", () => {
    const now = new Date(2026, 5, 15, 10, 0, 0);
    const idleLog = new Date(now.getTime());
    idleLog.setDate(idleLog.getDate() - NUDGE_AFTER_DAYS_IDLE);
    const result = computeIdleNudgeDate(now, idleLog.toISOString());
    expect(result).not.toBeNull();
  });

  it("returns a date when user has never logged (null lastLogAt)", () => {
    const now = new Date(2026, 5, 15, 10, 0, 0);
    const result = computeIdleNudgeDate(now, null);
    expect(result).not.toBeNull();
    if (result != null) {
      // Should be NUDGE_AFTER_DAYS_IDLE days from now
      const expectedDate = now.getDate() + NUDGE_AFTER_DAYS_IDLE;
      expect(result.getDate()).toBe(expectedDate);
    }
  });

  it("when idle, fires at preferred hour clamped into quiet window", () => {
    const now = new Date(2026, 5, 15, 10, 0, 0);
    const oldLog = new Date(2026, 5, 1, 10, 0, 0).toISOString(); // 14 days ago
    const result = computeIdleNudgeDate(now, oldLog);
    expect(result).not.toBeNull();
    if (result != null) {
      expect(result.getHours()).toBeGreaterThanOrEqual(QUIET_HOURS_START);
      expect(result.getHours()).toBeLessThan(QUIET_HOURS_END);
    }
  });

  it("when null lastLogAt, schedules NUDGE_AFTER_DAYS_IDLE days out (not immediate)", () => {
    const now = new Date(2026, 5, 15, 10, 0, 0);
    const result = computeIdleNudgeDate(now, null);
    expect(result).not.toBeNull();
    if (result != null) {
      const msFromNow = result.getTime() - now.getTime();
      const daysFromNow = msFromNow / (1000 * 60 * 60 * 24);
      // Should be at least NUDGE_AFTER_DAYS_IDLE - 1 days away (clamping can
      // shift by up to a few hours)
      expect(daysFromNow).toBeGreaterThanOrEqual(NUDGE_AFTER_DAYS_IDLE - 1);
    }
  });
});

// ─── computeMonthlyCheckinDate ────────────────────────────────────────────

describe("computeMonthlyCheckinDate", () => {
  it("returns a date MONTHLY_CHECKIN_DAYS from now at preferred hour", () => {
    const now = new Date(2026, 5, 15, 10, 0, 0);
    const result = computeMonthlyCheckinDate(now);
    const expectedDate = new Date(now.getTime());
    expectedDate.setDate(expectedDate.getDate() + MONTHLY_CHECKIN_DAYS);
    expect(result.getDate()).toBe(expectedDate.getDate());
    expect(result.getMonth()).toBe(expectedDate.getMonth());
  });

  it("fires inside quiet-hours window", () => {
    const now = new Date(2026, 5, 15, 10, 0, 0);
    const result = computeMonthlyCheckinDate(now);
    expect(result.getHours()).toBeGreaterThanOrEqual(QUIET_HOURS_START);
    expect(result.getHours()).toBeLessThan(QUIET_HOURS_END);
  });
});

// ─── computeNudgeSchedule ────────────────────────────────────────────────

describe("computeNudgeSchedule", () => {
  it("returns both fields", () => {
    const now = new Date(2026, 5, 15, 10, 0, 0);
    const schedule = computeNudgeSchedule(now, null);
    expect(schedule).toHaveProperty("idleNudgeAt");
    expect(schedule).toHaveProperty("monthlyCheckinAt");
  });

  it("idleNudgeAt is null when user logged recently", () => {
    const now = new Date(2026, 5, 15, 10, 0, 0);
    const recentLog = new Date(now.getTime());
    recentLog.setDate(recentLog.getDate() - 1); // yesterday
    const schedule = computeNudgeSchedule(now, recentLog.toISOString());
    expect(schedule.idleNudgeAt).toBeNull();
    // Monthly checkin is always non-null
    expect(schedule.monthlyCheckinAt).toBeInstanceOf(Date);
  });

  it("idleNudgeAt is non-null when user is idle", () => {
    const now = new Date(2026, 5, 15, 10, 0, 0);
    const oldLog = new Date(2026, 4, 1, 10, 0, 0).toISOString(); // >30 days ago
    const schedule = computeNudgeSchedule(now, oldLog);
    expect(schedule.idleNudgeAt).toBeInstanceOf(Date);
    expect(schedule.monthlyCheckinAt).toBeInstanceOf(Date);
  });

  it("both trigger dates are in the future relative to now", () => {
    const now = new Date(2026, 5, 15, 10, 0, 0);
    const schedule = computeNudgeSchedule(now, null);
    // Monthly is always future
    expect(schedule.monthlyCheckinAt.getTime()).toBeGreaterThan(now.getTime());
    // Idle (null lastLog) is also future
    if (schedule.idleNudgeAt != null) {
      expect(schedule.idleNudgeAt.getTime()).toBeGreaterThanOrEqual(now.getTime());
    }
  });
});

// ─── Notification copy (PHI-safety contract) ─────────────────────────────

describe("notification copy — PHI safety contract", () => {
  const PHI_PATTERN =
    /a1c|glucose|hba1c|blood|weight|bmi|pressure|cholesterol|creatinine|lab|result|score|diagnosis|condition|mg\/dl|mmol/i;

  it("IDLE_NUDGE_TITLE contains no PHI or clinical content", () => {
    expect(PHI_PATTERN.test(IDLE_NUDGE_TITLE)).toBe(false);
  });

  it("IDLE_NUDGE_BODY contains no PHI or clinical content", () => {
    expect(PHI_PATTERN.test(IDLE_NUDGE_BODY)).toBe(false);
  });

  it("MONTHLY_CHECKIN_TITLE contains no PHI or clinical content", () => {
    expect(PHI_PATTERN.test(MONTHLY_CHECKIN_TITLE)).toBe(false);
  });

  it("MONTHLY_CHECKIN_BODY contains no PHI or clinical content", () => {
    expect(PHI_PATTERN.test(MONTHLY_CHECKIN_BODY)).toBe(false);
  });

  // No template interpolation in any copy constant — they must stay static so
  // user state (name, score, value) can never be spliced into a lock-screen
  // notification later. Guards invariant 1 against future interpolation creep.
  it("copy constants are static — no ${...} interpolation markers", () => {
    for (const s of [
      IDLE_NUDGE_TITLE,
      IDLE_NUDGE_BODY,
      MONTHLY_CHECKIN_TITLE,
      MONTHLY_CHECKIN_BODY,
    ]) {
      expect(s).not.toContain("${");
    }
  });
});

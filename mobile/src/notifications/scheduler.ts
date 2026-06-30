/**
 * scheduler — local notification scheduling for the Reminders feature.
 *
 * PRIVACY CONTRACT (Invariant 1 — Local-first):
 *   - Uses expo-notifications `scheduleNotificationAsync` with DATE triggers
 *     only (calendar-type, device-local). No push tokens, no network calls,
 *     no `getExpoPushTokenAsync`, no Expo push service, no server involvement.
 *   - Notification title and body are pulled from cadenceHelpers constants —
 *     generic behavioral nudging, zero PHI, zero clinical content.
 *   - The opt-in preference is persisted in expo-secure-store (device-local).
 *     Nothing leaves the device.
 *
 * API consumed:
 *   - expo-notifications: scheduleNotificationAsync, cancelScheduledNotificationAsync,
 *     cancelAllScheduledNotificationsAsync, requestPermissionsAsync,
 *     getPermissionsAsync, setNotificationChannelAsync (Android).
 *   - expo-secure-store: for the opt-in preference (same mechanism as ThemeMode).
 *   - LocalDataDAL (contract): listObservations to read last log date for
 *     cadence computation. DAL access is passed as a function argument so
 *     this module stays testable.
 *
 * Scheduling policy:
 *   - Up to 2 scheduled notifications at any time:
 *       1. Idle nudge (fire date from computeIdleNudgeDate) — cancelled when
 *          user has logged recently.
 *       2. Monthly check-in (30 days from now).
 *   - On every "reschedule" call: cancel both IDs, then re-schedule whichever
 *     are applicable. This is idempotent.
 *   - On opt-out / permission denied: cancel ALL scheduled notifications.
 */

import * as Notifications from "expo-notifications";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

import type { LocalDataDAL } from "@/contracts";

import {
  computeNudgeSchedule,
  IDLE_NUDGE_BODY,
  IDLE_NUDGE_TITLE,
  MONTHLY_CHECKIN_BODY,
  MONTHLY_CHECKIN_TITLE,
  NOTIFICATION_ID_IDLE,
  NOTIFICATION_ID_MONTHLY,
} from "./cadenceHelpers";

// ─── Persistence ──────────────────────────────────────────────────────────

/** SecureStore key for the opt-in flag. */
const REMINDERS_OPT_IN_KEY = "denali.reminders.optIn.v1";

/** Read the persisted opt-in preference. Returns false when not yet set. */
export async function getRemindersOptIn(): Promise<boolean> {
  try {
    const stored = await SecureStore.getItemAsync(REMINDERS_OPT_IN_KEY);
    return stored === "true";
  } catch (err) {
    console.warn("[Reminders] getRemindersOptIn failed", err);
    return false;
  }
}

/** Persist the opt-in preference. Fire-and-forget; never throws to callers. */
export async function setRemindersOptIn(value: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(REMINDERS_OPT_IN_KEY, value ? "true" : "false");
  } catch (err) {
    console.warn("[Reminders] setRemindersOptIn failed", err);
  }
}

// ─── Android channel (one-time setup) ────────────────────────────────────

/**
 * Ensure the Android notification channel exists. Safe to call multiple
 * times — expo-notifications upserts. No-op on iOS.
 */
export async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync("reminders", {
    name: "Reminders",
    importance: Notifications.AndroidImportance.DEFAULT,
    // Omit `sound` → the channel uses the system default notification sound.
    // A string here is read as a custom res/raw filename ("default" → not found).
    showBadge: false,
  });
}

// ─── Permission helpers ───────────────────────────────────────────────────

/** Check whether the OS has granted notification permissions. */
export async function hasNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === "granted";
}

/**
 * Request notification permissions if not already granted.
 * Returns true if granted after the request; false if denied.
 * Does NOT throw — callers check the return value.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch (err) {
    console.warn("[Reminders] requestPermissionsAsync failed", err);
    return false;
  }
}

// ─── Scheduling ───────────────────────────────────────────────────────────

/**
 * Cancel both Denali reminder notifications. Safe to call when none are
 * scheduled — expo-notifications silently ignores unknown IDs.
 */
export async function cancelAllReminders(): Promise<void> {
  try {
    await Promise.all([
      Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID_IDLE),
      Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID_MONTHLY),
    ]);
  } catch (err) {
    console.warn("[Reminders] cancelAllReminders failed", err);
  }
}

/**
 * Read the most recent observation `effective_at` from the DAL.
 * Returns null when no observations exist. This is the cadence input.
 *
 * @param dal - The live DAL instance.
 */
async function readLastLogDate(dal: LocalDataDAL): Promise<string | null> {
  try {
    const rows = await dal.listObservations({ latest_only: true, limit: 1 });
    return rows[0]?.effective_at ?? null;
  } catch (err) {
    console.warn("[Reminders] readLastLogDate failed", err);
    return null;
  }
}

/**
 * Schedule (or reschedule) both reminders based on the user's logging
 * history. Cancels any existing Denali reminders first (idempotent).
 *
 * DOES NOT check opt-in or permissions — callers are responsible for
 * verifying both before calling. See `toggleReminders` for the full flow.
 *
 * @param dal - The live DAL instance (read-only access).
 */
export async function scheduleReminders(dal: LocalDataDAL): Promise<void> {
  // Cancel stale schedules before re-computing.
  await cancelAllReminders();
  await ensureAndroidChannel();

  const now = new Date();
  const lastLogAt = await readLastLogDate(dal);
  const { idleNudgeAt, monthlyCheckinAt } = computeNudgeSchedule(now, lastLogAt);

  const schedulePromises: Promise<void>[] = [];

  if (idleNudgeAt != null) {
    schedulePromises.push(
      Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_ID_IDLE,
        content: {
          title: IDLE_NUDGE_TITLE,
          body: IDLE_NUDGE_BODY,
          // `true` = system default sound (iOS); Android defers to the channel.
          sound: true,
          // Explicitly no data payload that could carry PHI.
          data: {},
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: idleNudgeAt,
        },
      }).then(() => undefined),
    );
  }

  schedulePromises.push(
    Notifications.scheduleNotificationAsync({
      identifier: NOTIFICATION_ID_MONTHLY,
      content: {
        title: MONTHLY_CHECKIN_TITLE,
        body: MONTHLY_CHECKIN_BODY,
        // `true` = system default sound (iOS); Android defers to the channel.
        sound: true,
        data: {},
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: monthlyCheckinAt,
      },
    }).then(() => undefined),
  );

  await Promise.all(schedulePromises);
}

// ─── Toggle entry point ───────────────────────────────────────────────────

export type ToggleRemindersResult =
  | { ok: true; scheduled: boolean }
  | { ok: false; reason: "permission_denied" | "error" };

/**
 * Primary external API for the Reminders toggle in SettingsScreen.
 *
 * When `enabled = true`:
 *   1. Request OS permission (contextual — only when user explicitly opts in).
 *   2. If granted: persist opt-in = true, schedule reminders.
 *   3. If denied: persist opt-in = false, cancel any stale reminders.
 *      Returns { ok: false, reason: "permission_denied" } so the UI can
 *      show explanatory text and reflect the real permission state.
 *
 * When `enabled = false`:
 *   - Persist opt-in = false.
 *   - Cancel all scheduled reminders.
 *   - Returns { ok: true, scheduled: false }.
 *
 * @param enabled - Whether the user is toggling ON (true) or OFF (false).
 * @param dal - The live DAL instance (for cadence computation on enable).
 */
export async function toggleReminders(
  enabled: boolean,
  dal: LocalDataDAL,
): Promise<ToggleRemindersResult> {
  if (!enabled) {
    await Promise.all([
      setRemindersOptIn(false),
      cancelAllReminders(),
    ]);
    return { ok: true, scheduled: false };
  }

  // User is toggling ON — request permission contextually.
  const granted = await requestNotificationPermission();
  if (!granted) {
    // Permission denied: ensure opt-in is off and reminders are cleared.
    await Promise.all([
      setRemindersOptIn(false),
      cancelAllReminders(),
    ]);
    return { ok: false, reason: "permission_denied" };
  }

  // Permission granted — persist opt-in and schedule.
  await setRemindersOptIn(true);
  try {
    await scheduleReminders(dal);
    return { ok: true, scheduled: true };
  } catch (err) {
    console.warn("[Reminders] scheduleReminders failed", err);
    return { ok: false, reason: "error" };
  }
}

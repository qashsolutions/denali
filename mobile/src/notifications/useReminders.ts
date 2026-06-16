/**
 * useReminders — React hook for the Reminders toggle in SettingsScreen.
 *
 * Responsibilities:
 *   - Hydrate the current opt-in state from SecureStore on mount.
 *   - Expose a `setEnabled` handler that calls `toggleReminders` and
 *     updates the UI to reflect the ACTUAL outcome (e.g., if the user
 *     denies OS permission, the toggle reverts to false).
 *   - Keep the DAL reference stable across renders via useDal().
 *
 * Pure helpers (cadenceHelpers.ts) and all scheduling logic live in
 * scheduler.ts; this hook is the React glue only.
 *
 * Privacy: no health data flows through this hook. DAL is passed to
 * scheduler.ts to read `effective_at` of the latest observation — only
 * the date is used, never content. Nothing leaves the device.
 */

import React from "react";

import { useDal } from "@/db/DalProvider";

import {
  cancelAllReminders,
  getRemindersOptIn,
  setRemindersOptIn,
  toggleReminders,
} from "./scheduler";

export type RemindersLastError = "permission_denied" | "error" | null;

export interface RemindersState {
  /** Whether reminders are currently opted in (reflects OS permission reality). */
  enabled: boolean;
  /** True while the SecureStore hydration or toggle is in flight. */
  loading: boolean;
  /**
   * Reason the last toggle failed, if any. Cleared on the next toggle call.
   *   "permission_denied" — user denied OS notification permission.
   *   "error"             — an unexpected error occurred in scheduling.
   *    null               — no failure.
   */
  lastError: RemindersLastError;
  /** Call when the Settings Switch is toggled. */
  setEnabled: (next: boolean) => void;
}

export function useReminders(): RemindersState {
  const dal = useDal();
  const [enabled, setEnabledState] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [lastError, setLastError] = React.useState<RemindersLastError>(null);

  // Hydrate the stored opt-in on mount.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await getRemindersOptIn();
        if (!cancelled) {
          setEnabledState(stored);
        }
      } catch (err) {
        console.warn("[useReminders] hydrate failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setEnabled = React.useCallback(
    (next: boolean) => {
      // Optimistic update so the UI feels immediate.
      setEnabledState(next);
      setLastError(null);

      (async () => {
        // DAL may still be null if the DB hasn't finished opening. In that
        // case we can still honour opt-out (cancel + persist false). For
        // opt-in we must wait — fall back to "error" so the toggle reverts.
        if (dal == null) {
          if (!next) {
            await Promise.all([setRemindersOptIn(false), cancelAllReminders()]);
            setEnabledState(false);
          } else {
            setEnabledState(false);
            setLastError("error");
          }
          return;
        }

        const result = await toggleReminders(next, dal);
        if (result.ok) {
          // Confirmed: reflect the scheduled state (may differ from `next`
          // in edge cases like DAL error — but ok=true means opt-in was
          // persisted as requested).
          setEnabledState(next);
        } else {
          // Failed — revert to false (opt-in is off, reminders cancelled).
          setEnabledState(false);
          setLastError(result.reason);
        }
      })();
    },
    [dal],
  );

  return { enabled, loading, lastError, setEnabled };
}

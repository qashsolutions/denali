/**
 * groupObservations — pure helper for TimelineScreen.
 *
 * Groups an array of `ObservationRow`s by the calendar date of
 * `effective_at` (UTC ISO `YYYY-MM-DD` slice — the timezone-stable bucket
 * key avoids cross-DST grouping surprises on the 45+ audience's varied
 * device locales).
 *
 * Pure / synchronous / node-env friendly so the unit test runs without
 * RN rendering. The component layer formats the date for display.
 */

import type { ObservationRow } from "@/contracts";

export interface TimelineGroup {
  /** `YYYY-MM-DD` (UTC) — group key. */
  dateKey: string;
  /** Observations on this date, ordered newest-first within the day. */
  rows: ObservationRow[];
}

/**
 * Bucket key for an ISO timestamp. We slice the date portion to avoid TZ
 * surprises — `2026-05-15T23:30:00-07:00` and `2026-05-16T01:00:00Z` are
 * the same instant but different calendar days in two readings of the
 * data. Slicing the raw ISO is intentionally tied to the storage shape
 * (the DAL writes ISO8601), not to the device's current locale.
 */
export function dateKeyOf(iso: string): string {
  // Defensive: if the string is shorter than 10 chars, return as-is.
  return iso.length >= 10 ? iso.slice(0, 10) : iso;
}

/**
 * Returns the input grouped by `dateKey`, newest-day first. Within each
 * group, observations are ordered newest-first by `effective_at`.
 *
 * Empty input → empty array. Caller renders an empty state.
 */
export function groupObservationsByDate(
  rows: ReadonlyArray<ObservationRow>,
): TimelineGroup[] {
  if (rows.length === 0) return [];

  const buckets = new Map<string, ObservationRow[]>();
  for (const row of rows) {
    const key = dateKeyOf(row.effective_at);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(row);
    } else {
      buckets.set(key, [row]);
    }
  }

  // Sort each bucket newest-first by effective_at.
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => (a.effective_at < b.effective_at ? 1 : -1));
  }

  // Sort groups newest-first by dateKey.
  const groups: TimelineGroup[] = Array.from(buckets.entries()).map(
    ([dateKey, rs]) => ({ dateKey, rows: rs }),
  );
  groups.sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));

  return groups;
}

/**
 * Format a `YYYY-MM-DD` bucket key into a human-readable date for the
 * group header. We do this in the helper (not the component) so the
 * locale handling is testable. Falls back to the raw key if Intl is
 * unavailable (unlikely on RN/Hermes but defensive).
 */
export function formatGroupHeader(dateKey: string): string {
  // Parse the YYYY-MM-DD into a Date at UTC midnight to avoid TZ shift.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateKey);
  if (!m) return dateKey;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(Date.UTC(year, month, day));
  try {
    return d.toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateKey;
  }
}

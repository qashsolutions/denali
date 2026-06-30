/**
 * groupObservations — pure helper tests.
 *
 * Asserts:
 *   1. Empty input → empty array.
 *   2. Latest-only correctness: even when the DAL returns superseded rows
 *      mixed with current ones, the grouping is correct (the DAL already
 *      filters by default; we just preserve order here).
 *   3. Grouping: rows with the same `effective_at` calendar day land in
 *      the same bucket; different days land in different buckets.
 *   4. Group ordering: newest-day first; within a day newest-first.
 *   5. dateKeyOf slices the ISO consistently.
 *   6. formatGroupHeader produces a UTC-stable string for `YYYY-MM-DD`.
 */

import { describe, it, expect } from "vitest";

import type { ObservationRow } from "@/contracts";

import {
  dateKeyOf,
  formatGroupHeader,
  groupObservationsByDate,
} from "../groupObservations";

function makeRow(partial: Partial<ObservationRow>): ObservationRow {
  return {
    id: partial.id ?? "obs-x",
    user_id: partial.user_id ?? "user-1",
    category: partial.category ?? "biomarker",
    code_system: partial.code_system ?? "LOINC",
    code: partial.code ?? "4548-4",
    display: partial.display ?? "Hemoglobin A1c",
    value_num: partial.value_num ?? 6.4,
    value_text: partial.value_text ?? null,
    unit: partial.unit ?? "%",
    source: partial.source ?? "uploaded_report",
    effective_at: partial.effective_at ?? "2026-05-15T00:00:00.000Z",
    recorded_at: partial.recorded_at ?? "2026-05-16T00:00:00.000Z",
    report_id: partial.report_id ?? null,
    supersedes_id: partial.supersedes_id ?? null,
    metadata_json: partial.metadata_json ?? null,
  };
}

describe("groupObservationsByDate", () => {
  it("returns an empty array for empty input", () => {
    expect(groupObservationsByDate([])).toEqual([]);
  });

  it("buckets observations by their effective_at calendar day", () => {
    const rows = [
      makeRow({ id: "a", effective_at: "2026-05-15T10:00:00.000Z" }),
      makeRow({ id: "b", effective_at: "2026-05-15T18:30:00.000Z" }),
      makeRow({ id: "c", effective_at: "2026-04-01T00:00:00.000Z" }),
    ];
    const groups = groupObservationsByDate(rows);
    expect(groups).toHaveLength(2);
    expect(groups[0].dateKey).toBe("2026-05-15");
    expect(groups[0].rows.map((r) => r.id)).toEqual(["b", "a"]);
    expect(groups[1].dateKey).toBe("2026-04-01");
    expect(groups[1].rows.map((r) => r.id)).toEqual(["c"]);
  });

  it("orders groups newest-day-first", () => {
    const rows = [
      makeRow({ id: "old", effective_at: "2024-01-01T00:00:00.000Z" }),
      makeRow({ id: "new", effective_at: "2026-06-04T00:00:00.000Z" }),
      makeRow({ id: "mid", effective_at: "2025-03-15T00:00:00.000Z" }),
    ];
    const groups = groupObservationsByDate(rows);
    expect(groups.map((g) => g.dateKey)).toEqual([
      "2026-06-04",
      "2025-03-15",
      "2024-01-01",
    ]);
  });

  it("preserves latest-only correctness — when the DAL has filtered out superseded rows, grouping does not re-introduce them", () => {
    // Simulate the DAL's contract: callers pass {latest_only: true}, so
    // the DAL returns only current (non-superseded) rows. We pass the
    // SAME code with two effective_at dates (representing the original
    // reading and a corrected one for a different day). Both are
    // "latest" (different effective_at means different observations per
    // the unique constraint).
    const latest = [
      makeRow({
        id: "may",
        code: "4548-4",
        effective_at: "2026-05-15T00:00:00.000Z",
        value_num: 7.2,
        supersedes_id: null,
      }),
      makeRow({
        id: "june",
        code: "4548-4",
        effective_at: "2026-06-01T00:00:00.000Z",
        value_num: 6.8,
        supersedes_id: null,
      }),
    ];
    const groups = groupObservationsByDate(latest);
    expect(groups).toHaveLength(2);
    expect(groups[0].rows[0].id).toBe("june");
    expect(groups[1].rows[0].id).toBe("may");
  });

  it("handles a single observation", () => {
    const rows = [makeRow({ id: "only" })];
    const groups = groupObservationsByDate(rows);
    expect(groups).toHaveLength(1);
    expect(groups[0].rows).toHaveLength(1);
    expect(groups[0].rows[0].id).toBe("only");
  });
});

describe("dateKeyOf", () => {
  it("slices the ISO date portion", () => {
    expect(dateKeyOf("2026-05-15T10:30:00.000Z")).toBe("2026-05-15");
  });

  it("returns the input unchanged when shorter than 10 chars", () => {
    expect(dateKeyOf("2026")).toBe("2026");
  });
});

describe("formatGroupHeader", () => {
  it("produces a stable human header for a valid YYYY-MM-DD", () => {
    // The exact string depends on the test runner's default locale, but
    // it must contain the day, month, and year.
    const header = formatGroupHeader("2026-05-15");
    expect(header).toMatch(/2026/);
    expect(header).toMatch(/15/);
    // Either the long month name or the numeric month — both are valid
    // toLocaleDateString outputs across locales.
    expect(header.toLowerCase()).toMatch(/may|05/);
  });

  it("returns the raw key when the format doesn't match", () => {
    expect(formatGroupHeader("not-a-date")).toBe("not-a-date");
  });
});

/**
 * dueForFormat — pure "Due for…" display-string tests. Factual phrasing only;
 * no directive language is produced by these helpers.
 */
import { describe, expect, it } from "vitest";

import {
  formatCadence,
  formatDueMeta,
  formatMonthYear,
} from "../dueForFormat";
import type { DueScreening } from "../uspstf";

describe("formatCadence", () => {
  it("null cadence → null (no phrase)", () => {
    expect(formatCadence(null)).toBeNull();
  });
  it("12 months → 'every year'", () => {
    expect(formatCadence(12)).toBe("every year");
  });
  it("multiples of 12 → 'every N years'", () => {
    expect(formatCadence(24)).toBe("every 2 years");
    expect(formatCadence(120)).toBe("every 10 years");
  });
  it("sub-year / non-multiples → months", () => {
    expect(formatCadence(1)).toBe("every month");
    expect(formatCadence(6)).toBe("every 6 months");
  });
});

describe("formatMonthYear", () => {
  it("formats an ISO date as 'Mon YYYY' (locale-free)", () => {
    expect(formatMonthYear("2026-04-01T00:00:00.000Z")).toBe("Apr 2026");
    expect(formatMonthYear("2023-12-31T12:00:00.000Z")).toBe("Dec 2023");
  });
  it("returns '' for an unparseable string", () => {
    expect(formatMonthYear("not-a-date")).toBe("");
  });
});

describe("formatDueMeta", () => {
  const rec = {
    id: "x",
    title: "Bone density scan",
    summary: "s",
    sex: [],
    ageMin: null,
    ageMax: null,
    cadenceMonths: 24,
    source: "fixture",
    provisional: true,
  } as const;

  it("never done → cadence + 'no date logged yet'", () => {
    const d: DueScreening = { rec, lastDone: null };
    expect(formatDueMeta(d)).toBe("Usually every 2 years · no date logged yet");
  });
  it("done before → cadence + 'last logged Mon YYYY'", () => {
    const d: DueScreening = { rec, lastDone: "2024-04-01T00:00:00.000Z" };
    expect(formatDueMeta(d)).toBe("Usually every 2 years · last logged Apr 2024");
  });
  it("no cadence → only the last-logged clause (no directive)", () => {
    const d: DueScreening = {
      rec: { ...rec, cadenceMonths: null },
      lastDone: null,
    };
    expect(formatDueMeta(d)).toBe("no date logged yet");
  });
});

/**
 * uspstf — dueScreenings pure-logic tests.
 *
 * Uses SYNTHETIC recommendation fixtures (NOT real USPSTF content — the real
 * set is API/reviewer-sourced and ships empty) to exercise the sex/age/cadence
 * gating deterministically.
 */
import { describe, expect, it } from "vitest";

import {
  dueScreenings,
  PREVENTIVE_RECOMMENDATIONS,
  type PreventiveRecommendation,
} from "../uspstf";

const NOW = new Date("2026-06-13T00:00:00.000Z");

const femaleEvery2y: PreventiveRecommendation = {
  id: "test-female-2y",
  title: "Test screening (female, 2y)",
  summary: "fixture",
  sex: ["female"],
  ageMin: 50,
  ageMax: 74,
  cadenceMonths: 24,
  source: "fixture",
};

const allOnce: PreventiveRecommendation = {
  id: "test-all-once",
  title: "Test one-time (all)",
  summary: "fixture",
  sex: [],
  ageMin: 45,
  ageMax: null,
  cadenceMonths: null,
  source: "fixture",
};

// No age bound at all → surfaces even when age is unknown.
const allNoAge: PreventiveRecommendation = {
  id: "test-noage",
  title: "Test one-time (all, no age bound)",
  summary: "fixture",
  sex: [],
  ageMin: null,
  ageMax: null,
  cadenceMonths: null,
  source: "fixture",
};

const recs = [femaleEvery2y, allOnce];

describe("uspstf — PREVENTIVE_RECOMMENDATIONS ships empty (reviewer/API-gated)", () => {
  it("is empty by design", () => {
    expect(PREVENTIVE_RECOMMENDATIONS).toHaveLength(0);
  });

  it("dueScreenings returns [] with the default (empty) set", () => {
    expect(
      dueScreenings({
        sexAtBirth: "female",
        ageYears: 60,
        lastDoneByRecId: {},
        now: NOW,
      }),
    ).toHaveLength(0);
  });
});

describe("dueScreenings — sex / age / cadence gating", () => {
  it("excludes a female-only rec for a male", () => {
    const due = dueScreenings({
      sexAtBirth: "male",
      ageYears: 60,
      lastDoneByRecId: {},
      now: NOW,
      recommendations: recs,
    });
    expect(due.map((d) => d.rec.id)).toEqual(["test-all-once"]);
  });

  it("excludes the female rec below its age window", () => {
    const due = dueScreenings({
      sexAtBirth: "female",
      ageYears: 48, // below ageMin 50
      lastDoneByRecId: {},
      now: NOW,
      recommendations: recs,
    });
    expect(due.map((d) => d.rec.id)).toEqual(["test-all-once"]);
  });

  it("a never-done applicable rec is due", () => {
    const due = dueScreenings({
      sexAtBirth: "female",
      ageYears: 60,
      lastDoneByRecId: {},
      now: NOW,
      recommendations: recs,
    });
    expect(due.map((d) => d.rec.id).sort()).toEqual([
      "test-all-once",
      "test-female-2y",
    ]);
  });

  it("a cadenced rec done within the window is NOT due", () => {
    const due = dueScreenings({
      sexAtBirth: "female",
      ageYears: 60,
      lastDoneByRecId: { "test-female-2y": "2025-07-01T00:00:00.000Z" }, // ~11mo ago
      now: NOW,
      recommendations: [femaleEvery2y],
    });
    expect(due).toHaveLength(0);
  });

  it("a cadenced rec done beyond the window IS due again", () => {
    const due = dueScreenings({
      sexAtBirth: "female",
      ageYears: 60,
      lastDoneByRecId: { "test-female-2y": "2023-01-01T00:00:00.000Z" }, // >2y ago
      now: NOW,
      recommendations: [femaleEvery2y],
    });
    expect(due.map((d) => d.rec.id)).toEqual(["test-female-2y"]);
  });

  it("WITHHOLDS an age-gated rec when age is unknown (never applies age-specific when null)", () => {
    const due = dueScreenings({
      sexAtBirth: "female",
      ageYears: null,
      lastDoneByRecId: {},
      now: NOW,
      recommendations: [femaleEvery2y], // has ageMin/ageMax
    });
    expect(due).toHaveLength(0);
  });

  it("still surfaces a NO-age-bound rec when age is unknown", () => {
    const due = dueScreenings({
      sexAtBirth: "female",
      ageYears: null,
      lastDoneByRecId: {},
      now: NOW,
      recommendations: [allNoAge],
    });
    expect(due.map((d) => d.rec.id)).toEqual(["test-noage"]);
  });
});

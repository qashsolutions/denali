/**
 * PCOS-history marker surfacing (ORGANIZATIONAL ONLY). A female user who
 * self-reported a PCOS history sees the androgen panel she can ALREADY log
 * (free testosterone, SHBG, DHEA-S) surfaced as "Related to your logged history"
 * ahead of the rest of the picker. No clinical claim — pure re-ordering of
 * catalog markers. These pins prove: flag Yes → panel surfaced (+ de-duped from
 * its normal group); No / Prefer-not-to-say / non-female → unchanged.
 */
import { describe, expect, it } from "vitest";

import {
  buildMarkerPickerSections,
  pcosRelevantMarkers,
} from "../markerCatalog";

const PANEL = ["free_testosterone", "shbg", "dhea_s"];
const FREE_T_LOINC = "2991-8"; // free_testosterone's catalog LOINC

function groupedKeys(
  sections: ReturnType<typeof buildMarkerPickerSections>,
): Set<string> {
  return new Set(
    sections.grouped.flatMap((g) => g.markers.map((m) => m.key)),
  );
}

describe("pcosRelevantMarkers — the surfacing gate", () => {
  it("female + PCOS=true → the androgen panel, in order", () => {
    expect(pcosRelevantMarkers("female", true).map((m) => m.key)).toEqual(PANEL);
  });

  it("female + No / Prefer-not-to-say → empty (default surfacing)", () => {
    expect(pcosRelevantMarkers("female", false)).toEqual([]);
    expect(pcosRelevantMarkers("female", null)).toEqual([]);
    expect(pcosRelevantMarkers("female", undefined)).toEqual([]);
  });

  it("non-female cohorts → empty even with PCOS=true (PCOS is female-specific)", () => {
    for (const sex of [
      "male",
      "intersex",
      "unknown",
      null,
      undefined,
    ] as const) {
      expect(pcosRelevantMarkers(sex, true)).toEqual([]);
    }
  });
});

describe("buildMarkerPickerSections — flag Yes → panel surfaced; No → unchanged", () => {
  const noObs: ReadonlyArray<{ code: string; effective_at: string }> = [];

  it("female + PCOS=true: panel in `related`, DE-DUPED from its normal group", () => {
    const s = buildMarkerPickerSections({
      observations: noObs,
      sexAtBirth: "female",
      pcosHistory: true,
    });
    expect(s.related.map((m) => m.key)).toEqual(PANEL);
    // The 3 no longer appear in the grouped ("Hormones") list.
    const gk = groupedKeys(s);
    for (const k of PANEL) expect(gk.has(k)).toBe(false);
    // Female hormones NOT in the panel stay grouped (fsh, estradiol).
    expect(gk.has("fsh")).toBe(true);
    expect(gk.has("estradiol")).toBe(true);
  });

  it("female + PCOS=false: `related` empty; grouped UNCHANGED (panel stays in group)", () => {
    const s = buildMarkerPickerSections({
      observations: noObs,
      sexAtBirth: "female",
      pcosHistory: false,
    });
    expect(s.related).toEqual([]);
    const gk = groupedKeys(s);
    for (const k of PANEL) expect(gk.has(k)).toBe(true);
  });

  it("female + PCOS=true but a panel marker already tracked → surfaced once, never duplicated", () => {
    const s = buildMarkerPickerSections({
      observations: [
        { code: FREE_T_LOINC, effective_at: "2026-07-01T00:00:00.000Z" },
      ],
      sexAtBirth: "female",
      pcosHistory: true,
    });
    // free_testosterone is in "You're tracking"; `related` has the OTHER two.
    expect(s.tracked.map((t) => t.marker.key)).toContain("free_testosterone");
    expect(s.related.map((m) => m.key)).toEqual(["shbg", "dhea_s"]);
    const gk = groupedKeys(s);
    for (const k of PANEL) expect(gk.has(k)).toBe(false);
  });

  it("male + PCOS=true → unchanged (no `related`; panel stays grouped)", () => {
    const s = buildMarkerPickerSections({
      observations: noObs,
      sexAtBirth: "male",
      pcosHistory: true,
    });
    expect(s.related).toEqual([]);
    const gk = groupedKeys(s);
    for (const k of PANEL) expect(gk.has(k)).toBe(true);
  });

  it("every marker appears in EXACTLY one section (no duplication)", () => {
    const s = buildMarkerPickerSections({
      observations: noObs,
      sexAtBirth: "female",
      pcosHistory: true,
    });
    const all = [
      ...s.tracked.map((t) => t.marker.key),
      ...s.related.map((m) => m.key),
      ...s.grouped.flatMap((g) => g.markers.map((m) => m.key)),
    ];
    expect(new Set(all).size).toBe(all.length);
  });
});

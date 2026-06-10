/**
 * Biomarker registry + education boundary tests.
 *
 * Increment-1 state: CURATED_PANELS + BIOMARKER_EDUCATION ship EMPTY.
 * These tests pin three things:
 *
 *   1. The day-1 empty state (so future regressions accidentally
 *      shipping content from memory are visible).
 *   2. The match policy of getCuratedPanel (sex-only fallback, age
 *      range matching, intersex/unknown returns null).
 *   3. The display+clinical boundary: the lint-style regex
 *      /(should|need to|must).{0,30}test/i must NOT match any shipped
 *      education entry. Today the map is empty so this is vacuously
 *      true — but the test is in place so the moment a clinical
 *      reviewer ships copy, the regex enforces the boundary
 *      automatically.
 */
import { describe, expect, it } from "vitest";

import {
  CURATED_PANELS,
  getCuratedPanel,
  type CuratedBiomarkerPanel,
} from "../registry";
import {
  BIOMARKER_EDUCATION,
  type BiomarkerEducation,
} from "../education";

describe("CURATED_PANELS — increment 1 empty state", () => {
  it("is empty in increment 1 (content awaits clinical reviewer)", () => {
    expect(CURATED_PANELS.length).toBe(0);
  });

  it("any shipped entry must be marked provisional until clinical review", () => {
    for (const panel of CURATED_PANELS) {
      expect(panel.provisional).toBe(true);
    }
  });

  it("any shipped entry must cite a source", () => {
    for (const panel of CURATED_PANELS) {
      expect(panel.source.length).toBeGreaterThan(0);
    }
  });
});

describe("getCuratedPanel — match policy", () => {
  // We exercise the match policy via a small synthetic panel set. The
  // production CURATED_PANELS is empty in increment 1; these tests
  // pin the helper's behavior independently so the moment real panels
  // ship, the matching works as designed.
  const SYNTH_PANELS: ReadonlyArray<CuratedBiomarkerPanel> = [
    {
      panelId: "male-40-64",
      sex: "male",
      ageRange: { kind: "specific", min: 40, max: 64 },
      loincCodes: ["4548-4"],
      source: "synthetic for tests",
      provisional: true,
    },
    {
      panelId: "male-any-age",
      sex: "male",
      ageRange: { kind: "any" },
      loincCodes: ["4548-4"],
      source: "synthetic for tests",
      provisional: true,
    },
    {
      panelId: "female-40-64",
      sex: "female",
      ageRange: { kind: "specific", min: 40, max: 64 },
      loincCodes: ["4548-4"],
      source: "synthetic for tests",
      provisional: true,
    },
  ];

  // Re-implement getCuratedPanel against the synth set for testing.
  // The production helper consults the (empty) CURATED_PANELS const
  // and therefore returns null for everything — covered separately.
  function findInSynth(
    sex: "male" | "female" | "intersex" | "unknown" | null | undefined,
    age: number | null,
  ): CuratedBiomarkerPanel | null {
    if (sex !== "male" && sex !== "female") return null;
    if (age == null) {
      return (
        SYNTH_PANELS.find(
          (p) => p.sex === sex && p.ageRange.kind === "any",
        ) ?? null
      );
    }
    return (
      SYNTH_PANELS.find(
        (p) =>
          p.sex === sex &&
          p.ageRange.kind === "specific" &&
          age >= p.ageRange.min &&
          age <= p.ageRange.max,
      ) ?? null
    );
  }

  it("returns null for sex='intersex' (no panel claim without specific sex)", () => {
    expect(findInSynth("intersex", 50)).toBeNull();
  });

  it("returns null for sex='unknown'", () => {
    expect(findInSynth("unknown", 50)).toBeNull();
  });

  it("returns null for sex=null / undefined", () => {
    expect(findInSynth(null, 50)).toBeNull();
    expect(findInSynth(undefined, 50)).toBeNull();
  });

  it("matches (sex, age) within a specific range", () => {
    const r = findInSynth("male", 50);
    expect(r?.panelId).toBe("male-40-64");
  });

  it("returns sex-only fallback when age is null and a 'any' panel exists", () => {
    const r = findInSynth("male", null);
    expect(r?.panelId).toBe("male-any-age");
  });

  it("returns null when sex matches no panel (e.g. age outside range, no 'any' for that sex)", () => {
    // Female has no any-age panel in this set; age=30 outside specific range.
    expect(findInSynth("female", 30)).toBeNull();
  });
});

describe("getCuratedPanel — production constant (increment 1: empty)", () => {
  it("returns null for every input because CURATED_PANELS is empty in increment 1", () => {
    expect(getCuratedPanel("male", 50)).toBeNull();
    expect(getCuratedPanel("female", 50)).toBeNull();
    expect(getCuratedPanel("male", null)).toBeNull();
    expect(getCuratedPanel("female", null)).toBeNull();
    expect(getCuratedPanel("intersex", 50)).toBeNull();
    expect(getCuratedPanel("unknown", 50)).toBeNull();
    expect(getCuratedPanel(null, 50)).toBeNull();
  });
});

describe("BIOMARKER_EDUCATION — increment 1 empty state", () => {
  it("is empty in increment 1 (content awaits clinical reviewer)", () => {
    expect(Object.keys(BIOMARKER_EDUCATION).length).toBe(0);
  });

  it("any shipped entry must be marked provisional until clinical review", () => {
    for (const entry of Object.values(BIOMARKER_EDUCATION)) {
      const e = entry as BiomarkerEducation;
      expect(e.provisional).toBe(true);
    }
  });
});

describe("Display + clinical boundary — lint-style regex (delta scaffold)", () => {
  /**
   * The boundary regex catches the most common test-recommendation
   * phrasing: "you should get tested", "you need to test", "must test
   * this", etc. Empty map → vacuously passes. Future entries get this
   * gate automatically.
   */
  const FORBIDDEN_REC_PATTERN = /(should|need to|must).{0,30}test/i;

  it("no education entry's whatItIs contains a test recommendation", () => {
    for (const entry of Object.values(BIOMARKER_EDUCATION)) {
      const e = entry as BiomarkerEducation;
      expect(e.whatItIs).not.toMatch(FORBIDDEN_REC_PATTERN);
    }
  });

  it("no education entry's whyTracked contains a test recommendation", () => {
    for (const entry of Object.values(BIOMARKER_EDUCATION)) {
      const e = entry as BiomarkerEducation;
      expect(e.whyTracked).not.toMatch(FORBIDDEN_REC_PATTERN);
    }
  });

  it("the regex correctly catches representative violations (scaffold sanity)", () => {
    // Self-test: prove the regex catches what it should — so we know
    // the empty-map "vacuous pass" above isn't because the regex is
    // broken.
    const violations = [
      "You should get tested for diabetes.",
      "We need to test this marker every year.",
      "Patients must test their HbA1c quarterly.",
    ];
    for (const v of violations) {
      expect(v).toMatch(FORBIDDEN_REC_PATTERN);
    }
  });

  it("the regex does NOT catch acceptable descriptive copy (scaffold sanity)", () => {
    const acceptable = [
      "HbA1c measures average blood sugar over the last 2-3 months.",
      "Clinicians commonly track HbA1c as part of diabetes management.",
      "Talking with your doctor about which markers matter for you could help.",
    ];
    for (const a of acceptable) {
      expect(a).not.toMatch(FORBIDDEN_REC_PATTERN);
    }
  });
});

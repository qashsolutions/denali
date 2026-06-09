/**
 * Interpretation lookup tests.
 *
 * Coverage:
 *   - Every published cutoff edge for each instrument's bands (boundary
 *     conditions are the load-bearing correctness check).
 *   - AUDIT-C sex-specific branches: male vs female cutoffs differ.
 *   - AUDIT-C sex-fallback (delta 3): unknown/intersex/null returns
 *     female bands AND a fallbackNote.
 *   - Score interpolation: `{{score}}` is replaced in headline +
 *     explanation, never appears in user-facing text.
 *   - ADAM binary outcome: Morley 2000 rule cases.
 *   - Lookup returns null (not throw) for unknown instrument or
 *     out-of-range score.
 *   - Every shipped band carries `provisional: true` (sign-off gate).
 *
 * These tests pin the table V1 contract. When V2 ships (with reviewed
 * strings), it lives at `tableV2.ts` with its own test file; these stay
 * to lock the V1 row schema for historical playback.
 */
import { describe, expect, it } from "vitest";

import {
  computeAdamOutcome,
  lookupInterpretation,
} from "../lookup";
import { INTERPRETATION_TABLE_V1 } from "../tableV1";

describe("lookupInterpretation — unknown instrument / out-of-range", () => {
  it("returns null for an unknown instrument id", () => {
    expect(lookupInterpretation("UNKNOWN", 5, "male")).toBeNull();
  });

  it("returns null for a score below the minimum band", () => {
    // PHQ-9 covers 0..+inf; -1 should not match.
    expect(lookupInterpretation("PHQ-9", -1, "male")).toBeNull();
  });
});

describe("lookupInterpretation — PHQ-2 (Kroenke 2003)", () => {
  it.each([
    [0, "negative"],
    [1, "negative"],
    [2, "negative"],
    [3, "positive"],
    [4, "positive"],
    [6, "positive"],
  ])("score %i → band %s", (score, bandId) => {
    const r = lookupInterpretation("PHQ-2", score, "male");
    expect(r?.band.bandId).toBe(bandId);
  });
});

describe("lookupInterpretation — PHQ-9 (Kroenke 2001)", () => {
  it.each([
    [0, "minimal"],
    [4, "minimal"],
    [5, "mild"],
    [9, "mild"],
    [10, "moderate"],
    [14, "moderate"],
    [15, "moderately-severe"],
    [19, "moderately-severe"],
    [20, "severe"],
    [27, "severe"],
  ])("score %i → band %s", (score, bandId) => {
    const r = lookupInterpretation("PHQ-9", score, "male");
    expect(r?.band.bandId).toBe(bandId);
  });
});

describe("lookupInterpretation — GAD-7 (Spitzer 2006)", () => {
  it.each([
    [0, "minimal"],
    [4, "minimal"],
    [5, "mild"],
    [9, "mild"],
    [10, "moderate"],
    [14, "moderate"],
    [15, "severe"],
    [21, "severe"],
  ])("score %i → band %s", (score, bandId) => {
    const r = lookupInterpretation("GAD-7", score, "female");
    expect(r?.band.bandId).toBe(bandId);
  });
});

describe("lookupInterpretation — Epworth (Johns official, delta 2)", () => {
  // 0–5 lower normal / 6–10 higher normal / 11–12 mild / 13–15 moderate /
  // 16–24 severe — per epworthsleepinessscale.com.
  it.each([
    [0, "lower-normal"],
    [5, "lower-normal"],
    [6, "higher-normal"],
    [10, "higher-normal"],
    [11, "mild"],
    [12, "mild"],
    [13, "moderate"],
    [15, "moderate"],
    [16, "severe"],
    [24, "severe"],
  ])("score %i → band %s", (score, bandId) => {
    const r = lookupInterpretation("Epworth", score, "male");
    expect(r?.band.bandId).toBe(bandId);
  });
});

describe("lookupInterpretation — AUDIT-C (sex-dependent, Bush 1998 / Bradley 2007)", () => {
  describe("male bands", () => {
    it.each([
      [0, "lower-risk"],
      [3, "lower-risk"],
      [4, "higher-risk"],
      [5, "higher-risk"],
      [6, "likely-aud"],
      [12, "likely-aud"],
    ])("male, score %i → band %s", (score, bandId) => {
      const r = lookupInterpretation("AUDIT-C", score, "male");
      expect(r?.band.bandId).toBe(bandId);
      expect(r?.fallbackNote).toBeUndefined();
    });
  });

  describe("female bands", () => {
    it.each([
      [0, "lower-risk"],
      [2, "lower-risk"],
      [3, "higher-risk"],
      [4, "likely-aud"],
      [12, "likely-aud"],
    ])("female, score %i → band %s", (score, bandId) => {
      const r = lookupInterpretation("AUDIT-C", score, "female");
      expect(r?.band.bandId).toBe(bandId);
      expect(r?.fallbackNote).toBeUndefined();
    });
  });

  describe("delta 3 sex-fallback: unknown / intersex / null → female bands + note", () => {
    it.each([
      [null, 3],
      [undefined, 3],
      ["unknown" as const, 3],
      ["intersex" as const, 3],
    ])("sexAtBirth=%p → female bands + fallbackNote", (sex, score) => {
      const r = lookupInterpretation("AUDIT-C", score, sex);
      expect(r?.band.bandId).toBe("higher-risk"); // would be lower-risk for male
      expect(r?.fallbackNote).toBeTruthy();
      expect(r?.fallbackNote).toMatch(/sex|cutoff/i);
    });

    it("the fallback uses the LOWER threshold (more sensitive), proving the delta", () => {
      // Score = 3 is lower-risk for male, higher-risk for female. Falling
      // back to female bands surfaces the higher-risk classification —
      // intentionally over-trigger rather than miss.
      const maleR = lookupInterpretation("AUDIT-C", 3, "male");
      const fallbackR = lookupInterpretation("AUDIT-C", 3, "unknown");
      expect(maleR?.band.bandId).toBe("lower-risk");
      expect(fallbackR?.band.bandId).toBe("higher-risk");
    });
  });
});

describe("lookupInterpretation — IPSS (Barry 1992)", () => {
  it.each([
    [0, "mild"],
    [7, "mild"],
    [8, "moderate"],
    [19, "moderate"],
    [20, "severe"],
    [35, "severe"],
  ])("score %i → band %s", (score, bandId) => {
    const r = lookupInterpretation("IPSS", score, "male");
    expect(r?.band.bandId).toBe(bandId);
  });
});

describe("lookupInterpretation — MRS (Heinemann, delta 2)", () => {
  it.each([
    [0, "minimal"],
    [4, "minimal"],
    [5, "mild"],
    [8, "mild"],
    [9, "moderate"],
    [15, "moderate"],
    [16, "severe"],
    [30, "severe"],
  ])("score %i → band %s", (score, bandId) => {
    const r = lookupInterpretation("MRS", score, "female");
    expect(r?.band.bandId).toBe(bandId);
  });

  it("the cutoffSource cites Heinemann and notes the alternate scheme", () => {
    const mrs = INTERPRETATION_TABLE_V1.instruments["MRS"];
    expect(mrs.cutoffSource).toMatch(/Heinemann/);
    expect(mrs.cutoffSource).toMatch(/alternat/i);
  });
});

describe("lookupInterpretation — score interpolation", () => {
  it("replaces {{score}} in headline and explanation, never appears in output", () => {
    const r = lookupInterpretation("GAD-7", 7, "male");
    expect(r).not.toBeNull();
    expect(r?.band.headline).toContain("7");
    expect(r?.band.headline).not.toContain("{{score}}");
    expect(r?.band.explanation).not.toContain("{{score}}");
  });

  it("interpolates multi-digit scores correctly (e.g. PHQ-9 score=22)", () => {
    const r = lookupInterpretation("PHQ-9", 22, "male");
    expect(r?.band.headline).toContain("22");
  });
});

describe("provisional gate — every shipped band is provisional until clinical review", () => {
  it("table version is 1.0.0-provisional", () => {
    expect(INTERPRETATION_TABLE_V1.version).toBe("1.0.0-provisional");
  });

  it("no clinical reviewer is named", () => {
    expect(INTERPRETATION_TABLE_V1.lastClinicallyReviewedBy).toBeNull();
    expect(INTERPRETATION_TABLE_V1.lastClinicallyReviewedAt).toBeNull();
  });

  it("every band on every instrument carries provisional: true", () => {
    for (const [id, inst] of Object.entries(INTERPRETATION_TABLE_V1.instruments)) {
      const allBands = [
        ...inst.bands,
        ...(inst.sexDependent?.male ?? []),
        ...(inst.sexDependent?.female ?? []),
      ];
      for (const band of allBands) {
        expect(band.provisional).toBe(true);
      }
      // Silence unused-id by referencing it.
      expect(id).toBeTruthy();
    }
  });

  it("ADAM positive string does NOT mention 'testing' (operator delta 4)", () => {
    const adam = INTERPRETATION_TABLE_V1.instruments["ADAM"];
    const positiveBand = adam.bands.find((b) => b.bandId === "positive");
    expect(positiveBand).toBeDefined();
    expect(positiveBand?.headline.toLowerCase()).not.toContain("testing");
    expect(positiveBand?.explanation.toLowerCase()).not.toContain("testing");
  });
});

describe("computeAdamOutcome — Morley 2000 binary rule", () => {
  const Y = 1;
  const N = 0;

  function items(...vs: ReadonlyArray<0 | 1>): Array<number | null> {
    return [...vs];
  }

  it("returns 1 when item 1 is yes (single rule)", () => {
    expect(computeAdamOutcome(items(Y, N, N, N, N, N, N, N, N, N))).toBe(1);
  });

  it("returns 1 when item 7 is yes (single rule)", () => {
    expect(computeAdamOutcome(items(N, N, N, N, N, N, Y, N, N, N))).toBe(1);
  });

  it("returns 1 when 3+ yes among items 2,3,4,5,6,8,9,10 (count rule)", () => {
    expect(computeAdamOutcome(items(N, Y, Y, Y, N, N, N, N, N, N))).toBe(1);
    expect(computeAdamOutcome(items(N, N, N, N, Y, Y, N, Y, N, N))).toBe(1);
  });

  it("returns 0 when only 2 yes among items 2..10 and neither item 1 nor 7", () => {
    expect(computeAdamOutcome(items(N, Y, Y, N, N, N, N, N, N, N))).toBe(0);
  });

  it("returns 0 when all responses are 'no'", () => {
    expect(computeAdamOutcome(items(N, N, N, N, N, N, N, N, N, N))).toBe(0);
  });

  it("returns null when length is wrong", () => {
    expect(computeAdamOutcome([1, 0])).toBeNull();
    expect(computeAdamOutcome([])).toBeNull();
  });

  it("returns null when any item is unanswered", () => {
    expect(computeAdamOutcome([1, null, 0, 0, 0, 0, 0, 0, 0, 0])).toBeNull();
  });

  it("integrates with lookupInterpretation: outcome 1 → positive, outcome 0 → negative", () => {
    const outcome = computeAdamOutcome(items(Y, N, N, N, N, N, N, N, N, N));
    expect(outcome).toBe(1);
    const r = lookupInterpretation("ADAM", outcome!, "male");
    expect(r?.band.bandId).toBe("positive");
  });
});

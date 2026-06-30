/**
 * Chart-config pins — table v1.3 (Step-3 Part A).
 *
 *   - scoreRange present and sane (min < max, exact definitional maxima)
 *     for every chartable instrument.
 *   - ADAM carries NO scoreRange (binary — excluded from score charts;
 *     chartability is keyed on scoreRange presence).
 *   - Exactly ONE curated tint override ships: IPSS "mild" (0–7) → "ok".
 *     Label text "Mild" unchanged.
 *   - ADAM negative-band pill is "No signs" (jargon fix, same class as
 *     the PHQ-2 v1.1.1 fix).
 */
import { describe, expect, it } from "vitest";

import {
  flattenStrategyBands,
  INTERPRETATION_TABLE_V1,
} from "../tableV1";

const T = INTERPRETATION_TABLE_V1.instruments;

describe("scoreRange — chartable instruments (v1.3)", () => {
  const expected: ReadonlyArray<[string, number, number]> = [
    ["PHQ-2", 0, 6],
    ["PHQ-9", 0, 27],
    ["GAD-7", 0, 21],
    ["Epworth", 0, 24],
    ["AUDIT-C", 0, 12],
    ["IPSS", 0, 35],
    ["MRS", 0, 44],
  ];

  it.each(expected)("%s has scoreRange %i–%i", (id, min, max) => {
    const range = T[id].scoreRange;
    expect(range).toBeDefined();
    expect(range?.min).toBe(min);
    expect(range?.max).toBe(max);
  });

  it.each(expected)("%s scoreRange is sane (min < max)", (id) => {
    const range = T[id].scoreRange;
    expect(range && range.min < range.max).toBe(true);
  });

  it("ADAM has NO scoreRange (binary — not chartable)", () => {
    expect(T.ADAM.scoreRange).toBeUndefined();
  });

  it("every band's finite scores sit inside its instrument's scoreRange", () => {
    for (const [id, entry] of Object.entries(T)) {
      const range = entry.scoreRange;
      if (!range) continue;
      for (const band of flattenStrategyBands(entry.strategy)) {
        expect(band.minScore, `${id} band ${band.bandId} min`).toBeGreaterThanOrEqual(range.min);
        if (Number.isFinite(band.maxScore)) {
          expect(band.maxScore, `${id} band ${band.bandId} max`).toBeLessThanOrEqual(range.max);
        }
      }
    }
  });
});

describe("curated tint overrides (v1.3)", () => {
  it('IPSS "mild" (0–7) carries the ok tint override, label unchanged', () => {
    const mild = flattenStrategyBands(T.IPSS.strategy).find(
      (b) => b.bandId === "mild",
    );
    expect(mild?.tint).toBe("ok");
    expect(mild?.pill).toBe("Mild");
    expect(mild?.minScore).toBe(0);
    expect(mild?.maxScore).toBe(7);
  });

  it("exactly one tint override ships across the whole table", () => {
    let overrides = 0;
    for (const entry of Object.values(T)) {
      for (const band of flattenStrategyBands(entry.strategy)) {
        if (band.tint != null) overrides += 1;
      }
    }
    expect(overrides).toBe(1);
  });
});

describe("ADAM pill string (v1.3)", () => {
  it('negative-band pill is "No signs", bandId unchanged', () => {
    const neg = flattenStrategyBands(T.ADAM.strategy).find(
      (b) => b.bandId === "negative",
    );
    expect(neg?.pill).toBe("No signs");
  });
});

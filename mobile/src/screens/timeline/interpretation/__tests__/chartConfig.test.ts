/**
 * Chart-config pins — table v1.3.
 *
 *   - scoreRange present and sane (min < max, exact definitional maxima)
 *     for every chartable instrument.
 *   - No curated tint override ships: the sole one (IPSS "mild" 0–7 → "ok")
 *     was removed with the proprietary instruments (2026-07 licensing removal,
 *     audit/LICENSING_BRIEF.md).
 */
import { describe, expect, it } from "vitest";

import {
  flattenStrategyBands,
  INTERPRETATION_TABLE_V1,
} from "../tableV1";

const T = INTERPRETATION_TABLE_V1.instruments;

describe("scoreRange — chartable instruments (v1.3)", () => {
  // Only the public-domain screeners remain. Epworth (0–24), IPSS (0–35),
  // MRS (0–44), and ADAM (binary) were removed.
  const expected: ReadonlyArray<[string, number, number]> = [
    ["PHQ-2", 0, 6],
    ["PHQ-9", 0, 27],
    ["GAD-7", 0, 21],
    ["AUDIT-C", 0, 12],
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

  it("the removed proprietary instruments are absent from the table", () => {
    for (const id of ["Epworth", "IPSS", "MRS", "ADAM"]) {
      expect(T[id]).toBeUndefined();
    }
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
  it("no tint override ships (the IPSS 'mild'→'ok' override left with the proprietary instruments)", () => {
    let overrides = 0;
    for (const entry of Object.values(T)) {
      for (const band of flattenStrategyBands(entry.strategy)) {
        if (band.tint != null) overrides += 1;
      }
    }
    expect(overrides).toBe(0);
  });
});

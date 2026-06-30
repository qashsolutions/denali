/**
 * PHQ-2 → PHQ-9 expansion-rule tests (pure scoring + threshold).
 *
 * The screen logic in InstrumentsScreen.tsx uses the score of the
 * first two PHQ items against the published threshold (≥ 3) to decide
 * whether to expand into the full PHQ-9 + 988 surface or stop after
 * PHQ-2. These tests pin the contract:
 *
 *   - PHQ-2.score uses items 1 and 2 only (length-2 input).
 *   - The threshold for expansion is 3, matching Kroenke 2003.
 *   - PHQ-9.score uses all 9 items; if any are missing or out of
 *     range, score returns null.
 *
 * Also pins the 988 trigger helper (shouldShow988) and the item index.
 */
import { describe, expect, it } from "vitest";

import {
  PHQ2,
  PHQ9,
  PHQ9_ITEM_9_INDEX,
  shouldShow988,
} from "@/onboarding/instruments";

const PHQ2_POSITIVE_THRESHOLD = 3;

describe("PHQ-2 scoring", () => {
  it("score 0 — both items 0", () => {
    expect(PHQ2.score([0, 0])).toBe(0);
  });
  it("score 2 — items 1 each (below threshold)", () => {
    expect(PHQ2.score([1, 1])).toBe(2);
  });
  it("score 3 — at the published positive threshold", () => {
    expect(PHQ2.score([1, 2])).toBe(3);
  });
  it("score 6 — max", () => {
    expect(PHQ2.score([3, 3])).toBe(6);
  });
  it("returns null when an item is unanswered", () => {
    expect(PHQ2.score([0])).toBeNull();
  });
  it("returns null when an item is out of range", () => {
    expect(PHQ2.score([0, 4])).toBeNull();
    expect(PHQ2.score([-1, 0])).toBeNull();
  });
});

describe("PHQ-2 → PHQ-9 expansion rule (threshold ≥ 3)", () => {
  // The decision below is the rule the InstrumentsScreen uses.
  function shouldExpandToPhq9(item1: number, item2: number): boolean {
    const s = PHQ2.score([item1, item2]);
    return s != null && s >= PHQ2_POSITIVE_THRESHOLD;
  }

  it("does NOT expand for 0+0", () => {
    expect(shouldExpandToPhq9(0, 0)).toBe(false);
  });
  it("does NOT expand for 1+1 (sum 2)", () => {
    expect(shouldExpandToPhq9(1, 1)).toBe(false);
  });
  it("expands for 1+2 (sum 3)", () => {
    expect(shouldExpandToPhq9(1, 2)).toBe(true);
  });
  it("expands for 2+1 (sum 3)", () => {
    expect(shouldExpandToPhq9(2, 1)).toBe(true);
  });
  it("expands for 3+0 (sum 3)", () => {
    expect(shouldExpandToPhq9(3, 0)).toBe(true);
  });
  it("expands for the max 3+3", () => {
    expect(shouldExpandToPhq9(3, 3)).toBe(true);
  });
});

describe("PHQ-9 scoring", () => {
  it("scores all zeros as 0", () => {
    expect(PHQ9.score([0, 0, 0, 0, 0, 0, 0, 0, 0])).toBe(0);
  });
  it("returns 27 for max", () => {
    expect(PHQ9.score([3, 3, 3, 3, 3, 3, 3, 3, 3])).toBe(27);
  });
  it("returns null when an item is unanswered", () => {
    expect(PHQ9.score([0, 0, 0, 0, 0, 0, 0, 0])).toBeNull();
    expect(
      PHQ9.score([0, 0, 0, 0, null as unknown as number, 0, 0, 0, 0]),
    ).toBeNull();
  });
});

describe("988 safety trigger", () => {
  it("PHQ-9 item 9 is at index 8", () => {
    expect(PHQ9_ITEM_9_INDEX).toBe(8);
  });
  it("shouldShow988 returns false for 0 / null", () => {
    const arr: Array<number | null> = [0, 0, 0, 0, 0, 0, 0, 0, 0];
    expect(shouldShow988(arr)).toBe(false);
    arr[8] = null;
    expect(shouldShow988(arr)).toBe(false);
  });
  it("shouldShow988 returns true for any positive item-9 response", () => {
    for (const v of [1, 2, 3]) {
      const arr: Array<number | null> = [0, 0, 0, 0, 0, 0, 0, 0, v];
      expect(shouldShow988(arr)).toBe(true);
    }
  });
});

describe("Instrument metadata for PHQ-2 vs PHQ-9", () => {
  it("PHQ-2 and PHQ-9 share per-item codes for items 1 and 2", () => {
    expect(PHQ2.items[0].itemCode).toBe(PHQ9.items[0].itemCode);
    expect(PHQ2.items[1].itemCode).toBe(PHQ9.items[1].itemCode);
  });
  it("PHQ-2 has 2 items, PHQ-9 has 9", () => {
    expect(PHQ2.items.length).toBe(2);
    expect(PHQ9.items.length).toBe(9);
  });
  it("both use LOINC", () => {
    expect(PHQ2.codeSystem).toBe("LOINC");
    expect(PHQ9.codeSystem).toBe("LOINC");
  });
});

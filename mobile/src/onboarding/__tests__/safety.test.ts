import { describe, expect, it } from "vitest";

import {
  CRISIS_988_COPY,
  PHQ9_ITEM_9_INDEX,
  shouldShow988,
} from "../instruments/safety";

describe("shouldShow988 — load-bearing PHQ-9 item 9 trigger", () => {
  // Item 9 is index 8 (1-based item number → 0-based array index).
  it("returns false when item 9 is 0 (Not at all)", () => {
    const responses = new Array(9).fill(0);
    expect(shouldShow988(responses)).toBe(false);
  });

  it("returns true when item 9 is 1 (Several days)", () => {
    const responses = new Array(9).fill(0);
    responses[PHQ9_ITEM_9_INDEX] = 1;
    expect(shouldShow988(responses)).toBe(true);
  });

  it("returns true when item 9 is 2 (More than half the days)", () => {
    const responses = new Array(9).fill(0);
    responses[PHQ9_ITEM_9_INDEX] = 2;
    expect(shouldShow988(responses)).toBe(true);
  });

  it("returns true when item 9 is 3 (Nearly every day)", () => {
    const responses = new Array(9).fill(0);
    responses[PHQ9_ITEM_9_INDEX] = 3;
    expect(shouldShow988(responses)).toBe(true);
  });

  it("returns false when item 9 is null (unanswered)", () => {
    const responses: Array<number | null> = new Array(9).fill(0);
    responses[PHQ9_ITEM_9_INDEX] = null;
    expect(shouldShow988(responses)).toBe(false);
  });

  it("ignores positive answers to OTHER items", () => {
    // Items 1-8 maxed out, item 9 = 0 → no 988.
    const responses = [3, 3, 3, 3, 3, 3, 3, 3, 0];
    expect(shouldShow988(responses)).toBe(false);
  });

  it("returns false when the array is too short to contain item 9", () => {
    expect(shouldShow988([0, 0, 0, 0])).toBe(false);
  });
});

describe("CRISIS_988_COPY", () => {
  it("uses tel: scheme for Call 988", () => {
    expect(CRISIS_988_COPY.callUrl).toBe("tel:988");
  });

  it("uses sms: scheme for Text 988", () => {
    expect(CRISIS_988_COPY.textUrl).toBe("sms:988");
  });

  it("mentions 988 in the body copy", () => {
    expect(CRISIS_988_COPY.body).toContain("988");
  });

  it("mentions 24/7 / free / confidential in body copy", () => {
    expect(CRISIS_988_COPY.body).toMatch(/24\/7/);
    expect(CRISIS_988_COPY.body).toMatch(/free/i);
    expect(CRISIS_988_COPY.body).toMatch(/confidential/i);
  });

  it("uses 'I understand' acknowledge label", () => {
    expect(CRISIS_988_COPY.acknowledge).toBe("I understand");
  });
});

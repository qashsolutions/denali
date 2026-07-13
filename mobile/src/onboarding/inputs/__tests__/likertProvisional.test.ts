/**
 * LikertInput provisional-mark render decisions.
 *
 * `helperTextGovernance.test.ts` proves the DATA is flagged provisional. This
 * proves the RENDER turns that flag into the ‡ marker + footnote: it pins the
 * two pure predicates `LikertInput` uses — without mounting the RN component.
 *
 * 2026-07 licensing removal: MRS was the only instrument shipping helperText,
 * and it is gone. These tests now use a SYNTHETIC fixture representing a future
 * instrument that re-introduces Denali-authored calibration hints, so the ‡ /
 * footnote path stays covered.
 */
import { describe, expect, it } from "vitest";

import {
  PROVISIONAL_FOOTNOTE,
  PROVISIONAL_MARK,
  type ProvisionalHelper,
  helperSuffix,
  shouldShowProvisionalFootnote,
} from "../likertProvisional";

describe("helperSuffix", () => {
  it("marks a present + provisional hint with ‡", () => {
    expect(helperSuffix({ helperText: "Mild", helperTextProvisional: true })).toBe(
      PROVISIONAL_MARK,
    );
  });

  it("does NOT mark a cleared (provisional false) hint", () => {
    expect(
      helperSuffix({ helperText: "Mild", helperTextProvisional: false }),
    ).toBe("");
  });

  it("does NOT mark when there is no helperText, even if the flag is true", () => {
    // A provisional flag with no hint has nothing to mark.
    expect(helperSuffix({ helperTextProvisional: true })).toBe("");
    expect(helperSuffix({ helperText: null, helperTextProvisional: true })).toBe(
      "",
    );
  });
});

describe("shouldShowProvisionalFootnote", () => {
  it("true when ANY option carries a provisional hint", () => {
    expect(
      shouldShowProvisionalFootnote([
        { helperText: "a" },
        { helperText: "Severe", helperTextProvisional: true },
      ]),
    ).toBe(true);
  });

  it("false when no option is provisional (plain or cleared hints only)", () => {
    expect(
      shouldShowProvisionalFootnote([
        { helperText: "Score range 0–4" }, // helperText, no provisional flag
        { helperText: "Reviewed", helperTextProvisional: false },
        {},
      ]),
    ).toBe(false);
  });

  it("false for an empty option set", () => {
    expect(shouldShowProvisionalFootnote([])).toBe(false);
  });
});

describe("provisional calibration copy (synthetic future instrument)", () => {
  // Represents a FUTURE instrument that adds Denali-authored calibration hints
  // on top of a validated scale. Proves the render decisions fire for it, the
  // way they did for MRS before its 2026-07 removal.
  const OPTIONS: ReadonlyArray<ProvisionalHelper> = [
    { helperText: "not present", helperTextProvisional: true },
    { helperText: "slight", helperTextProvisional: true },
    { helperText: "cleared", helperTextProvisional: false },
  ];

  it("the footnote fires when any hint is provisional", () => {
    expect(shouldShowProvisionalFootnote(OPTIONS)).toBe(true);
  });

  it("every provisional-hint option gets the ‡ marker; a cleared hint does not", () => {
    const provisional = OPTIONS.filter((o) => o.helperTextProvisional === true);
    expect(provisional.length).toBeGreaterThan(0);
    expect(provisional.every((o) => helperSuffix(o) === PROVISIONAL_MARK)).toBe(
      true,
    );
    const cleared = OPTIONS.find((o) => o.helperTextProvisional === false);
    expect(cleared).toBeDefined();
    expect(helperSuffix(cleared!)).toBe("");
  });

  it("the footnote copy stays the clinical-review wording", () => {
    expect(PROVISIONAL_FOOTNOTE).toBe("‡ Wording pending clinical review.");
  });
});

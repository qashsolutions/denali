/**
 * LikertInput provisional-mark render decisions (MRS-render gap).
 *
 * `helperTextGovernance.test.ts` proves the DATA is flagged provisional. This
 * proves the RENDER turns that flag into the ‡ marker + footnote: it pins the
 * two pure predicates `LikertInput` uses, and feeds MRS's REAL responseOptions
 * through them so a regression that drops the ‡ (or shows it for non-provisional
 * copy) fails here — without needing to mount the RN component.
 */
import { describe, expect, it } from "vitest";

import { MRS } from "../../instruments/index";
import {
  PROVISIONAL_FOOTNOTE,
  PROVISIONAL_MARK,
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
        { label: "a" } as never,
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

describe("MRS render decision (data → render)", () => {
  it("the footnote fires for MRS's real options", () => {
    // MRS ships 5 provisional calibration anchors (D40); the render MUST show
    // the footnote. Pinned end-to-end against the actual instrument definition.
    expect(shouldShowProvisionalFootnote(MRS.responseOptions)).toBe(true);
  });

  it("every MRS option with a hint gets the ‡ marker", () => {
    const withHints = MRS.responseOptions.filter((o) => o.helperText != null);
    expect(withHints.length).toBeGreaterThan(0);
    expect(withHints.every((o) => helperSuffix(o) === PROVISIONAL_MARK)).toBe(
      true,
    );
  });

  it("the footnote copy stays the clinical-review wording", () => {
    expect(PROVISIONAL_FOOTNOTE).toBe("‡ Wording pending clinical review.");
  });
});

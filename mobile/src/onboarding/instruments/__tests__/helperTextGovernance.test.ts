/**
 * helperText governance — no un-reviewed calibration copy ships silently.
 *
 * `ResponseOption.helperText` is Denali-authored CALIBRATION copy layered on
 * top of a validated instrument. It is clinical-adjacent, so every helperText
 * string MUST declare its review status via `helperTextProvisional` (true =
 * pending a named clinician; false = cleared, with a named reviewer) —
 * mirroring `InterpretationBand.provisional`. These tests fail if any option
 * carries helperText without that governance, so a future helperText addition
 * can't bypass clinical review by omission.
 *
 * 2026-07 licensing removal: MRS was the only instrument shipping helperText,
 * and it is gone. The rules below now hold vacuously across the shipped set —
 * the final test pins that state so a future addition trips the guard.
 */
import { describe, expect, it } from "vitest";

import { AUDIT_C, GAD7, PHQ2, PHQ9 } from "../index";
import type { InstrumentDefinition } from "../types";

const ALL_INSTRUMENTS: ReadonlyArray<InstrumentDefinition> = [
  AUDIT_C,
  GAD7,
  PHQ2,
  PHQ9,
];

function hasNamedReviewer(reviewedBy: string | null | undefined): boolean {
  return typeof reviewedBy === "string" && reviewedBy.trim().length > 0;
}

describe("helperText governance", () => {
  it("every option with helperText declares helperTextProvisional", () => {
    const offenders: string[] = [];
    for (const inst of ALL_INSTRUMENTS) {
      for (const opt of inst.responseOptions) {
        if (
          opt.helperText != null &&
          typeof opt.helperTextProvisional !== "boolean"
        ) {
          offenders.push(`${inst.id}:${opt.value} ("${opt.helperText}")`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("a CLEARED helperText (provisional false) names its clinical reviewer", () => {
    // The ‡ can only be cleared with a named clinician on record — CC never
    // clears it, and a false flag without a reviewer is a silent self-clear.
    const offenders: string[] = [];
    for (const inst of ALL_INSTRUMENTS) {
      for (const opt of inst.responseOptions) {
        if (
          opt.helperText != null &&
          opt.helperTextProvisional === false &&
          !hasNamedReviewer(opt.helperTextReviewedBy)
        ) {
          offenders.push(`${inst.id}:${opt.value} ("${opt.helperText}")`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("no shipped instrument currently ships helperText (post-2026-07 removal)", () => {
    // The only helperText consumer was MRS's severity anchors (D40), removed
    // with the proprietary instruments. Pin the empty state: a future addition
    // must go through the two governance rules above (deliberately, not by
    // silently reintroducing un-flagged calibration copy).
    const withHelper: string[] = [];
    for (const inst of ALL_INSTRUMENTS) {
      for (const opt of inst.responseOptions) {
        if (opt.helperText != null) withHelper.push(`${inst.id}:${opt.value}`);
      }
    }
    expect(withHelper).toEqual([]);
  });
});

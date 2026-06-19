/**
 * helperText governance — no un-reviewed calibration copy ships silently.
 *
 * `ResponseOption.helperText` is Denali-authored CALIBRATION copy added on top
 * of validated instruments (e.g. the MRS severity anchors, D40). It is
 * clinical-adjacent, so every helperText string MUST declare its review status
 * via `helperTextProvisional` (true = pending a named clinician; false =
 * cleared) — mirroring `InterpretationBand.provisional`. This test fails if any
 * option carries helperText without an explicit provisional flag, so a future
 * helperText addition can't bypass clinical governance by omission.
 */
import { describe, expect, it } from "vitest";

import {
  ADAM,
  AUDIT_C,
  EPWORTH,
  GAD7,
  IPSS,
  MRS,
  PHQ2,
  PHQ9,
} from "../index";
import type { InstrumentDefinition } from "../types";

const ALL_INSTRUMENTS: ReadonlyArray<InstrumentDefinition> = [
  ADAM,
  AUDIT_C,
  EPWORTH,
  GAD7,
  IPSS,
  MRS,
  PHQ2,
  PHQ9,
];

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

  it("the MRS severity anchors are present and marked provisional", () => {
    const withHints = MRS.responseOptions.filter((o) => o.helperText != null);
    // All 5 levels carry a calibration hint (D40).
    expect(withHints).toHaveLength(5);
    // Every one is provisional until a named clinician clears the wording.
    expect(withHints.every((o) => o.helperTextProvisional === true)).toBe(true);
  });
});

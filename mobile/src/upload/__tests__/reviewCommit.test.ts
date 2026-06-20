/**
 * reviewCommit tests — Phase 1 mobile (Wave 2 / mobile-upload-parse-builder).
 *
 * Pure-helper coverage for the review screen's commit path:
 *   - `buildObservationInsert` maps a single accepted row to a
 *     `LocalDataDAL.insertObservation` input with the right source +
 *     report_id + metadata_json (unedited parse preserved).
 *   - `computeParseStatus` correctly classifies all-accepted / partial /
 *     none-accepted / empty-list pattern.
 *   - `buildInsertsForReport` drops rejected rows + preserves order.
 *
 * Also exercises the integration path against a stubbed
 * `LocalDataDAL.insertObservation` to assert call arguments.
 */

import { describe, it, expect, vi } from "vitest";

import type { LocalDataDAL, ObservationInsertInput } from "@/contracts";

import {
  buildInsertsForReport,
  buildObservationInsert,
  computeParseStatus,
} from "../reviewCommit";
import type { ExtractedObservation, ReviewRowState } from "../types";

function obs(overrides: Partial<ExtractedObservation> = {}): ExtractedObservation {
  return {
    category: "biomarker",
    code_system: "LOINC",
    code: "4548-4",
    display: "Hemoglobin A1c",
    value_num: 7.2,
    value_text: null,
    unit: "%",
    effective_at: "2026-05-15",
    confidence: 0.93,
    source_text: "HbA1c 7.2%",
    ...overrides,
  };
}

function row(
  overrides?: Partial<ReviewRowState> & {
    originalOverride?: Partial<ExtractedObservation>;
    editedOverride?: Partial<ExtractedObservation>;
  },
): ReviewRowState {
  const original = obs(overrides?.originalOverride);
  const edited = obs(overrides?.editedOverride ?? overrides?.originalOverride);
  return {
    original,
    edited,
    accepted: true,
    ...overrides,
  };
}

describe("buildObservationInsert", () => {
  it("maps edited fields into the insert input + sets source + report_id", () => {
    const r = row({
      editedOverride: { value_num: 6.8, unit: "%", effective_at: "2026-05-16" },
    });
    const input = buildObservationInsert(r, "user-A", "rep-1");

    expect(input.user_id).toBe("user-A");
    expect(input.report_id).toBe("rep-1");
    expect(input.source).toBe("uploaded_report");
    expect(input.code).toBe("4548-4");
    expect(input.code_system).toBe("LOINC");
    expect(input.value_num).toBe(6.8);
    expect(input.unit).toBe("%");
    expect(input.effective_at).toBe("2026-05-16");
    expect(input.supersedes_id).toBeNull();
  });

  it("preserves the unedited parse inside metadata_json for audit", () => {
    const r = row({
      originalOverride: { value_num: 7.2, source_text: "HbA1c 7.2%" },
      editedOverride: { value_num: 6.8, source_text: "HbA1c 7.2%" },
    });
    const input = buildObservationInsert(r, "user-A", "rep-1");
    expect(input.metadata_json).toBeTruthy();
    const meta = JSON.parse(input.metadata_json!) as {
      confidence: number;
      unedited: ExtractedObservation;
    };
    expect(meta.confidence).toBe(0.93);
    expect(meta.unedited.value_num).toBe(7.2);
    // The edited value differs:
    expect(input.value_num).toBe(6.8);
  });
});

describe("computeParseStatus", () => {
  it("returns 'kept' for an empty row list (CU-3: deliberate save, doc on file)", () => {
    // computeParseStatus runs only on the Save path, so an empty/no-accepted
    // result is a deliberate keep — NOT a rejection (which would hide the doc).
    expect(computeParseStatus([])).toBe("kept");
  });

  it("returns 'kept' when no row is accepted (CU-3)", () => {
    expect(
      computeParseStatus([
        row({ accepted: false }),
        row({ accepted: false }),
      ]),
    ).toBe("kept");
  });

  it("returns 'partial' when some rows are accepted", () => {
    expect(
      computeParseStatus([
        row({ accepted: true }),
        row({ accepted: false }),
      ]),
    ).toBe("partial");
  });

  it("returns 'confirmed' when all rows are accepted", () => {
    expect(
      computeParseStatus([
        row({ accepted: true }),
        row({ accepted: true }),
      ]),
    ).toBe("confirmed");
  });
});

describe("buildInsertsForReport", () => {
  it("drops rejected rows and preserves order for accepted rows", () => {
    const rows: ReviewRowState[] = [
      row({
        originalOverride: { code: "A1" },
        editedOverride: { code: "A1" },
        accepted: true,
      }),
      row({
        originalOverride: { code: "B2" },
        editedOverride: { code: "B2" },
        accepted: false,
      }),
      row({
        originalOverride: { code: "C3" },
        editedOverride: { code: "C3" },
        accepted: true,
      }),
    ];
    const inserts = buildInsertsForReport(rows, "user-A", "rep-1");
    expect(inserts.map((i) => i.code)).toEqual(["A1", "C3"]);
  });
});

describe("integration: commit feeds insertObservation with correct args", () => {
  it("calls dal.insertObservation once per accepted row with source='uploaded_report'", async () => {
    const insertObservation = vi
      .fn<(input: ObservationInsertInput) => Promise<{ inserted: boolean; id: string }>>()
      .mockResolvedValue({ inserted: true, id: "obs-id" });
    const dal: Pick<LocalDataDAL, "insertObservation"> = {
      insertObservation,
    };

    const rows: ReviewRowState[] = [
      row({ editedOverride: { code: "L1" }, accepted: true }),
      row({ editedOverride: { code: "L2" }, accepted: false }),
      row({ editedOverride: { code: "L3" }, accepted: true }),
    ];

    const inserts = buildInsertsForReport(rows, "user-A", "rep-1");
    for (const i of inserts) {
      await dal.insertObservation(i);
    }

    expect(insertObservation).toHaveBeenCalledTimes(2);
    const calls = insertObservation.mock.calls;
    expect(calls[0]?.[0].code).toBe("L1");
    expect(calls[1]?.[0].code).toBe("L3");
    expect(calls[0]?.[0].source).toBe("uploaded_report");
    expect(calls[1]?.[0].source).toBe("uploaded_report");
    expect(calls[0]?.[0].report_id).toBe("rep-1");
    expect(calls[1]?.[0].report_id).toBe("rep-1");
  });
});

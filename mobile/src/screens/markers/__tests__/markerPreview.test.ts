/**
 * markerPreview tests — the dashboard "Your markers" value preview.
 *
 * Pins the clinical/privacy boundary the dashboard relies on:
 *   - NUMERIC-ONLY: text-valued rows are excluded so no free-text leaks
 *   - latest-per-code, newest-first, capped at `limit`
 *   - value is display-rounded + unit; label is the plain-language display name
 *   - chip comes ONLY from the report's own flag (metadata_json.unedited);
 *     a row with no metadata / no stated flag → rag: null (no claim)
 */

import { describe, expect, it } from "vitest";

import type { ObservationRow } from "@/contracts";

import { markerPreviewItems } from "../markerPreview";

function obs(over: Partial<ObservationRow> & { code: string }): ObservationRow {
  return {
    id: over.code,
    user_id: "u1",
    category: "biomarker",
    code_system: "LOINC",
    display: "test",
    value_num: 1,
    value_text: null,
    unit: null,
    source: "uploaded_report",
    effective_at: "2026-06-01T00:00:00.000Z",
    recorded_at: "2026-06-01T00:00:00.000Z",
    report_id: "r1",
    supersedes_id: null,
    metadata_json: null,
    ...over,
  };
}

/** Build a metadata_json carrying the report's own flag. */
function withFlag(flag: string): string {
  return JSON.stringify({
    unedited: {
      code_system: "LOINC",
      code: "x",
      display: "x",
      value_num: 1,
      value_text: null,
      unit: null,
      effective_at: "2026-06-01T00:00:00.000Z",
      confidence: 1,
      source_text: "",
      abnormal_flag: flag,
    },
  });
}

describe("markerPreviewItems", () => {
  it("returns [] for no rows", () => {
    expect(markerPreviewItems([], 3)).toEqual([]);
  });

  it("excludes text-valued rows (numeric-only — no free-text leak)", () => {
    const items = markerPreviewItems(
      [
        obs({ code: "A", value_num: 80, value_text: null }),
        obs({ code: "B", value_num: null, value_text: "Positive" }),
      ],
      3,
    );
    expect(items.map((i) => i.label)).not.toContain("Positive");
    expect(items).toHaveLength(1);
  });

  it("dedups to latest-per-code, newest-first, capped at limit", () => {
    const rows = [
      obs({ code: "A", id: "a-old", effective_at: "2026-01-01T00:00:00.000Z" }),
      obs({ code: "A", id: "a-new", effective_at: "2026-06-01T00:00:00.000Z" }),
      obs({ code: "B", effective_at: "2026-05-01T00:00:00.000Z" }),
      obs({ code: "C", effective_at: "2026-04-01T00:00:00.000Z" }),
      obs({ code: "D", effective_at: "2026-03-01T00:00:00.000Z" }),
    ];
    const items = markerPreviewItems(rows, 3);
    expect(items).toHaveLength(3); // capped
    expect(items[0]!.id).toBe("a-new"); // latest reading of A, newest overall
    // No duplicate codes (A appears once).
    expect(items.filter((i) => i.id.startsWith("a-")).length).toBe(1);
  });

  it("formats value + unit and uses the plain-language display name", () => {
    const [item] = markerPreviewItems(
      [obs({ code: "1920-8", display: "AST", value_num: 80, unit: "U/L" })],
      3,
    );
    expect(item!.label).toBe("AST"); // display, never the LOINC code
    expect(item!.value).toBe("80 U/L");
  });

  it("omits the unit when there is none", () => {
    const [item] = markerPreviewItems(
      [obs({ code: "X", value_num: 70, unit: null })],
      3,
    );
    expect(item!.value).toBe("70");
  });

  it("chips from the report's own flag; none without a flag", () => {
    const items = markerPreviewItems(
      [
        obs({ code: "HI", value_num: 80, metadata_json: withFlag("high") }),
        obs({ code: "CRIT", value_num: 9, metadata_json: withFlag("critical") }),
        obs({ code: "PLAIN", value_num: 5, metadata_json: null }),
      ],
      5,
    );
    const byId = Object.fromEntries(items.map((i) => [i.id, i]));
    expect(byId["HI"]!.rag).toEqual({ tint: "watch", label: "Flagged high" });
    expect(byId["CRIT"]!.rag).toEqual({
      tint: "alarm",
      label: "Flagged critical",
    });
    expect(byId["PLAIN"]!.rag).toBeNull();
  });
});

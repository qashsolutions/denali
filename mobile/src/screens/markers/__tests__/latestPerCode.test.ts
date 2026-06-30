/**
 * latestPerCode tests — the Health-markers detail card consolidation (D27).
 *
 * Pins:
 *   - one row per code, keeping the most-recent effective_at
 *   - distinct codes are all kept (never collapsed across markers)
 *   - result is newest-first and independent of input order
 *   - deterministic tie-break (effective_at → recorded_at → id) when two
 *     readings of the same code share an effective_at
 *   - empty input → empty output
 *   - the input array is not mutated (display-only, append-only DAL untouched)
 */

import { describe, expect, it } from "vitest";

import type { ObservationRow } from "@/contracts";

import { latestPerCode } from "../latestPerCode";

function obs(over: Partial<ObservationRow> & { code: string }): ObservationRow {
  return {
    id: "id",
    user_id: "u1",
    category: "anthropometric",
    code_system: "LOINC",
    display: "test",
    value_num: null,
    value_text: null,
    unit: null,
    source: "self_reported",
    effective_at: "2026-06-01T00:00:00.000Z",
    recorded_at: "2026-06-01T00:00:00.000Z",
    report_id: null,
    supersedes_id: null,
    metadata_json: null,
    ...over,
  };
}

const WEIGHT = "29463-7";
const HEIGHT = "8302-2";

describe("latestPerCode", () => {
  it("keeps only the most-recent reading per code", () => {
    const rows = [
      obs({ id: "w-old", code: WEIGHT, value_num: 80, effective_at: "2026-06-10T00:00:00.000Z" }),
      obs({ id: "w-new", code: WEIGHT, value_num: 78, effective_at: "2026-06-16T00:00:00.000Z" }),
      obs({ id: "w-mid", code: WEIGHT, value_num: 79, effective_at: "2026-06-13T00:00:00.000Z" }),
    ];
    const out = latestPerCode(rows);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("w-new");
    expect(out[0].value_num).toBe(78);
  });

  it("keeps distinct codes (never collapses across markers)", () => {
    const rows = [
      obs({ id: "w1", code: WEIGHT, value_num: 80, effective_at: "2026-06-16T00:00:00.000Z" }),
      obs({ id: "h1", code: HEIGHT, value_num: 175, effective_at: "2026-06-10T00:00:00.000Z" }),
    ];
    const out = latestPerCode(rows);
    expect(out).toHaveLength(2);
    expect(out.map((r) => r.code).sort()).toEqual([HEIGHT, WEIGHT].sort());
  });

  it("returns newest-first regardless of input order", () => {
    const rows = [
      obs({ id: "h1", code: HEIGHT, value_num: 175, effective_at: "2026-06-10T00:00:00.000Z" }),
      obs({ id: "w1", code: WEIGHT, value_num: 80, effective_at: "2026-06-16T00:00:00.000Z" }),
    ];
    // Pass oldest-first; result must still be newest-first.
    const out = latestPerCode(rows);
    expect(out.map((r) => r.id)).toEqual(["w1", "h1"]);
  });

  it("breaks an effective_at tie by recorded_at then id (deterministic)", () => {
    const rows = [
      obs({
        id: "a",
        code: WEIGHT,
        value_num: 80,
        effective_at: "2026-06-16T00:00:00.000Z",
        recorded_at: "2026-06-16T09:00:00.000Z",
      }),
      obs({
        id: "b",
        code: WEIGHT,
        value_num: 81,
        effective_at: "2026-06-16T00:00:00.000Z",
        recorded_at: "2026-06-16T18:00:00.000Z",
      }),
    ];
    const out = latestPerCode(rows);
    expect(out).toHaveLength(1);
    // Later recorded_at wins the tie.
    expect(out[0].id).toBe("b");
  });

  it("empty input → empty output", () => {
    expect(latestPerCode([])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const rows = [
      obs({ id: "w-new", code: WEIGHT, effective_at: "2026-06-16T00:00:00.000Z" }),
      obs({ id: "w-old", code: WEIGHT, effective_at: "2026-06-10T00:00:00.000Z" }),
    ];
    const snapshot = rows.map((r) => r.id);
    latestPerCode(rows);
    expect(rows.map((r) => r.id)).toEqual(snapshot);
  });
});

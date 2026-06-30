/**
 * Sparkline helper pins (Increment 2).
 *
 *   - recentSessionScores: newest-first input → chronological output,
 *     cap at maxN, incomplete sessions dropped, non-instrument skipped.
 *   - sparklinePolyline: honesty gate (<2 → null), point count, Y
 *     inversion + scoreRange scaling bounds.
 */
import { describe, expect, it } from "vitest";

import type { ObservationRow } from "@/contracts";

import type { TimelineCard } from "../../grouping";

type InstrumentSessionCard = Extract<TimelineCard, { kind: "instrument-session" }>;
import {
  recentSessionScores,
  sparklinePolyline,
  SPARKLINE_MAX_POINTS,
} from "../sparkline";

let _seq = 0;
function item(instrument: string, n: number, value: number | null): ObservationRow {
  _seq += 1;
  return {
    id: `r-${_seq}`,
    user_id: "u",
    category: "questionnaire",
    code_system: "LOINC",
    code: `c${n}`,
    display: "",
    value_num: value,
    value_text: null,
    unit: null,
    source: "self_reported",
    effective_at: "2026-06-01T00:00:00.000Z",
    recorded_at: "2026-06-01T00:00:00.000Z",
    report_id: null,
    supersedes_id: null,
    metadata_json: JSON.stringify({ instrument, itemNumber: n, itemText: `q${n}` }),
  };
}

/** A complete GAD-7 instrument-session card with a known total. */
function gad7(at: string, total: number): InstrumentSessionCard {
  // 7 items summing to `total` (front-load the value on item 1).
  const values = [total, 0, 0, 0, 0, 0, 0];
  return {
    kind: "instrument-session",
    instrumentId: "GAD-7",
    effective_at: at,
    items: values.map((v, i) => item("GAD-7", i + 1, v)),
  };
}

const GAD7_RANGE = { min: 0, max: 21 };

describe("recentSessionScores", () => {
  it("returns chronological (oldest→newest) from newest-first sessions", () => {
    // rollup convention: newest-first.
    const sessions = [
      gad7("2026-06-01T00:00:00.000Z", 5),
      gad7("2026-04-01T00:00:00.000Z", 9),
      gad7("2026-02-01T00:00:00.000Z", 3),
    ];
    expect(recentSessionScores(sessions)).toEqual([3, 9, 5]);
  });

  it("caps at SPARKLINE_MAX_POINTS (keeps the most recent)", () => {
    const sessions = Array.from({ length: 8 }, (_, i) =>
      gad7(`2026-0${(i % 9) + 1}-01T00:00:00.000Z`, i),
    );
    const out = recentSessionScores(sessions);
    expect(out).toHaveLength(SPARKLINE_MAX_POINTS);
    // Newest 5 of scores [0..7] are the first 5 (newest-first), reversed.
    expect(out).toEqual([4, 3, 2, 1, 0]);
  });

  it("drops incomplete sessions (a null item → no point)", () => {
    const incomplete: TimelineCard = {
      kind: "instrument-session",
      instrumentId: "GAD-7",
      effective_at: "2026-06-01T00:00:00.000Z",
      items: [item("GAD-7", 1, null), ...gad7("x", 0).items.slice(1)],
    };
    const sessions = [incomplete, gad7("2026-04-01T00:00:00.000Z", 6)];
    expect(recentSessionScores(sessions)).toEqual([6]);
  });

  it("skips non-instrument cards defensively", () => {
    const single: TimelineCard = {
      kind: "single",
      row: item("", 1, 4),
    };
    expect(recentSessionScores([single, gad7("2026-06-01T00:00:00.000Z", 2)])).toEqual([2]);
  });
});

describe("sparklinePolyline — honesty gate + geometry", () => {
  it("returns null with fewer than 2 scores", () => {
    expect(sparklinePolyline([], GAD7_RANGE, 308, 38)).toBeNull();
    expect(sparklinePolyline([5], GAD7_RANGE, 308, 38)).toBeNull();
  });

  it("emits one point per score, end coords on the last", () => {
    const geo = sparklinePolyline([0, 10, 21], GAD7_RANGE, 308, 38, 4);
    expect(geo).not.toBeNull();
    const pts = geo!.points.split(" ");
    expect(pts).toHaveLength(3);
    // x spans full width; last point at x=308.
    expect(geo!.endX).toBeCloseTo(308, 5);
  });

  it("inverts Y and respects scoreRange bounds (min→bottom, max→top)", () => {
    const geo = sparklinePolyline([0, 21], GAD7_RANGE, 308, 38, 4)!;
    const [x0, y0] = geo.points.split(" ")[0].split(",").map(Number);
    const [, y1] = geo.points.split(" ")[1].split(",").map(Number);
    expect(x0).toBe(0);
    // score 0 (min) sits lower on screen than score 21 (max).
    expect(y0).toBeGreaterThan(y1);
    // bounds: max maps to the top pad, min to height-pad.
    expect(y1).toBeCloseTo(4, 5);
    expect(y0).toBeCloseTo(34, 5);
  });

  it("clamps out-of-range scores into the band", () => {
    const geo = sparklinePolyline([-5, 99], GAD7_RANGE, 100, 38, 4)!;
    const ys = geo.points.split(" ").map((p) => Number(p.split(",")[1]));
    for (const y of ys) {
      expect(y).toBeGreaterThanOrEqual(4);
      expect(y).toBeLessThanOrEqual(34);
    }
  });
});

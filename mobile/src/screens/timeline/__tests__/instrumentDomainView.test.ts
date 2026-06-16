/**
 * instrumentDomainView tests — instrument-domain consolidation (D30).
 *
 * Pins the three decisions that drive the consolidated instrument DomainDetail:
 *   - latest = most-recent session (newest-first)
 *   - chartableInstrumentIds from ALL sessions, PHQ-2 skipped, most-recent-first
 *     — LOAD-BEARING: a Mood domain whose LATEST session is a (non-chartable)
 *     PHQ-2 negative screen must STILL chart PHQ-9, because the ids come from
 *     every session, not the single rendered card.
 *   - hasHistory = more than one session
 */

import { describe, expect, it } from "vitest";

import type { ObservationRow } from "@/contracts";

import type { TimelineCard } from "../grouping";
import { instrumentDomainView } from "../instrumentDomainView";

function item(over: Partial<ObservationRow>): ObservationRow {
  return {
    id: "i",
    user_id: "u1",
    category: "questionnaire",
    code_system: "LOINC",
    code: "x",
    display: "x",
    value_num: 1,
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

function session(instrumentId: string, effective_at: string): TimelineCard {
  return {
    kind: "instrument-session",
    instrumentId,
    effective_at,
    items: [item({ effective_at })],
  };
}

describe("instrumentDomainView", () => {
  it("empty → null latest, no chart, no history", () => {
    const v = instrumentDomainView([]);
    expect(v.latest).toBeNull();
    expect(v.chartableInstrumentIds).toEqual([]);
    expect(v.hasHistory).toBe(false);
  });

  it("latest = most-recent session; hasHistory true with >1", () => {
    const v = instrumentDomainView([
      session("PHQ-9", "2026-06-01T00:00:00.000Z"),
      session("PHQ-9", "2026-06-15T00:00:00.000Z"),
      session("PHQ-9", "2026-06-10T00:00:00.000Z"),
    ]);
    expect(v.latest?.kind).toBe("instrument-session");
    expect((v.latest as { effective_at: string }).effective_at).toBe(
      "2026-06-15T00:00:00.000Z",
    );
    expect(v.hasHistory).toBe(true);
    expect(v.chartableInstrumentIds).toEqual(["PHQ-9"]);
  });

  it("single session → hasHistory false (no drill-down)", () => {
    const v = instrumentDomainView([session("GAD-7", "2026-06-01T00:00:00.000Z")]);
    expect(v.hasHistory).toBe(false);
    expect(v.chartableInstrumentIds).toEqual(["GAD-7"]);
  });

  it("LOAD-BEARING: latest PHQ-2 still charts PHQ-9 (ids from all sessions)", () => {
    // Mood domain: a PHQ-9 check-in, then a later negative PHQ-2 screen.
    const v = instrumentDomainView([
      session("PHQ-9", "2026-06-10T00:00:00.000Z"),
      session("PHQ-2", "2026-06-15T00:00:00.000Z"), // latest, NOT chartable
    ]);
    // latest is the PHQ-2 screen…
    expect((v.latest as { instrumentId: string }).instrumentId).toBe("PHQ-2");
    // …but the chart still shows PHQ-9 (PHQ-2 skipped, PHQ-9 kept).
    expect(v.chartableInstrumentIds).toEqual(["PHQ-9"]);
  });

  it("ADAM (not chartable) yields no chart but is still the latest card", () => {
    const v = instrumentDomainView([session("ADAM", "2026-06-01T00:00:00.000Z")]);
    expect((v.latest as { instrumentId: string }).instrumentId).toBe("ADAM");
    expect(v.chartableInstrumentIds).toEqual([]);
  });
});

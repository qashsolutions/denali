/**
 * mostSevereDomain tests — the single Today attention item (D35).
 */

import { describe, expect, it } from "vitest";

import { mostSevereDomain } from "../dashboardAttention";
import type { DomainRollup } from "../rollup";

function instrument(
  domainId: string,
  latestInstrumentId: string,
  latestScore: number | null,
): DomainRollup {
  return {
    kind: "instrument-domain",
    domainId,
    sessions: [],
    latestScore,
    latestInstrumentId,
  } as unknown as DomainRollup;
}

describe("mostSevereDomain", () => {
  it("returns the domain whose latest band is severe (alarm tint)", () => {
    // PHQ-9 22 → severe band → alarm tint.
    const r = mostSevereDomain([instrument("mood", "PHQ-9", 22)], "male", 50);
    expect(r?.domainId).toBe("mood");
    expect(r?.band.bandId).toBe("severe");
  });

  it("ignores non-severe domains (minimal PHQ-9 → null)", () => {
    expect(
      mostSevereDomain([instrument("mood", "PHQ-9", 2)], "male", 50),
    ).toBeNull();
  });

  it("returns the FIRST severe domain only — single item, no pile-up", () => {
    const r = mostSevereDomain(
      [
        instrument("mood", "PHQ-9", 22), // severe
        instrument("anxiety", "GAD-7", 18), // also severe
      ],
      "female",
      60,
    );
    expect(r?.domainId).toBe("mood");
  });

  it("skips null scores and non-instrument domains", () => {
    expect(
      mostSevereDomain([instrument("mood", "PHQ-9", null)], "male", 50),
    ).toBeNull();
    const markers = {
      kind: "single-domain",
      domainId: "health_markers",
      rows: [],
    } as unknown as DomainRollup;
    expect(mostSevereDomain([markers], "male", 50)).toBeNull();
  });

  it("empty → null", () => {
    expect(mostSevereDomain([], "male", 50)).toBeNull();
  });
});

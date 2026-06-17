/**
 * mostSevereDomain tests — the single Today attention item (D35).
 */

import { describe, expect, it } from "vitest";

import { severeDomains } from "../dashboardAttention";
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

describe("severeDomains", () => {
  it("returns the domain whose latest band is severe (alarm tint)", () => {
    // PHQ-9 22 → severe band → alarm tint.
    const r = severeDomains([instrument("mood", "PHQ-9", 22)], "male", 50);
    expect(r).toHaveLength(1);
    expect(r[0].domainId).toBe("mood");
    expect(r[0].band.bandId).toBe("severe");
  });

  it("ignores non-severe domains (minimal PHQ-9 → empty)", () => {
    expect(
      severeDomains([instrument("mood", "PHQ-9", 2)], "male", 50),
    ).toEqual([]);
  });

  it("returns ALL severe, in order — the dashboard shows [0] + a +N more line", () => {
    const r = severeDomains(
      [
        instrument("mood", "PHQ-9", 22), // severe
        instrument("anxiety", "GAD-7", 18), // also severe
      ],
      "female",
      60,
    );
    expect(r.map((x) => x.domainId)).toEqual(["mood", "anxiety"]);
  });

  it("skips null scores and non-instrument domains", () => {
    expect(
      severeDomains([instrument("mood", "PHQ-9", null)], "male", 50),
    ).toEqual([]);
    const markers = {
      kind: "single-domain",
      domainId: "health_markers",
      rows: [],
    } as unknown as DomainRollup;
    expect(severeDomains([markers], "male", 50)).toEqual([]);
  });

  it("empty → empty", () => {
    expect(severeDomains([], "male", 50)).toEqual([]);
  });
});

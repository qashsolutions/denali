import { describe, expect, it } from "vitest";

import {
  AUDIT_C,
  GAD7,
  instrumentsFor,
  PHQ2,
  PHQ9,
} from "../instruments";

describe("PHQ-9 — Kroenke 2001", () => {
  it("scores 0 when all items are 0", () => {
    expect(PHQ9.score(new Array(9).fill(0))).toBe(0);
  });

  it("scores 27 (max) when all items are 3", () => {
    expect(PHQ9.score(new Array(9).fill(3))).toBe(27);
  });

  it("returns null when an item is unanswered", () => {
    const r: Array<number | null> = new Array(9).fill(0);
    r[5] = null;
    expect(PHQ9.score(r)).toBeNull();
  });

  it("returns null when an item is out of 0-3 range", () => {
    const r = new Array(9).fill(0);
    r[0] = 4;
    expect(PHQ9.score(r)).toBeNull();
  });

  it("has 9 items exactly", () => {
    expect(PHQ9.items).toHaveLength(9);
  });

  it("item 9 verbatim wording (self-harm gate item)", () => {
    expect(PHQ9.items[8].text).toBe(
      "Thoughts that you would be better off dead, or of hurting yourself in some way.",
    );
  });

  it("uses official LOINC panel 44249-1", () => {
    expect(PHQ9.loincCode).toBe("44249-1");
    expect(PHQ9.codeSystem).toBe("LOINC");
  });

  it("interpret bands match Kroenke 2001 cutoffs", () => {
    expect(PHQ9.interpret!(0)).toBe("Minimal depression symptoms");
    expect(PHQ9.interpret!(4)).toBe("Minimal depression symptoms");
    expect(PHQ9.interpret!(5)).toBe("Mild depression symptoms");
    expect(PHQ9.interpret!(9)).toBe("Mild depression symptoms");
    expect(PHQ9.interpret!(10)).toBe("Moderate depression symptoms");
    expect(PHQ9.interpret!(14)).toBe("Moderate depression symptoms");
    expect(PHQ9.interpret!(15)).toBe("Moderately severe depression symptoms");
    expect(PHQ9.interpret!(19)).toBe("Moderately severe depression symptoms");
    expect(PHQ9.interpret!(20)).toBe("Severe depression symptoms");
    expect(PHQ9.interpret!(27)).toBe("Severe depression symptoms");
  });
});

describe("PHQ-2 (fallback if 988 surface deferred)", () => {
  it("scores 0..6", () => {
    expect(PHQ2.score([0, 0])).toBe(0);
    expect(PHQ2.score([3, 3])).toBe(6);
  });

  it("has only 2 items (no self-harm item)", () => {
    expect(PHQ2.items).toHaveLength(2);
  });

  it("uses LOINC 55757-9", () => {
    expect(PHQ2.loincCode).toBe("55757-9");
  });

  it("flags positive screen at >= 3", () => {
    expect(PHQ2.interpret!(3)).toMatch(/Positive/);
    expect(PHQ2.interpret!(2)).toMatch(/Negative/);
  });
});

describe("GAD-7 — Spitzer 2006", () => {
  it("max score 21", () => {
    expect(GAD7.score(new Array(7).fill(3))).toBe(21);
  });

  it("min score 0", () => {
    expect(GAD7.score(new Array(7).fill(0))).toBe(0);
  });

  it("has 7 items", () => {
    expect(GAD7.items).toHaveLength(7);
  });

  it("uses LOINC 69737-5", () => {
    expect(GAD7.loincCode).toBe("69737-5");
  });

  it("interpret bands match Spitzer 2006", () => {
    expect(GAD7.interpret!(4)).toMatch(/Minimal/);
    expect(GAD7.interpret!(5)).toMatch(/Mild/);
    expect(GAD7.interpret!(10)).toMatch(/Moderate/);
    expect(GAD7.interpret!(15)).toMatch(/Severe/);
  });
});

describe("AUDIT-C — Bush 1998", () => {
  it("max score 12", () => {
    expect(AUDIT_C.score([4, 4, 4])).toBe(12);
  });

  it("min score 0", () => {
    expect(AUDIT_C.score([0, 0, 0])).toBe(0);
  });

  it("has 3 items", () => {
    expect(AUDIT_C.items).toHaveLength(3);
  });

  it("uses LOINC 75626-2", () => {
    expect(AUDIT_C.loincCode).toBe("75626-2");
  });

  it("rejects scores out of range", () => {
    expect(AUDIT_C.score([5, 0, 0])).toBeNull();
  });
});

// 2026-07 licensing removal: Epworth/ESS, MRS, IPSS, ADAM were removed
// (proprietary — audit/LICENSING_BRIEF.md). Only the public-domain screeners
// ship, and the battery no longer branches on sex — sex-specific coverage moved
// to the unlicensed symptom tracker.
describe("instrumentsFor — public-domain battery for every cohort", () => {
  it.each(["female", "male", "intersex", "unknown", null, undefined] as const)(
    "%s → PHQ-9, GAD-7, AUDIT-C (same for every cohort)",
    (sex) => {
      expect(instrumentsFor(sex).map((i) => i.id)).toEqual([
        "PHQ-9",
        "GAD-7",
        "AUDIT-C",
      ]);
    },
  );

  it("PHQ-9 is first (988 surface most-critical to encounter first)", () => {
    expect(instrumentsFor(null)[0].id).toBe("PHQ-9");
    expect(instrumentsFor("male")[0].id).toBe("PHQ-9");
    expect(instrumentsFor("female")[0].id).toBe("PHQ-9");
  });

  it("no removed proprietary instrument appears in any battery", () => {
    for (const sex of ["female", "male", "intersex", "unknown", null] as const) {
      const ids = instrumentsFor(sex).map((i) => i.id);
      for (const removed of ["Epworth", "MRS", "ADAM", "IPSS"]) {
        expect(ids).not.toContain(removed);
      }
    }
  });
});

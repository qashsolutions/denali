import { describe, expect, it } from "vitest";

import {
  ADAM,
  AUDIT_C,
  EPWORTH,
  GAD7,
  instrumentsFor,
  IPSS,
  isAdamPositive,
  MRS,
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

describe("Epworth — Johns 1991", () => {
  it("max score 24", () => {
    expect(EPWORTH.score(new Array(8).fill(3))).toBe(24);
  });

  it("has 8 items", () => {
    expect(EPWORTH.items).toHaveLength(8);
  });

  it("uses an internal code (no verified Epworth LOINC; 89204-2 was PHQ-9-Teen)", () => {
    expect(EPWORTH.loincCode).toBe("denali.EPWORTH.v1");
    expect(EPWORTH.codeSystem).toBe("internal");
  });
});

describe("MRS — Heinemann 2003 (female-branched)", () => {
  it("max score 44 (11 items × 4)", () => {
    expect(MRS.score(new Array(11).fill(4))).toBe(44);
  });

  it("has 11 items", () => {
    expect(MRS.items).toHaveLength(11);
  });

  it("uses internal code denali.MRS.v1 (no LOINC panel)", () => {
    expect(MRS.loincCode).toBe("denali.MRS.v1");
    expect(MRS.codeSystem).toBe("internal");
  });

  it("rejects out-of-range responses (>4)", () => {
    const r = new Array(11).fill(0);
    r[0] = 5;
    expect(MRS.score(r)).toBeNull();
  });
});

describe("ADAM — Morley 2000 (male-branched)", () => {
  it("counts yes-responses (0-10)", () => {
    expect(ADAM.score(new Array(10).fill(0))).toBe(0);
    expect(ADAM.score(new Array(10).fill(1))).toBe(10);
  });

  it("has 10 yes/no items", () => {
    expect(ADAM.items).toHaveLength(10);
  });

  it("rejects out-of-range responses (not 0 or 1)", () => {
    const r = new Array(10).fill(0);
    r[0] = 2;
    expect(ADAM.score(r)).toBeNull();
  });
});

describe("isAdamPositive — Morley 2000 positive-screen rule", () => {
  it("returns true when item 1 = yes", () => {
    const r = new Array(10).fill(0);
    r[0] = 1; // item 1 yes
    expect(isAdamPositive(r)).toBe(true);
  });

  it("returns true when item 7 = yes", () => {
    const r = new Array(10).fill(0);
    r[6] = 1; // item 7 yes
    expect(isAdamPositive(r)).toBe(true);
  });

  it("returns true when 3 yeses among items 2-10 excluding 1 and 7", () => {
    const r = new Array(10).fill(0);
    r[1] = 1; // item 2
    r[2] = 1; // item 3
    r[3] = 1; // item 4
    expect(isAdamPositive(r)).toBe(true);
  });

  it("returns false when only 2 yeses outside items 1 and 7", () => {
    const r = new Array(10).fill(0);
    r[1] = 1;
    r[2] = 1;
    expect(isAdamPositive(r)).toBe(false);
  });

  it("returns false when all items = no", () => {
    expect(isAdamPositive(new Array(10).fill(0))).toBe(false);
  });

  it("returns null when responses incomplete", () => {
    const r: Array<number | null> = new Array(10).fill(0);
    r[5] = null;
    expect(isAdamPositive(r)).toBeNull();
  });
});

describe("IPSS — Barry 1992 (male-branched)", () => {
  it("max symptom score 35 (7 × 5)", () => {
    expect(IPSS.score(new Array(7).fill(5))).toBe(35);
  });

  it("has 7 symptom items", () => {
    expect(IPSS.items).toHaveLength(7);
  });

  it("uses internal code denali.IPSS.v1", () => {
    expect(IPSS.loincCode).toBe("denali.IPSS.v1");
    expect(IPSS.codeSystem).toBe("internal");
  });

  it("severity bands match Barry 1992", () => {
    expect(IPSS.interpret!(7)).toMatch(/Mild/);
    expect(IPSS.interpret!(8)).toMatch(/Moderate/);
    expect(IPSS.interpret!(20)).toMatch(/Severe/);
  });
});

describe("instrumentsFor — sex-branched battery", () => {
  it("women receive: PHQ-9, GAD-7, AUDIT-C, Epworth, MRS", () => {
    const ids = instrumentsFor("female").map((i) => i.id);
    expect(ids).toEqual(["PHQ-9", "GAD-7", "AUDIT-C", "Epworth", "MRS"]);
  });

  it("men receive: PHQ-9, GAD-7, AUDIT-C, Epworth, ADAM, IPSS", () => {
    const ids = instrumentsFor("male").map((i) => i.id);
    expect(ids).toEqual([
      "PHQ-9",
      "GAD-7",
      "AUDIT-C",
      "Epworth",
      "ADAM",
      "IPSS",
    ]);
  });

  it("intersex receive unisex set only", () => {
    const ids = instrumentsFor("intersex").map((i) => i.id);
    expect(ids).toEqual(["PHQ-9", "GAD-7", "AUDIT-C", "Epworth"]);
  });

  it("unknown receive unisex set only", () => {
    const ids = instrumentsFor("unknown").map((i) => i.id);
    expect(ids).toEqual(["PHQ-9", "GAD-7", "AUDIT-C", "Epworth"]);
  });

  it("null receive unisex set only", () => {
    const ids = instrumentsFor(null).map((i) => i.id);
    expect(ids).toEqual(["PHQ-9", "GAD-7", "AUDIT-C", "Epworth"]);
  });

  it("undefined receive unisex set only", () => {
    const ids = instrumentsFor(undefined).map((i) => i.id);
    expect(ids).toEqual(["PHQ-9", "GAD-7", "AUDIT-C", "Epworth"]);
  });

  it("MRS not in male battery", () => {
    const ids = instrumentsFor("male").map((i) => i.id);
    expect(ids).not.toContain("MRS");
  });

  it("ADAM/IPSS not in female battery", () => {
    const ids = instrumentsFor("female").map((i) => i.id);
    expect(ids).not.toContain("ADAM");
    expect(ids).not.toContain("IPSS");
  });

  it("PHQ-9 is first (988 surface most-critical to encounter first)", () => {
    expect(instrumentsFor("female")[0].id).toBe("PHQ-9");
    expect(instrumentsFor("male")[0].id).toBe("PHQ-9");
    expect(instrumentsFor("intersex")[0].id).toBe("PHQ-9");
  });
});

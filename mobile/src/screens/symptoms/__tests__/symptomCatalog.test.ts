/**
 * Symptom catalog — integrity, the Denali-authored severity scale, and the
 * sex_at_birth cohort gate. These are the unlicensed symptom-tracker's
 * load-bearing pure logic (the replacement for the removed scored instruments).
 */
import { describe, expect, it } from "vitest";

import {
  findSymptomByCode,
  SEVERITY_OPTIONS,
  severityLabel,
  SYMPTOM_CATALOG,
  SYMPTOM_CODE_TO_DOMAIN,
  symptomCode,
  symptomDomainsFor,
  symptomsFor,
} from "../symptomCatalog";

const DOMAINS = new Set(["sleep", "urinary", "menopause", "hormonal"]);

describe("symptom catalog — integrity", () => {
  it("every symptom is provisional, has a nonempty display, and a valid domain", () => {
    for (const s of SYMPTOM_CATALOG) {
      expect(s.provisional).toBe(true);
      expect(s.display.length).toBeGreaterThan(0);
      expect(DOMAINS.has(s.domain)).toBe(true);
    }
  });

  it("codes are unique `denali.symptom.<domain>.<key>` slugs", () => {
    const codes = SYMPTOM_CATALOG.map(symptomCode);
    expect(new Set(codes).size).toBe(codes.length);
    for (const s of SYMPTOM_CATALOG) {
      expect(symptomCode(s)).toBe(`denali.symptom.${s.domain}.${s.key}`);
    }
  });

  it("SYMPTOM_CODE_TO_DOMAIN maps every code to its domain", () => {
    for (const s of SYMPTOM_CATALOG) {
      expect(SYMPTOM_CODE_TO_DOMAIN[symptomCode(s)]).toBe(s.domain);
    }
  });

  it("findSymptomByCode round-trips; unknown → undefined", () => {
    for (const s of SYMPTOM_CATALOG) {
      expect(findSymptomByCode(symptomCode(s))?.key).toBe(s.key);
    }
    expect(findSymptomByCode("denali.symptom.nope.nope")).toBeUndefined();
  });
});

describe("severity scale — Denali-authored 0–3 (NOT an instrument scale)", () => {
  it("is exactly None / Mild / Moderate / Severe at 0..3", () => {
    expect(SEVERITY_OPTIONS.map((o) => [o.value, o.label])).toEqual([
      [0, "None"],
      [1, "Mild"],
      [2, "Moderate"],
      [3, "Severe"],
    ]);
  });

  it("severityLabel maps 0..3 and rejects anything else", () => {
    expect(severityLabel(0)).toBe("None");
    expect(severityLabel(3)).toBe("Severe");
    expect(severityLabel(4)).toBeNull();
    expect(severityLabel(-1)).toBeNull();
    expect(severityLabel(1.5)).toBeNull();
  });
});

describe("symptomsFor — sex_at_birth cohort gate", () => {
  it("sleep + urinary are universal (offered to every cohort)", () => {
    for (const sex of ["male", "female", "intersex", "unknown", null] as const) {
      const domains = symptomsFor(sex).map((s) => s.domain);
      expect(domains).toContain("sleep");
      expect(domains).toContain("urinary");
    }
  });

  it("menopause symptoms are FEMALE-only", () => {
    expect(symptomsFor("female").some((s) => s.domain === "menopause")).toBe(
      true,
    );
    for (const sex of ["male", "intersex", "unknown", null] as const) {
      expect(symptomsFor(sex).some((s) => s.domain === "menopause")).toBe(false);
    }
  });

  it("hormonal symptoms are MALE-only", () => {
    expect(symptomsFor("male").some((s) => s.domain === "hormonal")).toBe(true);
    for (const sex of ["female", "intersex", "unknown", null] as const) {
      expect(symptomsFor(sex).some((s) => s.domain === "hormonal")).toBe(false);
    }
  });
});

describe("symptomDomainsFor — cohort domain surfacing", () => {
  it("female → menopause + sleep + urinary (no hormonal)", () => {
    expect([...symptomDomainsFor("female")].sort()).toEqual([
      "menopause",
      "sleep",
      "urinary",
    ]);
  });

  it("male → hormonal + sleep + urinary (no menopause)", () => {
    expect([...symptomDomainsFor("male")].sort()).toEqual([
      "hormonal",
      "sleep",
      "urinary",
    ]);
  });

  it("unknown / intersex / null → sleep + urinary only", () => {
    for (const sex of ["unknown", "intersex", null] as const) {
      expect([...symptomDomainsFor(sex)].sort()).toEqual(["sleep", "urinary"]);
    }
  });
});

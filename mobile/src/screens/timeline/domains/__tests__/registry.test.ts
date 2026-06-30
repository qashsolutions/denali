/**
 * Tests for the 9-domain registry — taxonomy integrity + cohort gating.
 *
 * Coverage:
 *   - All 8 instruments have a domain mapping.
 *   - All 9 ObservationCategory values have a domain mapping
 *     (exhaustiveness — guards against `category` enum drift).
 *   - DOMAIN_ORDER contains exactly the 9 domains, no dupes.
 *   - `domainsForCohort` returns universal domains for unknown sex.
 *   - `domainsForCohort` includes male-only / female-only domains
 *     correctly.
 *   - `domainForRow` honors metadata.instrument over category, falls
 *     back to category, returns null for unrecognizable input.
 */
import { describe, expect, it } from "vitest";

import type { ObservationCategory } from "@/contracts";

import {
  CATEGORY_TO_DOMAIN,
  DOMAIN_ORDER,
  INSTRUMENT_TO_DOMAIN,
  type DomainId,
  domainForRow,
  domainsForCohort,
} from "../registry";

const ALL_DOMAINS: ReadonlyArray<DomainId> = [
  "mood",
  "anxiety",
  "sleep",
  "alcohol",
  "urinary",
  "menopause",
  "hormonal",
  "health_markers",
  "health_history",
];

const ALL_INSTRUMENT_IDS = [
  "PHQ-2",
  "PHQ-9",
  "GAD-7",
  "Epworth",
  "AUDIT-C",
  "IPSS",
  "MRS",
  "ADAM",
] as const;

const ALL_CATEGORIES: ReadonlyArray<ObservationCategory> = [
  "questionnaire",
  "biomarker",
  "vital",
  "anthropometric",
  "screening",
  "symptom",
  "family_history",
  "condition",
  "lifestyle",
];

describe("taxonomy integrity", () => {
  it("DOMAIN_ORDER contains exactly the 9 domain ids, no dupes", () => {
    expect(DOMAIN_ORDER.length).toBe(9);
    expect(new Set(DOMAIN_ORDER).size).toBe(9);
    for (const d of ALL_DOMAINS) {
      expect(DOMAIN_ORDER).toContain(d);
    }
  });

  it("every instrument id has a domain mapping", () => {
    for (const id of ALL_INSTRUMENT_IDS) {
      expect(INSTRUMENT_TO_DOMAIN[id]).toBeDefined();
      // And the value is a known DomainId.
      expect(DOMAIN_ORDER).toContain(INSTRUMENT_TO_DOMAIN[id] as DomainId);
    }
  });

  it("every ObservationCategory has a domain mapping (exhaustive)", () => {
    for (const cat of ALL_CATEGORIES) {
      expect(CATEGORY_TO_DOMAIN[cat]).toBeDefined();
      expect(DOMAIN_ORDER).toContain(CATEGORY_TO_DOMAIN[cat] as DomainId);
    }
  });

  it("PHQ-2 and PHQ-9 both map to mood (same domain for the screener pair)", () => {
    expect(INSTRUMENT_TO_DOMAIN["PHQ-2"]).toBe("mood");
    expect(INSTRUMENT_TO_DOMAIN["PHQ-9"]).toBe("mood");
  });

  it("biomarker / vital / anthropometric all collapse into health_markers (Q1)", () => {
    expect(CATEGORY_TO_DOMAIN.biomarker).toBe("health_markers");
    expect(CATEGORY_TO_DOMAIN.vital).toBe("health_markers");
    expect(CATEGORY_TO_DOMAIN.anthropometric).toBe("health_markers");
    expect(CATEGORY_TO_DOMAIN.screening).toBe("health_markers");
  });

  it("family_history / conditions / symptoms / lifestyle all collapse into health_history (Q1)", () => {
    expect(CATEGORY_TO_DOMAIN.family_history).toBe("health_history");
    expect(CATEGORY_TO_DOMAIN.condition).toBe("health_history");
    expect(CATEGORY_TO_DOMAIN.symptom).toBe("health_history");
    expect(CATEGORY_TO_DOMAIN.lifestyle).toBe("health_history");
  });
});

describe("domainsForCohort", () => {
  it("includes the two universal domains regardless of sex", () => {
    for (const sex of [null, undefined, "male", "female", "intersex", "unknown"] as const) {
      const ds = domainsForCohort(sex);
      expect(ds).toContain("health_markers");
      expect(ds).toContain("health_history");
    }
  });

  it("returns unisex screener domains + universals for unknown sex", () => {
    const ds = domainsForCohort("unknown");
    // The 4 unisex instruments per onboarding/instruments/index.ts are
    // PHQ-9, GAD-7, AUDIT-C, Epworth → mood, anxiety, alcohol, sleep.
    expect(ds).toContain("mood");
    expect(ds).toContain("anxiety");
    expect(ds).toContain("alcohol");
    expect(ds).toContain("sleep");
    // Female-only / male-only NOT included.
    expect(ds).not.toContain("menopause");
    expect(ds).not.toContain("urinary");
    expect(ds).not.toContain("hormonal");
  });

  it("returns female-only MRS plus the unisex set for sex=female", () => {
    const ds = domainsForCohort("female");
    expect(ds).toContain("mood");
    expect(ds).toContain("anxiety");
    expect(ds).toContain("alcohol");
    expect(ds).toContain("sleep");
    expect(ds).toContain("menopause");
    // Male-only NOT included.
    expect(ds).not.toContain("urinary");
    expect(ds).not.toContain("hormonal");
  });

  it("returns male-only IPSS + ADAM plus the unisex set for sex=male", () => {
    const ds = domainsForCohort("male");
    expect(ds).toContain("mood");
    expect(ds).toContain("anxiety");
    expect(ds).toContain("alcohol");
    expect(ds).toContain("sleep");
    expect(ds).toContain("urinary");
    expect(ds).toContain("hormonal");
    expect(ds).not.toContain("menopause");
  });

  it("emits domains in DOMAIN_ORDER (mood first if present)", () => {
    const ds = domainsForCohort("female");
    // The first domain (if any) should be mood — it's first in DOMAIN_ORDER.
    expect(ds[0]).toBe("mood");
    // And health_history is last (umbrella).
    expect(ds[ds.length - 1]).toBe("health_history");
  });

  it("null / undefined sex returns the same set as 'unknown'", () => {
    const fromNull = domainsForCohort(null);
    const fromUndef = domainsForCohort(undefined);
    const fromUnknown = domainsForCohort("unknown");
    expect(fromNull).toEqual(fromUndef);
    expect(fromNull).toEqual(fromUnknown);
  });
});

describe("domainForRow", () => {
  it("honors metadata.instrument over category for questionnaire rows", () => {
    expect(
      domainForRow({ category: "questionnaire", metadataInstrument: "GAD-7" }),
    ).toBe("anxiety");
    expect(
      domainForRow({ category: "questionnaire", metadataInstrument: "AUDIT-C" }),
    ).toBe("alcohol");
  });

  it("falls back to category when metadataInstrument is unrecognized", () => {
    expect(
      domainForRow({ category: "biomarker", metadataInstrument: "UNKNOWN-INST" }),
    ).toBe("health_markers");
  });

  it("uses category map for non-questionnaire rows (no metadata.instrument)", () => {
    expect(
      domainForRow({ category: "biomarker", metadataInstrument: null }),
    ).toBe("health_markers");
    expect(
      domainForRow({ category: "vital", metadataInstrument: null }),
    ).toBe("health_markers");
    expect(
      domainForRow({ category: "lifestyle", metadataInstrument: null }),
    ).toBe("health_history");
    expect(
      domainForRow({ category: "condition", metadataInstrument: null }),
    ).toBe("health_history");
  });

  it("returns a domain for an orphan questionnaire row via category fallback", () => {
    // Defensive: a questionnaire row without metadata.instrument
    // shouldn't crash — category map returns health_history.
    expect(
      domainForRow({ category: "questionnaire", metadataInstrument: null }),
    ).toBe("health_history");
  });
});

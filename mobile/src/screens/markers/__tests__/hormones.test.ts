/**
 * Hormone markers (2026-07 additions) — FSH + estradiol (female-gated) and the
 * androgen panel free testosterone / SHBG / DHEA-S (universal, serves male
 * assessment + the female PCOS panel).
 *
 * TERMINOLOGY + gating pins. Per the clinical-content gate, these ship
 * BAND-LESS: no interpretation range is hardcoded in code. This file proves
 * they carry NLM-verified LOINCs, the correct cohort gates, AND that none has
 * an entry in the interpretation table's `biomarkers` map — so a reading renders
 * against the report's own printed range, never a range from recall (estradiol
 * alone differs ~10× pre- vs post-menopause).
 */
import { describe, expect, it } from "vitest";

import { INTERPRETATION_TABLE_V1 } from "../../timeline/interpretation/tableV1";
import { findMarker, MARKER_GROUP_ORDER, markersFor } from "../markerCatalog";

const FEMALE_GATED = [
  { key: "fsh", loinc: "15067-2" },
  { key: "estradiol", loinc: "2243-4" },
] as const;

const ANDROGEN_PANEL = [
  { key: "free_testosterone", loinc: "2991-8" },
  { key: "shbg", loinc: "13967-5" },
  { key: "dhea_s", loinc: "2191-5" },
] as const;

const ALL_HORMONES = [...FEMALE_GATED, ...ANDROGEN_PANEL];

describe("hormone markers — catalog presence + NLM-verified LOINC", () => {
  it.each(ALL_HORMONES)(
    "$key exists, is provisional, group Hormones, biomarker, LOINC $loinc",
    ({ key, loinc }) => {
      const m = findMarker(key);
      expect(m).toBeDefined();
      expect(m?.provisional).toBe(true);
      expect(m?.group).toBe("Hormones");
      expect(m?.category).toBe("biomarker");
      expect(m?.fields).toHaveLength(1);
      expect(m?.fields[0].loinc).toBe(loinc);
    },
  );

  it("the Hormones group is in the picker order", () => {
    expect(MARKER_GROUP_ORDER).toContain("Hormones");
  });
});

describe("hormone markers — cohort gating (sex_at_birth)", () => {
  it("FSH + estradiol are FEMALE-gated (offered to females only)", () => {
    const female = markersFor("female").map((m) => m.key);
    for (const { key } of FEMALE_GATED) expect(female).toContain(key);
    for (const sex of ["male", "intersex", "unknown", null] as const) {
      const keys = markersFor(sex).map((m) => m.key);
      for (const { key } of FEMALE_GATED) expect(keys).not.toContain(key);
    }
  });

  it("the androgen panel (free-T, SHBG, DHEA-S) is UNIVERSAL — every cohort", () => {
    for (const sex of ["male", "female", "intersex", "unknown", null] as const) {
      const keys = markersFor(sex).map((m) => m.key);
      for (const { key } of ANDROGEN_PANEL) expect(keys).toContain(key);
    }
  });
});

describe("hormone markers — band-less (no reference range hardcoded)", () => {
  it("NONE of the hormone LOINCs has an interpretation-table biomarker entry", () => {
    // Clinical-content gate: no reference range ships in code. A reading renders
    // against the uploaded report's own printed range (or a future reviewer-
    // sourced, cited entry) — never a range from recall.
    for (const { loinc } of ALL_HORMONES) {
      expect(INTERPRETATION_TABLE_V1.biomarkers[loinc]).toBeUndefined();
    }
  });
});

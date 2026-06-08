/**
 * Pure-helper tests for the Wave-2 input primitives.
 *
 * Covers SliderInput math, LikertInput validation, AutocompleteInput
 * filter logic, the "use my own wording" builder, and the structured
 * family-history record/metadata round-trip.
 */
import { describe, expect, it } from "vitest";

import {
  buildFamilyHistoryRecord,
  buildOtherSelection,
  canSaveFamilyHistory,
  clamp,
  familyHistoryMetadataJson,
  filterAutocomplete,
  isValidLikertValue,
  normalizeForMatch,
  parseFamilyHistoryMetadata,
  sliderStepCount,
  snapToStep,
  valueAtStepIndex,
  type FamilyHistoryDraft,
} from "@/onboarding/inputs/helpers";
import { CONDITIONS_45_PLUS, SYMPTOMS } from "@/onboarding/vocab";

describe("SliderInput helpers", () => {
  describe("clamp", () => {
    it("returns the value when in range", () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });
    it("clamps below min", () => {
      expect(clamp(-1, 0, 10)).toBe(0);
    });
    it("clamps above max", () => {
      expect(clamp(99, 0, 10)).toBe(10);
    });
    it("returns min for non-finite inputs", () => {
      expect(clamp(NaN, 0, 10)).toBe(0);
      expect(clamp(Infinity, 0, 10)).toBe(10);
    });
  });

  describe("snapToStep", () => {
    it("snaps integer step 1", () => {
      expect(snapToStep(4.4, 0, 1)).toBe(4);
      expect(snapToStep(4.6, 0, 1)).toBe(5);
    });
    it("snaps fractional step without FP drift", () => {
      // 0.1 step is the classic JS FP trap.
      expect(snapToStep(0.3, 0, 0.1)).toBe(0.3);
      expect(snapToStep(1.7, 1, 0.1)).toBe(1.7);
      // The result must NOT be 0.30000000000000004.
      expect(String(snapToStep(0.3, 0, 0.1))).toBe("0.3");
    });
    it("snaps half-step (0.5)", () => {
      expect(snapToStep(15.7, 15, 0.5)).toBe(15.5);
      expect(snapToStep(15.8, 15, 0.5)).toBe(16);
    });
    it("returns value unchanged when step is 0 or negative", () => {
      expect(snapToStep(5, 0, 0)).toBe(5);
      expect(snapToStep(5, 0, -1)).toBe(5);
    });
  });

  describe("sliderStepCount", () => {
    it("0..10 step 1 → 11 positions", () => {
      expect(sliderStepCount(0, 10, 1)).toBe(11);
    });
    it("0..6 step 0.5 → 13 positions", () => {
      expect(sliderStepCount(0, 6, 0.5)).toBe(13);
    });
    it("returns 0 for invalid range", () => {
      expect(sliderStepCount(10, 0, 1)).toBe(0);
      expect(sliderStepCount(0, 10, 0)).toBe(0);
      expect(sliderStepCount(0, 10, -1)).toBe(0);
    });
  });

  describe("valueAtStepIndex", () => {
    it("returns endpoint at index 0", () => {
      expect(valueAtStepIndex(0, 1, 0)).toBe(0);
      expect(valueAtStepIndex(5, 0.5, 0)).toBe(5);
    });
    it("returns the right value for a mid index", () => {
      expect(valueAtStepIndex(0, 1, 5)).toBe(5);
      expect(valueAtStepIndex(0, 0.5, 4)).toBe(2);
    });
  });
});

describe("LikertInput helpers", () => {
  describe("isValidLikertValue", () => {
    it("accepts in-range integer", () => {
      expect(isValidLikertValue(0, 4)).toBe(true);
      expect(isValidLikertValue(3, 4)).toBe(true);
    });
    it("rejects out-of-range or non-integer", () => {
      expect(isValidLikertValue(4, 4)).toBe(false);
      expect(isValidLikertValue(-1, 4)).toBe(false);
      expect(isValidLikertValue(1.5, 4)).toBe(false);
    });
    it("rejects when option count is 0 or negative", () => {
      expect(isValidLikertValue(0, 0)).toBe(false);
      expect(isValidLikertValue(0, -1)).toBe(false);
    });
  });
});

describe("AutocompleteInput helpers", () => {
  describe("normalizeForMatch", () => {
    it("lowercases", () => {
      expect(normalizeForMatch("Hypertension")).toBe("hypertension");
    });
    it("trims", () => {
      expect(normalizeForMatch("  foo  ")).toBe("foo");
    });
    it("returns empty for non-string", () => {
      expect(normalizeForMatch(123 as unknown as string)).toBe("");
    });
  });

  describe("filterAutocomplete", () => {
    it("returns all entries when query is empty", () => {
      const out = filterAutocomplete(CONDITIONS_45_PLUS, "");
      expect(out.length).toBe(CONDITIONS_45_PLUS.length);
    });

    it("applies limit when query is empty", () => {
      const out = filterAutocomplete(CONDITIONS_45_PLUS, "", 5);
      expect(out.length).toBe(5);
    });

    it("matches case-insensitive substring on display", () => {
      const out = filterAutocomplete(CONDITIONS_45_PLUS, "diabetes");
      expect(out.length).toBeGreaterThan(0);
      for (const e of out) {
        const hay = (
          e.display +
          " " +
          (e.aliases ?? []).join(" ")
        ).toLowerCase();
        expect(hay).toContain("diabetes");
      }
    });

    it("matches on aliases", () => {
      // "htn" appears only in hypertension's aliases, not its display.
      const out = filterAutocomplete(CONDITIONS_45_PLUS, "htn");
      expect(out.length).toBeGreaterThan(0);
      expect(out.some((e) => e.code === "I10")).toBe(true);
    });

    it("respects the limit cap", () => {
      const out = filterAutocomplete(CONDITIONS_45_PLUS, "", 3);
      expect(out.length).toBe(3);
    });

    it("returns empty when no match", () => {
      const out = filterAutocomplete(CONDITIONS_45_PLUS, "definitelynotacondition");
      expect(out.length).toBe(0);
    });
  });

  describe("buildOtherSelection", () => {
    it("returns null for empty input", () => {
      expect(buildOtherSelection("")).toBeNull();
      expect(buildOtherSelection("   ")).toBeNull();
    });
    it("returns null when slug would be empty (all non-alphanumeric)", () => {
      expect(buildOtherSelection("!!!")).toBeNull();
    });
    it("builds a stable code from text", () => {
      const sel = buildOtherSelection("My weird symptom");
      expect(sel).not.toBeNull();
      expect(sel?.code).toBe("denali.user.my_weird_symptom");
      expect(sel?.code_system).toBe("internal");
      expect(sel?.display).toBe("My weird symptom");
      expect(sel?.isUncoded).toBe(true);
    });
    it("trims slug to 60 chars", () => {
      const long = "a".repeat(200);
      const sel = buildOtherSelection(long);
      expect(sel?.code.startsWith("denali.user.")).toBe(true);
      // 60 char limit applied after the prefix.
      expect(sel?.code.length).toBeLessThanOrEqual("denali.user.".length + 60);
    });
  });
});

describe("Family history helpers", () => {
  const cardiacSelection = {
    code: "I50.9",
    code_system: "ICD10" as const,
    display: "Heart failure",
  };

  it("canSaveFamilyHistory requires relation + selection", () => {
    expect(
      canSaveFamilyHistory({ relation: null, selection: null, onsetAge: null }),
    ).toBe(false);
    expect(
      canSaveFamilyHistory({
        relation: "parent",
        selection: null,
        onsetAge: null,
      }),
    ).toBe(false);
    expect(
      canSaveFamilyHistory({
        relation: null,
        selection: cardiacSelection,
        onsetAge: null,
      }),
    ).toBe(false);
    expect(
      canSaveFamilyHistory({
        relation: "parent",
        selection: cardiacSelection,
        onsetAge: null,
      }),
    ).toBe(true);
  });

  it("buildFamilyHistoryRecord returns null for incomplete drafts", () => {
    expect(
      buildFamilyHistoryRecord({
        relation: null,
        selection: null,
        onsetAge: null,
      }),
    ).toBeNull();
  });

  it("buildFamilyHistoryRecord captures onset_age when set", () => {
    const draft: FamilyHistoryDraft = {
      relation: "parent",
      selection: cardiacSelection,
      onsetAge: 62,
    };
    const r = buildFamilyHistoryRecord(draft);
    expect(r).not.toBeNull();
    expect(r?.relation).toBe("parent");
    expect(r?.conditionCode).toBe("I50.9");
    expect(r?.conditionCodeSystem).toBe("ICD10");
    expect(r?.conditionDisplay).toBe("Heart failure");
    expect(r?.conditionIsUncoded).toBe(false);
    expect(r?.onsetAge).toBe(62);
  });

  it("buildFamilyHistoryRecord normalizes invalid onset_age to null", () => {
    const draft: FamilyHistoryDraft = {
      relation: "sibling",
      selection: cardiacSelection,
      onsetAge: NaN,
    };
    const r = buildFamilyHistoryRecord(draft);
    expect(r?.onsetAge).toBeNull();
  });

  it("buildFamilyHistoryRecord flags uncoded selections", () => {
    const draft: FamilyHistoryDraft = {
      relation: "aunt_or_uncle",
      selection: {
        code: "denali.user.something_unusual",
        code_system: "internal",
        display: "Something unusual",
        isUncoded: true,
      },
      onsetAge: 70,
    };
    const r = buildFamilyHistoryRecord(draft);
    expect(r?.conditionIsUncoded).toBe(true);
    expect(r?.conditionCodeSystem).toBe("internal");
  });

  it("metadata round-trips through JSON", () => {
    const draft: FamilyHistoryDraft = {
      relation: "parent",
      selection: cardiacSelection,
      onsetAge: 62,
    };
    const record = buildFamilyHistoryRecord(draft);
    expect(record).not.toBeNull();
    if (record == null) return;
    const json = familyHistoryMetadataJson(record);
    const parsed = parseFamilyHistoryMetadata(json);
    expect(parsed).not.toBeNull();
    expect(parsed?.relation).toBe("parent");
    expect(parsed?.onset_age).toBe(62);
    expect(parsed?.condition_display).toBe("Heart failure");
    expect(parsed?.condition_is_uncoded).toBe(false);
  });

  it("metadata round-trips with null onset_age", () => {
    const draft: FamilyHistoryDraft = {
      relation: "child",
      selection: cardiacSelection,
      onsetAge: null,
    };
    const record = buildFamilyHistoryRecord(draft);
    if (record == null) throw new Error("expected non-null record");
    const json = familyHistoryMetadataJson(record);
    const parsed = parseFamilyHistoryMetadata(json);
    expect(parsed?.onset_age).toBeNull();
  });

  it("parseFamilyHistoryMetadata rejects malformed JSON", () => {
    expect(parseFamilyHistoryMetadata("not json")).toBeNull();
    expect(parseFamilyHistoryMetadata("{}")).toBeNull();
    expect(parseFamilyHistoryMetadata('{"relation":"parent"}')).toBeNull();
  });
});

describe("Vocabulary integration with autocomplete filter", () => {
  it("CONDITIONS_45_PLUS aliases support common nicknames", () => {
    const cases: ReadonlyArray<[string, string]> = [
      ["high blood pressure", "I10"],
      ["t2d", "E11.9"],
      ["a-fib", "I48.91"],
      ["copd", "J44.9"],
      ["bph", "N40.0"],
    ];
    for (const [query, expectedCode] of cases) {
      const out = filterAutocomplete(CONDITIONS_45_PLUS, query);
      expect(out.some((e) => e.code === expectedCode)).toBe(true);
    }
  });

  it("SYMPTOMS autocomplete picks up common chief-complaint phrasing", () => {
    const cases: ReadonlyArray<[string, string]> = [
      ["tired", "denali.symptom.fatigue"],
      ["chest", "denali.symptom.chest_pain"],
      ["sob", "denali.symptom.shortness_of_breath"],
      ["headache", "denali.symptom.headache"],
    ];
    for (const [query, expectedCode] of cases) {
      const out = filterAutocomplete(SYMPTOMS, query);
      expect(out.some((e) => e.code === expectedCode)).toBe(true);
    }
  });
});

/**
 * Pure-helper tests for the Wave-2 input primitives.
 *
 * Covers SliderInput math, LikertInput validation, AutocompleteInput
 * filter logic, the "use my own wording" builder, and the structured
 * family-history record/metadata round-trip.
 */
import { describe, expect, it } from "vitest";

import {
  assembleNextKeyedAnswers,
  assembleNextResponses,
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
import { AUDIT_C, GAD7, PHQ2 } from "@/onboarding/instruments";
import { CONDITIONS_45_PLUS, SYMPTOMS } from "@/onboarding/vocab";

const PHQ2_POSITIVE_THRESHOLD = 3;

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

// REGRESSION COVERAGE for the closure-safety class found 2026-06-08.
//
// Three auto-advance handlers (CohortOnboardingScreen.handleGenderChange,
// IntakeOnboardingScreen lifestyle inline onChange, InstrumentsScreen
// onMenuSelectResponse + onMoodSelectResponse) previously deferred their
// persist via `Promise.resolve().then(...)` after a setState. The persist
// function captured pre-tap state via closure, so the LAST tap's value
// was missing from the persisted payload.
//
// Cohort surfaced visibly ("Please complete all required answers" dead-
// end on the gender step). Intake lifestyle + Instruments menu + the
// PHQ-2/PHQ-9 expansion were SILENT failures — last response lost, no
// user-visible symptom (except PHQ-9 never expanding when it should).
// These tests are the regression gates for the SILENT halves.
describe("assembleNextResponses (closure-safety: Instruments PHQ + menu)", () => {
  describe("array shape + immutability", () => {
    it("inserts the new value at idx and returns an array of `total` length", () => {
      const result = assembleNextResponses([1, 2, null], 2, 3, 3);
      expect(result).toEqual([1, 2, 3]);
      expect(result.length).toBe(3);
    });

    it("does NOT mutate the prev array", () => {
      const prev: ReadonlyArray<number | null> = [1, null, null];
      const result = assembleNextResponses(prev, 1, 2, 3);
      expect(prev).toEqual([1, null, null]); // unchanged
      expect(result).toEqual([1, 2, null]);
      expect(result).not.toBe(prev);
    });

    it("seeds with all nulls when prev is null/undefined", () => {
      expect(assembleNextResponses(null, 0, 5, 4)).toEqual([5, null, null, null]);
      expect(assembleNextResponses(undefined, 1, 5, 4)).toEqual([
        null,
        5,
        null,
        null,
      ]);
    });

    it("pads with null when prev is shorter than total", () => {
      expect(assembleNextResponses([1, 2], 4, 9, 5)).toEqual([1, 2, null, null, 9]);
    });

    it("truncates when prev is longer than total (defensive)", () => {
      expect(assembleNextResponses([1, 2, 3, 4, 5], 0, 9, 3)).toEqual([9, 2, 3]);
    });
  });

  describe("PHQ-2 → PHQ-9 expansion gate (CLINICAL — was silent failure)", () => {
    // The original bug: the auto-advance handler deferred persist via a
    // microtask. The persist captured pre-tap phqResponses through a
    // useCallback closure, so when the user tapped item 2's value, the
    // captured array still had `null` at index 1. PHQ2.score([2, null])
    // returns null, score >= 3 is false, expansion never fires — a
    // depressed user silently never sees the PHQ-9 + 988 surface.
    //
    // Now assembleNextResponses is called synchronously in the screen
    // and passed explicitly to advanceMoodAfterResponse. These tests
    // simulate the two-tap PHQ-2 sequence and assert the assembled
    // array is what the expansion gate sees.

    // The PHQ shape is the full PHQ-9 length (10 — items 0..8 are PHQ
    // items, the trailing slot is unused buffer that the screen seeds).
    // The screen's actual length doesn't matter to the gate — only
    // slice(0, 2) does. We use 10 here to match the screen.
    const PHQ_LEN = 10;
    const SEED: ReadonlyArray<number | null> = Array.from(
      { length: PHQ_LEN },
      () => null,
    );

    it("two-tap sequence [2, 2] assembles to first-two [2, 2] and EXPANDS", () => {
      const afterTap1 = assembleNextResponses(SEED, 0, 2, PHQ_LEN);
      expect(afterTap1.slice(0, 2)).toEqual([2, null]);

      const afterTap2 = assembleNextResponses(afterTap1, 1, 2, PHQ_LEN);
      // The last value MUST be present — this is the bit the bug lost.
      expect(afterTap2[1]).toBe(2);
      expect(afterTap2.slice(0, 2)).toEqual([2, 2]);

      const score = PHQ2.score(afterTap2.slice(0, 2));
      expect(score).toBe(4);
      expect(score != null && score >= PHQ2_POSITIVE_THRESHOLD).toBe(true);
    });

    it("two-tap sequence [1, 2] hits threshold exactly (sum 3) and EXPANDS", () => {
      const afterTap1 = assembleNextResponses(SEED, 0, 1, PHQ_LEN);
      const afterTap2 = assembleNextResponses(afterTap1, 1, 2, PHQ_LEN);
      const score = PHQ2.score(afterTap2.slice(0, 2));
      expect(score).toBe(3);
      expect(score != null && score >= PHQ2_POSITIVE_THRESHOLD).toBe(true);
    });

    it("two-tap sequence [0, 1] (sum 1) does NOT expand", () => {
      const afterTap1 = assembleNextResponses(SEED, 0, 0, PHQ_LEN);
      const afterTap2 = assembleNextResponses(afterTap1, 1, 1, PHQ_LEN);
      // Last value still present (no closure stale-out).
      expect(afterTap2[1]).toBe(1);
      const score = PHQ2.score(afterTap2.slice(0, 2));
      expect(score).toBe(1);
      expect(score != null && score >= PHQ2_POSITIVE_THRESHOLD).toBe(false);
    });

    it("two-tap sequence [1, 1] (sum 2) does NOT expand", () => {
      const afterTap1 = assembleNextResponses(SEED, 0, 1, PHQ_LEN);
      const afterTap2 = assembleNextResponses(afterTap1, 1, 1, PHQ_LEN);
      expect(afterTap2[1]).toBe(1);
      const score = PHQ2.score(afterTap2.slice(0, 2));
      expect(score).toBe(2);
      expect(score != null && score >= PHQ2_POSITIVE_THRESHOLD).toBe(false);
    });

    it("regression: pre-fix simulation — if last value were lost (left null), PHQ-2 score is null + NO expansion", () => {
      // This shows what the original bug produced. Kept as a "do not
      // let it come back" anchor: any future regression that drops the
      // last value would produce this scoring outcome.
      const broken = assembleNextResponses(SEED, 0, 2, PHQ_LEN); // only item 1 set
      expect(broken[1]).toBeNull();
      const score = PHQ2.score(broken.slice(0, 2));
      expect(score).toBeNull();
      // Gate's truthy check: score != null && score >= threshold.
      expect(score != null && score >= PHQ2_POSITIVE_THRESHOLD).toBe(false);
    });
  });

  describe("Menu instrument last-item present (GAD-7 / AUDIT-C)", () => {
    // The same closure-safety pattern applies to the menu instruments.
    // The bug would have dropped the last item's value when tapped via
    // auto-advance, so persistInstrument would write null for that
    // item's observation. These tests assert the assembled array has
    // every slot filled when all N items are tapped in sequence.

    function simulateFullSequence(
      itemCount: number,
      values: ReadonlyArray<number>,
    ): Array<number | null> {
      if (values.length !== itemCount) {
        throw new Error("test setup error: values.length must equal itemCount");
      }
      let acc: ReadonlyArray<number | null> = Array.from(
        { length: itemCount },
        () => null,
      );
      for (let i = 0; i < itemCount; i++) {
        acc = assembleNextResponses(acc, i, values[i], itemCount);
      }
      return acc as Array<number | null>;
    }

    it("GAD-7 (7 items) — last item present and array fully populated", () => {
      const total = GAD7.items.length;
      const responses = [3, 2, 1, 0, 1, 2, 3]; // arbitrary
      const result = simulateFullSequence(total, responses);
      expect(total).toBe(7);
      expect(result.length).toBe(7);
      expect(result[total - 1]).toBe(3); // last item present
      expect(result).toEqual(responses);
      expect(result.some((v) => v === null)).toBe(false);
    });

    it("AUDIT-C (3 items) — last item present", () => {
      const total = AUDIT_C.items.length;
      const responses = [0, 1, 2];
      const result = simulateFullSequence(total, responses);
      expect(total).toBe(3);
      expect(result[total - 1]).toBe(2);
      expect(result).toEqual(responses);
    });
  });

  describe("PHQ-9 modal-ack path: single clean assembly (once-only persist gate)", () => {
    // The 988-modal acknowledgement commits item 9's value via
    // acknowledge988(): setPhqResponses + setPendingItem9(null) batch in
    // one React commit. The line-380 effect then fires once with the
    // full array, calling advanceMoodAfterResponse(8, phqResponses).
    //
    // From a pure-helper standpoint, what we can assert here is that
    // the assembled snapshot is a SINGLE, CLEAN nine-element array with
    // every PHQ-9 slot populated — no duplicate slots, no nulls in the
    // first 9. The "once-only persist" itself is a stateful guarantee
    // resting on React 18+ event-handler batching + the effect's
    // `!moodDone` gate (flagged separately).
    it("simulating all 9 PHQ-9 taps + modal-ack item 9 yields a complete 9-slot array", () => {
      const PHQ_LEN = 10;
      const SEED: ReadonlyArray<number | null> = Array.from(
        { length: PHQ_LEN },
        () => null,
      );
      // Taps 1..8 (sync path).
      let acc: ReadonlyArray<number | null> = SEED;
      const itemValues = [2, 2, 1, 0, 1, 2, 1, 0]; // arbitrary PHQ-9 responses for items 1..8
      for (let i = 0; i < 8; i++) {
        acc = assembleNextResponses(acc, i, itemValues[i], PHQ_LEN);
      }
      // Modal-acknowledged item 9 (acknowledge988 effectively does the same insert).
      acc = assembleNextResponses(acc, 8, 1, PHQ_LEN);

      // Single clean nine-slot assembly — no missed slot, no double-set.
      const phq9Slice = acc.slice(0, 9);
      expect(phq9Slice.length).toBe(9);
      expect(phq9Slice.some((v) => v === null)).toBe(false);
      expect(phq9Slice).toEqual([2, 2, 1, 0, 1, 2, 1, 0, 1]);
    });
  });
});

describe("assembleNextKeyedAnswers (closure-safety: Intake lifestyle)", () => {
  // The lifestyle bug was: the auto-advance microtask called
  // persistLifestyle which closure-read `lifestyle` from the pre-tap
  // render, so the just-tapped value (the LAST lifestyle question's
  // response) was missing from the persisted DAL observation. These
  // tests pin the snapshot helper that replaced that.
  it("inserts the new value at key and returns a fresh object", () => {
    const prev = { smoking: 0, alcohol: null as number | null, exercise: 2 };
    const result = assembleNextKeyedAnswers(prev, "alcohol", 1);
    expect(result).toEqual({ smoking: 0, alcohol: 1, exercise: 2 });
    expect(result).not.toBe(prev);
  });

  it("does NOT mutate the prev object", () => {
    const prev = { a: 0, b: null as number | null };
    const result = assembleNextKeyedAnswers(prev, "b", 5);
    expect(prev).toEqual({ a: 0, b: null });
    expect(result).toEqual({ a: 0, b: 5 });
  });

  it("preserves all OTHER keys when setting one", () => {
    const prev = {
      smoking: 1,
      alcohol: 0,
      exercise: 2,
      sleep: 3,
      caffeine: null as number | null,
    };
    const result = assembleNextKeyedAnswers(prev, "caffeine", 4);
    // Every prior key still present and unchanged.
    expect(result.smoking).toBe(1);
    expect(result.alcohol).toBe(0);
    expect(result.exercise).toBe(2);
    expect(result.sleep).toBe(3);
    expect(result.caffeine).toBe(4); // the just-tapped key
  });

  it("last-tap regression: simulating the lifestyle sequence preserves the FINAL value in the snapshot passed to persist", () => {
    // Mirrors the screen flow: user taps lifestyle questions in order;
    // each tap computes nextLifestyle via this helper and passes it to
    // finishSection / persistLifestyle. On the last tap, the snapshot
    // passed to persist MUST include the just-tapped value (the bug
    // was that closure-captured `lifestyle` lagged behind).
    const PROMPTS = [
      "smoking",
      "alcohol",
      "exercise",
      "sleep",
      "caffeine",
    ] as const;
    const RESPONSES = [0, 1, 2, 3, 4];
    let acc: Record<string, number | null> = Object.fromEntries(
      PROMPTS.map((k) => [k, null]),
    );
    for (let i = 0; i < PROMPTS.length; i++) {
      acc = assembleNextKeyedAnswers(acc, PROMPTS[i], RESPONSES[i]);
    }
    // The snapshot the persist function receives on the final tap.
    expect(acc["caffeine"]).toBe(4);
    // No nulls remain.
    expect(Object.values(acc).some((v) => v === null)).toBe(false);
    // All in order.
    expect(acc).toEqual({
      smoking: 0,
      alcohol: 1,
      exercise: 2,
      sleep: 3,
      caffeine: 4,
    });
  });
});

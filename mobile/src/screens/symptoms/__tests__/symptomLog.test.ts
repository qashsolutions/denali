/**
 * Symptom logging — the append-only observation builder + the severity guard.
 * Mirrors markers/markerEntry.ts coverage: a logged symptom commits as ONE
 * observation with value_num (0–3 severity, for the band-less trend) and
 * value_text (the label). No score, no interpretation.
 */
import { describe, expect, it } from "vitest";

import { findSymptomByCode, SYMPTOM_CATALOG, symptomCode } from "../symptomCatalog";
import { buildSymptomObservation, isValidSeverity } from "../symptomLog";

const hotFlashes = SYMPTOM_CATALOG.find((s) => s.key === "hot_flashes")!;

describe("isValidSeverity", () => {
  it("accepts integers 0..3", () => {
    for (const v of [0, 1, 2, 3]) expect(isValidSeverity(v)).toBe(true);
  });

  it("rejects out-of-range + non-integers", () => {
    for (const v of [-1, 4, 1.5, NaN, Infinity]) {
      expect(isValidSeverity(v)).toBe(false);
    }
  });
});

describe("buildSymptomObservation", () => {
  it("builds an append-only symptom observation with the right shape", () => {
    const obs = buildSymptomObservation({
      symptom: hotFlashes,
      severity: 2,
      userId: "u1",
      effectiveAt: "2026-07-04T00:00:00.000Z",
    });
    expect(obs).toMatchObject({
      user_id: "u1",
      category: "symptom",
      code_system: "internal",
      code: "denali.symptom.menopause.hot_flashes",
      display: "Hot flashes",
      value_num: 2,
      value_text: "Moderate",
      unit: null,
      source: "self_reported",
      effective_at: "2026-07-04T00:00:00.000Z",
      report_id: null,
      supersedes_id: null,
    });
  });

  it("value_num carries the 0–3 severity (for the trend); value_text the label", () => {
    const none = buildSymptomObservation({
      symptom: hotFlashes,
      severity: 0,
      userId: "u",
      effectiveAt: "2026-07-04T00:00:00.000Z",
    });
    expect(none.value_num).toBe(0);
    expect(none.value_text).toBe("None");
  });

  it("code round-trips through findSymptomByCode", () => {
    const obs = buildSymptomObservation({
      symptom: hotFlashes,
      severity: 1,
      userId: "u",
      effectiveAt: "2026-07-04T00:00:00.000Z",
    });
    expect(obs.code).toBe(symptomCode(hotFlashes));
    expect(findSymptomByCode(obs.code)?.key).toBe("hot_flashes");
  });

  it("throws on an invalid severity (never stores a bad reading)", () => {
    expect(() =>
      buildSymptomObservation({
        symptom: hotFlashes,
        severity: 5,
        userId: "u",
        effectiveAt: "2026-07-04T00:00:00.000Z",
      }),
    ).toThrow(/severity/i);
  });

  it("metadata_json carries symptomKey + domain + severityLabel", () => {
    const obs = buildSymptomObservation({
      symptom: hotFlashes,
      severity: 3,
      userId: "u",
      effectiveAt: "2026-07-04T00:00:00.000Z",
    });
    const meta = JSON.parse(obs.metadata_json ?? "{}");
    expect(meta).toMatchObject({
      symptomKey: "hot_flashes",
      domain: "menopause",
      severityLabel: "Severe",
    });
  });
});

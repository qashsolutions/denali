/**
 * Vocabulary integrity tests.
 *
 * Asserts that the curated lists conform to their conventions so a
 * future contributor adding a new entry can't silently break the
 * autocomplete or downstream observation insert.
 *
 * Convention checks:
 *   - CONDITIONS_45_PLUS: every entry has code_system="ICD10", code
 *     matches an ICD-10-CM shape, and codes are unique within the list.
 *   - SYMPTOMS: every entry has code_system="internal", code starts
 *     with "denali.symptom.", and codes are unique.
 */
import { describe, expect, it } from "vitest";

import { CONDITIONS_45_PLUS, SYMPTOMS } from "@/onboarding/vocab";

// ICD-10-CM codes: 1 letter, 2 digits, optional dot + 1-4 alphanumerics.
// e.g., "I10", "E11.9", "R73.03", "J45.909", "G47.33".
const ICD10_RE = /^[A-Z][0-9]{2}(?:\.[A-Z0-9]{1,4})?$/;
const SYMPTOM_PREFIX = "denali.symptom.";

describe("CONDITIONS_45_PLUS vocab integrity", () => {
  it("has a reasonable size (20+ entries)", () => {
    expect(CONDITIONS_45_PLUS.length).toBeGreaterThanOrEqual(20);
  });

  it("every entry uses code_system='ICD10'", () => {
    for (const e of CONDITIONS_45_PLUS) {
      expect(e.code_system).toBe("ICD10");
    }
  });

  it("every code matches the ICD-10-CM shape", () => {
    for (const e of CONDITIONS_45_PLUS) {
      expect(e.code).toMatch(ICD10_RE);
    }
  });

  it("codes are unique", () => {
    const seen = new Set<string>();
    for (const e of CONDITIONS_45_PLUS) {
      expect(seen.has(e.code)).toBe(false);
      seen.add(e.code);
    }
  });

  it("every entry has a non-empty display label", () => {
    for (const e of CONDITIONS_45_PLUS) {
      expect(e.display.trim().length).toBeGreaterThan(0);
    }
  });

  it("includes common 45+ conditions (hypertension, T2D, prediabetes, dyslipidemia, asthma, COPD, CKD, depression, anxiety)", () => {
    const required = [
      "I10",
      "E11.9",
      "R73.03",
      "E78.5",
      "J45.909",
      "J44.9",
      "N18.9",
      "F32.9",
      "F41.9",
    ];
    for (const code of required) {
      expect(CONDITIONS_45_PLUS.some((e) => e.code === code)).toBe(true);
    }
  });
});

describe("SYMPTOMS vocab integrity", () => {
  it("has a reasonable size (25+ entries)", () => {
    expect(SYMPTOMS.length).toBeGreaterThanOrEqual(25);
  });

  it("every entry uses code_system='internal'", () => {
    for (const e of SYMPTOMS) {
      expect(e.code_system).toBe("internal");
    }
  });

  it("every code starts with 'denali.symptom.'", () => {
    for (const e of SYMPTOMS) {
      expect(e.code.startsWith(SYMPTOM_PREFIX)).toBe(true);
    }
  });

  it("every code's slug uses only [a-z0-9_]", () => {
    for (const e of SYMPTOMS) {
      const slug = e.code.slice(SYMPTOM_PREFIX.length);
      expect(slug).toMatch(/^[a-z0-9_]+$/);
    }
  });

  it("codes are unique", () => {
    const seen = new Set<string>();
    for (const e of SYMPTOMS) {
      expect(seen.has(e.code)).toBe(false);
      seen.add(e.code);
    }
  });

  it("includes common chief complaints (fatigue, headache, chest pain, SOB)", () => {
    const required = [
      "denali.symptom.fatigue",
      "denali.symptom.headache",
      "denali.symptom.chest_pain",
      "denali.symptom.shortness_of_breath",
    ];
    for (const code of required) {
      expect(SYMPTOMS.some((e) => e.code === code)).toBe(true);
    }
  });
});

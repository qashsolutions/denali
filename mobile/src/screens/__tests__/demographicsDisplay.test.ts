/**
 * demographicsDisplay tests — Settings "Your details" labels (D31).
 */

import { describe, expect, it } from "vitest";

import {
  ageFromBirthYear,
  birthYearLabel,
  GENDER_IDENTITY_VALUES,
  genderIdentityLabel,
  medicareLabel,
  NOT_SET_LABEL,
  sexAtBirthLabel,
} from "../demographicsDisplay";

describe("GENDER_IDENTITY_VALUES (Settings editable picker)", () => {
  it("lists all 7 gender options, each with a non-placeholder label", () => {
    expect(GENDER_IDENTITY_VALUES).toHaveLength(7);
    expect(new Set(GENDER_IDENTITY_VALUES).size).toBe(7); // no dupes
    for (const v of GENDER_IDENTITY_VALUES) {
      expect(genderIdentityLabel(v)).not.toBe(NOT_SET_LABEL);
    }
  });
});

describe("sexAtBirthLabel", () => {
  it.each([
    ["male", "Male"],
    ["female", "Female"],
    ["intersex", "Intersex"],
    ["unknown", "Prefer not to say"],
  ] as const)("%s → %s", (v, label) => {
    expect(sexAtBirthLabel(v)).toBe(label);
  });
  it("null → Not set", () => {
    expect(sexAtBirthLabel(null)).toBe(NOT_SET_LABEL);
  });
});

describe("genderIdentityLabel", () => {
  it.each([
    ["male", "Male"],
    ["non-binary", "Non-binary"],
    ["transgender-male", "Transgender male"],
    ["prefer-not-to-say", "Prefer not to say"],
  ] as const)("%s → %s", (v, label) => {
    expect(genderIdentityLabel(v)).toBe(label);
  });
  it("null → Not set", () => {
    expect(genderIdentityLabel(null)).toBe(NOT_SET_LABEL);
  });
});

describe("ageFromBirthYear", () => {
  it("derives whole-year age from the current year", () => {
    expect(ageFromBirthYear(1965, 2026)).toBe(61);
  });
  it("null birth year → null", () => {
    expect(ageFromBirthYear(null, 2026)).toBeNull();
  });
  it("implausible age (future year / >130) → null", () => {
    expect(ageFromBirthYear(2030, 2026)).toBeNull();
    expect(ageFromBirthYear(1800, 2026)).toBeNull();
  });
});

describe("birthYearLabel", () => {
  it("year · age when plausible", () => {
    expect(birthYearLabel(1965, 2026)).toBe("1965 · age 61");
  });
  it("bare year when age implausible", () => {
    expect(birthYearLabel(1800, 2026)).toBe("1800");
  });
  it("null → Not set", () => {
    expect(birthYearLabel(null, 2026)).toBe(NOT_SET_LABEL);
  });
});

describe("medicareLabel", () => {
  it.each([
    [true, "Yes"],
    [false, "No"],
  ] as const)("%s → %s", (v, label) => {
    expect(medicareLabel(v)).toBe(label);
  });
  it("null → Not set", () => {
    expect(medicareLabel(null)).toBe(NOT_SET_LABEL);
  });
});

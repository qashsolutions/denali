import { describe, expect, it } from "vitest";

import {
  buildCohortPayload,
  canSubmitCohort,
} from "../cohortPayload";

describe("canSubmitCohort", () => {
  const baseValid = {
    birthYear: 1965,
    sexAtBirth: "male" as const,
    isOnMedicare: false,
    currentYear: 2026,
  };

  it("returns true when all required fields are present and valid", () => {
    expect(canSubmitCohort(baseValid)).toBe(true);
  });

  it("returns false when sex_at_birth is null", () => {
    expect(canSubmitCohort({ ...baseValid, sexAtBirth: null })).toBe(false);
  });

  it("returns false when is_on_medicare is null", () => {
    expect(canSubmitCohort({ ...baseValid, isOnMedicare: null })).toBe(false);
  });

  it("returns false when birth_year is null", () => {
    expect(canSubmitCohort({ ...baseValid, birthYear: null })).toBe(false);
  });

  it("rejects birth_year < 1900", () => {
    expect(canSubmitCohort({ ...baseValid, birthYear: 1899 })).toBe(false);
  });

  it("rejects birth_year > current year", () => {
    expect(canSubmitCohort({ ...baseValid, birthYear: 2027 })).toBe(false);
  });

  it("rejects non-integer birth_year", () => {
    expect(canSubmitCohort({ ...baseValid, birthYear: 1965.5 })).toBe(false);
  });

  it("accepts boundary birth_year = 1900", () => {
    expect(canSubmitCohort({ ...baseValid, birthYear: 1900 })).toBe(true);
  });

  it("accepts boundary birth_year = current year", () => {
    expect(canSubmitCohort({ ...baseValid, birthYear: 2026 })).toBe(true);
  });
});

describe("buildCohortPayload", () => {
  it("includes required fields", () => {
    const payload = buildCohortPayload({
      birthYear: 1965,
      sexAtBirth: "male",
      isOnMedicare: false,
      genderIdentity: null,
    });
    expect(payload).toEqual({
      birth_year: 1965,
      is_on_medicare: false,
      sex_at_birth: "male",
    });
  });

  it("omits gender_identity when null (additive PATCH)", () => {
    const payload = buildCohortPayload({
      birthYear: 1965,
      sexAtBirth: "male",
      isOnMedicare: false,
      genderIdentity: null,
    });
    expect(payload).not.toHaveProperty("gender_identity");
  });

  it("includes gender_identity when set", () => {
    const payload = buildCohortPayload({
      birthYear: 1965,
      sexAtBirth: "male",
      isOnMedicare: false,
      genderIdentity: "non-binary",
    });
    expect(payload.gender_identity).toBe("non-binary");
  });

  it("propagates is_on_medicare = true", () => {
    const payload = buildCohortPayload({
      birthYear: 1955,
      sexAtBirth: "female",
      isOnMedicare: true,
      genderIdentity: null,
    });
    expect(payload.is_on_medicare).toBe(true);
  });
});

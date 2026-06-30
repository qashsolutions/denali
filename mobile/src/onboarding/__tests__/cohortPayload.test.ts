import { describe, expect, it } from "vitest";

import {
  buildCohortPayload,
  canSubmitCohort,
  decideCohortSubmission,
  missingCohortFieldMessage,
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

// REGRESSION: stale-closure dead-end on the gender step (2026-06-08).
// The screen previously memoized its gender-tap handler with `[]` deps and
// an eslint-disable suppression, which captured a submitWithGender closure
// holding the initial-mount nulls. When the user picked a gender on the
// last step, the handler called the stale closure, the closure re-read the
// captured-null state, canSubmitCohort returned false, and the user got
// "Please complete all required answers" despite having answered them.
//
// `decideCohortSubmission` is the pure helper that replaced that pattern:
// it takes live form state as explicit args (closures cannot capture what
// they aren't given). These tests exercise the helper directly — if the
// future screen wiring ever regresses, these tests still pass on the
// helper, so the screen-level regression test is the inverse half (an
// integration test would be the other half, deferred to Playwright per
// docs/reference/testing.md).
describe("decideCohortSubmission (closure-safety regression)", () => {
  const baseValid = {
    birthYear: 1965,
    sexAtBirth: "male" as const,
    isOnMedicare: true,
    currentYear: 2026,
  };

  it("returns ready with a built payload when all required filled + gender picked", () => {
    const r = decideCohortSubmission({
      ...baseValid,
      genderIdentity: "male",
    });
    expect(r.kind).toBe("ready");
    if (r.kind === "ready") {
      expect(r.payload).toEqual({
        birth_year: 1965,
        is_on_medicare: true,
        sex_at_birth: "male",
        gender_identity: "male",
      });
    }
  });

  it("returns ready with gender_identity OMITTED on the skip path", () => {
    const r = decideCohortSubmission({
      ...baseValid,
      genderIdentity: null,
    });
    expect(r.kind).toBe("ready");
    if (r.kind === "ready") {
      expect(r.payload).not.toHaveProperty("gender_identity");
      expect(r.payload).toEqual({
        birth_year: 1965,
        is_on_medicare: true,
        sex_at_birth: "male",
      });
    }
  });

  it('returns missing "birth_year" when birthYear null', () => {
    const r = decideCohortSubmission({
      ...baseValid,
      birthYear: null,
      genderIdentity: "male",
    });
    expect(r).toEqual({ kind: "missing", field: "birth_year" });
  });

  it('returns missing "sex_at_birth" when sexAtBirth null', () => {
    const r = decideCohortSubmission({
      ...baseValid,
      sexAtBirth: null,
      genderIdentity: "male",
    });
    expect(r).toEqual({ kind: "missing", field: "sex_at_birth" });
  });

  it('returns missing "is_on_medicare" when isOnMedicare null', () => {
    const r = decideCohortSubmission({
      ...baseValid,
      isOnMedicare: null,
      genderIdentity: "male",
    });
    expect(r).toEqual({ kind: "missing", field: "is_on_medicare" });
  });

  it("rejects out-of-range birth_year as missing birth_year", () => {
    expect(
      decideCohortSubmission({
        ...baseValid,
        birthYear: 1899,
        genderIdentity: null,
      }),
    ).toEqual({ kind: "missing", field: "birth_year" });
    expect(
      decideCohortSubmission({
        ...baseValid,
        birthYear: 2027,
        genderIdentity: null,
      }),
    ).toEqual({ kind: "missing", field: "birth_year" });
  });

  it("rejects non-integer birth_year as missing birth_year", () => {
    expect(
      decideCohortSubmission({
        ...baseValid,
        birthYear: 1965.5,
        genderIdentity: null,
      }),
    ).toEqual({ kind: "missing", field: "birth_year" });
  });

  it("checks birth_year first, then sex_at_birth, then is_on_medicare", () => {
    // All three missing — birth_year wins.
    const r = decideCohortSubmission({
      birthYear: null,
      sexAtBirth: null,
      isOnMedicare: null,
      genderIdentity: null,
      currentYear: 2026,
    });
    expect(r).toEqual({ kind: "missing", field: "birth_year" });
  });

  it("uses new Date().getFullYear() as the default currentYear", () => {
    // birthYear at current year minus 1 is always valid (we're past Jan 1).
    const lastYear = new Date().getFullYear() - 1;
    const r = decideCohortSubmission({
      birthYear: lastYear,
      sexAtBirth: "female",
      isOnMedicare: false,
      genderIdentity: null,
      // No currentYear passed.
    });
    expect(r.kind).toBe("ready");
  });
});

describe("missingCohortFieldMessage", () => {
  it("names birth year in plain language", () => {
    expect(missingCohortFieldMessage("birth_year")).toMatch(/birth year/i);
  });
  it("names sex at birth in plain language", () => {
    expect(missingCohortFieldMessage("sex_at_birth")).toMatch(/sex at birth/i);
  });
  it("names Medicare in plain language", () => {
    expect(missingCohortFieldMessage("is_on_medicare")).toMatch(/Medicare/i);
  });
});

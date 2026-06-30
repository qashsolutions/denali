import { describe, expect, it } from "vitest";

import { mapToConditionCategory } from "../conditionMapping";

describe("mapToConditionCategory", () => {
  it("maps 'High blood pressure' -> hypertension", () => {
    expect(mapToConditionCategory("High blood pressure")).toBe("hypertension");
  });

  it("maps 'Type 2 diabetes' -> type2 (longest match wins over 'diabetes')", () => {
    expect(mapToConditionCategory("Type 2 diabetes")).toBe("type2");
  });

  it("maps generic 'diabetes' -> type2 (fallback)", () => {
    expect(mapToConditionCategory("diabetes")).toBe("type2");
  });

  it("maps 'T1D' -> type1", () => {
    expect(mapToConditionCategory("T1D")).toBe("type1");
  });

  it("maps 'pre-diabetes' -> prediabetes", () => {
    expect(mapToConditionCategory("pre-diabetes")).toBe("prediabetes");
  });

  it("maps 'heart attack' -> cvd", () => {
    expect(mapToConditionCategory("heart attack")).toBe("cvd");
  });

  it("maps 'major depressive disorder' -> depression", () => {
    expect(mapToConditionCategory("major depressive disorder")).toBe(
      "depression",
    );
  });

  it("returns null for empty string", () => {
    expect(mapToConditionCategory("")).toBeNull();
  });

  it("returns null for unmapped condition", () => {
    expect(mapToConditionCategory("rheumatoid arthritis")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(mapToConditionCategory("HYPERTENSION")).toBe("hypertension");
    expect(mapToConditionCategory("Hypertension")).toBe("hypertension");
  });

  it("matches substrings (free-form input)", () => {
    expect(mapToConditionCategory("I have high cholesterol since 2010")).toBe(
      "dyslipidemia",
    );
  });
});

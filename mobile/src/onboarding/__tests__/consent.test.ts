import { describe, expect, it } from "vitest";

import {
  canCallAi,
  canEmitAnalytics,
  DEFAULT_CONSENT,
} from "../consent";

describe("canCallAi — load-bearing Bedrock gate", () => {
  it("returns true only for the literal { health_data_ai: true }", () => {
    expect(canCallAi({ health_data_ai: true, health_data_storage: false, analytics: false })).toBe(true);
  });

  it("returns false when health_data_ai === false", () => {
    expect(canCallAi({ health_data_ai: false, health_data_storage: true, analytics: true })).toBe(false);
  });

  it("returns false when consent is null", () => {
    expect(canCallAi(null)).toBe(false);
  });

  it("returns false when consent is undefined", () => {
    expect(canCallAi(undefined)).toBe(false);
  });

  it("DEFAULT_CONSENT is OFF for all three toggles (matches web default)", () => {
    expect(DEFAULT_CONSENT.health_data_ai).toBe(false);
    expect(DEFAULT_CONSENT.health_data_storage).toBe(false);
    expect(DEFAULT_CONSENT.analytics).toBe(false);
  });
});

describe("canEmitAnalytics", () => {
  it("returns true only for the literal { analytics: true }", () => {
    expect(canEmitAnalytics({ health_data_ai: false, health_data_storage: false, analytics: true })).toBe(true);
  });

  it("returns false when analytics is false", () => {
    expect(canEmitAnalytics({ health_data_ai: true, health_data_storage: true, analytics: false })).toBe(false);
  });

  it("returns false when consent is null", () => {
    expect(canEmitAnalytics(null)).toBe(false);
  });
});

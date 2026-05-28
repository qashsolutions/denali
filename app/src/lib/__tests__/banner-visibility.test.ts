import { describe, it, expect } from "vitest";
import { shouldShowMedicareConsentBanner } from "../banner-visibility";

describe("shouldShowMedicareConsentBanner — Stage 2 cohort gate", () => {
  // ── Happy path: confirmed Medicare + connected + consent OFF ──

  it("renders when isOnMedicare=true + isConnected=true + consentHealthDataAi=false", () => {
    expect(shouldShowMedicareConsentBanner(true, true, false)).toBe(true);
  });

  // ── Cohort gate suppression ──

  it("does NOT render when isOnMedicare=false (non-Medicare, even if connected and consent OFF)", () => {
    expect(shouldShowMedicareConsentBanner(false, true, false)).toBe(false);
  });

  it("does NOT render when isOnMedicare=null (user hasn't answered yet)", () => {
    expect(shouldShowMedicareConsentBanner(null, true, false)).toBe(false);
  });

  it("does NOT render when isOnMedicare=undefined", () => {
    expect(shouldShowMedicareConsentBanner(undefined, true, false)).toBe(false);
  });

  // ── Pre-existing gates still apply for Medicare users ──

  it("does NOT render for Medicare user when Blue Button is NOT connected", () => {
    expect(shouldShowMedicareConsentBanner(true, false, false)).toBe(false);
  });

  it("does NOT render for Medicare user when AI consent IS already enabled", () => {
    expect(shouldShowMedicareConsentBanner(true, true, true)).toBe(false);
  });

  it("does NOT render for Medicare user when neither connected nor consent", () => {
    expect(shouldShowMedicareConsentBanner(true, false, true)).toBe(false);
  });

  // ── Strict `=== true` check (defensive against truthy non-boolean) ──

  it("does NOT render when isOnMedicare is some other truthy value (only strict true passes)", () => {
    // The signature types isOnMedicare as boolean|null|undefined, but the
    // runtime check is `=== true`, so any non-boolean truthy would also fail.
    expect(
      shouldShowMedicareConsentBanner(
        1 as unknown as boolean,
        true,
        false,
      ),
    ).toBe(false);
    expect(
      shouldShowMedicareConsentBanner(
        "yes" as unknown as boolean,
        true,
        false,
      ),
    ).toBe(false);
  });
});

/**
 * Trend strings pins — Step-3 Part C (versioned alongside the table).
 *
 * Templates only; no population comparisons, no advice phrasing.
 */
import { describe, expect, it } from "vitest";

import {
  formatBmiTrendDelta,
  formatLastCheckins,
  formatMarkerTrendDelta,
  formatTrendAccessibilityLabel,
  formatTrendDelta,
  TREND_EMPTY_STATE,
  TREND_STRINGS_PROVENANCE,
} from "../trendStrings";

describe("generic marker delta (D28)", () => {
  it("moved fills the approved template with the marker name + value labels", () => {
    expect(
      formatMarkerTrendDelta("Weight", "78 kg", "80 kg", "June 13, 2026"),
    ).toBe("Your Weight moved from 78 kg to 80 kg since June 13, 2026.");
  });

  it("equal display labels read as unchanged (matches what the card shows)", () => {
    expect(
      formatMarkerTrendDelta("Weight", "80 kg", "80 kg", "June 13, 2026"),
    ).toBe("Your Weight is unchanged since June 13, 2026.");
  });

  it("is factual/navigational — no advice or comparison verbs", () => {
    const s = formatMarkerTrendDelta("HDL cholesterol", "50 mg/dL", "58 mg/dL", "May 1, 2026");
    expect(s).not.toMatch(/should|recommend|get tested|normal|high|low|risk/i);
    expect(s).toContain("HDL cholesterol");
  });
});

describe("trend strings — versioned templates", () => {
  it("n=1 quiet state copy is pinned", () => {
    expect(TREND_EMPTY_STATE).toBe(
      "Your trend will appear after your next check-in.",
    );
  });

  it("moved delta fills the approved template", () => {
    expect(formatTrendDelta(5, 3, "April 1, 2026")).toBe(
      "Your score moved from 5 to 3 since April 1, 2026.",
    );
  });

  it("unchanged delta fills the approved template", () => {
    expect(formatTrendDelta(4, 4, "April 1, 2026")).toBe(
      "Your score is unchanged since April 1, 2026.",
    );
  });

  it("accessibility label builds from the same vocabulary", () => {
    expect(
      formatTrendAccessibilityLabel("Anxiety check-in", 3, "Minimal"),
    ).toBe("Anxiety check-in trend chart. Latest score 3, Minimal.");
    expect(
      formatTrendAccessibilityLabel(
        "Anxiety check-in",
        3,
        "Minimal",
        "Your score is unchanged since April 1, 2026.",
      ),
    ).toBe(
      "Anxiety check-in trend chart. Latest score 3, Minimal. Your score is unchanged since April 1, 2026.",
    );
  });

  it("no advice phrasing or population comparisons in any template output", () => {
    const samples = [
      TREND_EMPTY_STATE,
      formatTrendDelta(5, 3, "April 1, 2026"),
      formatTrendDelta(4, 4, "April 1, 2026"),
      formatTrendAccessibilityLabel("Mood check-in", 2, "Minimal"),
    ];
    for (const s of samples) {
      expect(s).not.toMatch(/should|need to|must|recommend|get tested/i);
      expect(s).not.toMatch(/average|typical for people|% of|than others/i);
    }
  });

  it("ships pending clinical review", () => {
    expect(TREND_STRINGS_PROVENANCE.review_status).toBe(
      "pending_clinical_review",
    );
  });

  it("sparkline meta line (Increment 2): plural template + singular form", () => {
    expect(formatLastCheckins(5)).toBe("Last 5 check-ins");
    expect(formatLastCheckins(2)).toBe("Last 2 check-ins");
    expect(formatLastCheckins(1)).toBe("Last check-in");
  });
});

describe("BMI delta strings — versioned templates", () => {
  it("moved delta fills the approved BMI template", () => {
    expect(formatBmiTrendDelta(27.3, 25.1, "April 1, 2026")).toBe(
      "Your BMI moved from 27.3 to 25.1 since April 1, 2026.",
    );
  });

  it("unchanged delta fills the BMI unchanged template", () => {
    expect(formatBmiTrendDelta(24.0, 24.0, "April 1, 2026")).toBe(
      "Your BMI is unchanged since April 1, 2026.",
    );
  });

  it("rounds both values to 1 dp", () => {
    // 27.349... rounds to 27.3; 25.051... rounds to 25.1
    expect(formatBmiTrendDelta(27.349, 25.051, "March 1, 2026")).toBe(
      "Your BMI moved from 27.3 to 25.1 since March 1, 2026.",
    );
  });

  it("treats values as unchanged when they round to the same 1dp string", () => {
    // 24.04 and 24.02 both round to 24.0 — unchanged copy
    expect(formatBmiTrendDelta(24.04, 24.02, "March 1, 2026")).toBe(
      "Your BMI is unchanged since March 1, 2026.",
    );
  });

  it("whole-number BMI values format with .0 suffix", () => {
    expect(formatBmiTrendDelta(25, 22, "February 1, 2026")).toBe(
      "Your BMI moved from 25.0 to 22.0 since February 1, 2026.",
    );
  });

  it("no advice phrasing or population comparisons in BMI delta output", () => {
    const samples = [
      formatBmiTrendDelta(27.3, 25.1, "April 1, 2026"),
      formatBmiTrendDelta(24.0, 24.0, "April 1, 2026"),
    ];
    for (const s of samples) {
      expect(s).not.toMatch(/should|need to|must|recommend|get tested/i);
      expect(s).not.toMatch(/average|typical for people|% of|than others/i);
    }
  });
});

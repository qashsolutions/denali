/**
 * Trend strings pins — Step-3 Part C (versioned alongside the table).
 *
 * Templates only; no population comparisons, no advice phrasing.
 */
import { describe, expect, it } from "vitest";

import {
  formatTrendAccessibilityLabel,
  formatTrendDelta,
  TREND_EMPTY_STATE,
  TREND_STRINGS_PROVENANCE,
} from "../trendStrings";

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
});

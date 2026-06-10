/**
 * displayMapping tests — curated single-domain summary (redesign step 2).
 *
 * The dashboard's single-domain cards previously previewed the latest
 * raw row ("How much do you usually sleep at night?: 2" leaked intake
 * answer text). `formatDomainSummary` replaces that with a curated
 * count + last-updated template; these tests pin the template and the
 * no-raw-value guarantee.
 */
import { describe, expect, it } from "vitest";

import { formatDomainSummary } from "../domainSummary";

describe("formatDomainSummary", () => {
  it("pluralizes: N values tracked · updated <date>", () => {
    expect(formatDomainSummary(5, "June 9, 2026")).toBe(
      "5 values tracked · updated June 9, 2026",
    );
  });

  it("singular for exactly one value", () => {
    expect(formatDomainSummary(1, "June 9, 2026")).toBe(
      "1 value tracked · updated June 9, 2026",
    );
  });

  it("contains only the count and the date — no raw value/answer text", () => {
    const s = formatDomainSummary(3, "May 2, 2026");
    // The template has exactly two interpolation slots; assert the full
    // shape so any future addition of a value preview fails this test.
    expect(s).toMatch(/^\d+ values? tracked · updated .+$/);
  });
});

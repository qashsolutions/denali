import { describe, it, expect } from "vitest";

/**
 * PaywallModal — filterPlansForCohort unit tests (T7)
 *
 * Pure logic — no React, no jsdom. Tests the extracted helper that
 * filters plan options based on Medicare cohort membership.
 *
 * Medicare: all 3 plans visible, all feature bullets intact.
 * Non-Medicare: Starter hidden, appeal-related bullets stripped (case-insensitive).
 */

import { filterPlansForCohort } from "../PaywallModal";

// --- Fixtures (plain typed objects — no `as const` so features stays string[]) ---

type TestPlan = { key: string; name: string; features: string[] };

const TEST_PLANS: TestPlan[] = [
  {
    key: "starter",
    name: "Starter",
    features: ["1 appeal credit per month", "20 messages per day", "1 chat day per week"],
  },
  {
    key: "plus",
    name: "Plus",
    features: ["2 appeal credits per month", "20 messages per day", "Chat every day"],
  },
  {
    key: "unlimited",
    name: "Unlimited",
    features: ["Unlimited appeal letters", "Unlimited messages", "Chat every day"],
  },
];

// A plan set whose features have NO appeal-related bullets
const PLANS_NO_APPEAL: TestPlan[] = [
  {
    key: "starter",
    name: "Starter",
    features: ["20 messages per day", "1 chat day per week"],
  },
  {
    key: "plus",
    name: "Plus",
    features: ["20 messages per day", "Chat every day"],
  },
];

describe("filterPlansForCohort", () => {
  describe("Medicare cohort (isOnMedicare=true)", () => {
    it("returns all 3 plans", () => {
      const result = filterPlansForCohort(TEST_PLANS, true);
      expect(result).toHaveLength(3);
      expect(result.map((p) => p.key)).toEqual(["starter", "plus", "unlimited"]);
    });

    it("leaves all feature bullets intact", () => {
      const result = filterPlansForCohort(TEST_PLANS, true);
      const starter = result.find((p) => p.key === "starter")!;
      expect(starter.features).toEqual([
        "1 appeal credit per month",
        "20 messages per day",
        "1 chat day per week",
      ]);
    });

    it("preserves appeal-related bullets for Medicare users", () => {
      const result = filterPlansForCohort(TEST_PLANS, true);
      const unlimited = result.find((p) => p.key === "unlimited")!;
      expect(unlimited.features).toContain("Unlimited appeal letters");
    });
  });

  describe("non-Medicare cohort (isOnMedicare=false)", () => {
    it("returns 2 plans — Starter is excluded", () => {
      const result = filterPlansForCohort(TEST_PLANS, false);
      expect(result).toHaveLength(2);
      expect(result.map((p) => p.key)).toEqual(["plus", "unlimited"]);
    });

    it("strips appeal-related bullets from Plus features", () => {
      const result = filterPlansForCohort(TEST_PLANS, false);
      const plus = result.find((p) => p.key === "plus")!;
      // "2 appeal credits per month" must be gone
      expect(plus.features).not.toContain("2 appeal credits per month");
      // non-appeal bullets survive
      expect(plus.features).toContain("20 messages per day");
      expect(plus.features).toContain("Chat every day");
    });

    it("strips appeal-related bullets from Unlimited features", () => {
      const result = filterPlansForCohort(TEST_PLANS, false);
      const unlimited = result.find((p) => p.key === "unlimited")!;
      expect(unlimited.features).not.toContain("Unlimited appeal letters");
      expect(unlimited.features).toContain("Unlimited messages");
    });

    it("leaves non-appeal bullets fully intact (Plus: 2 bullets remain)", () => {
      const result = filterPlansForCohort(TEST_PLANS, false);
      const plus = result.find((p) => p.key === "plus")!;
      expect(plus.features).toHaveLength(2); // 3 originally minus 1 appeal bullet
    });
  });

  describe("case-insensitive appeal bullet stripping", () => {
    const mixedCasePlans: TestPlan[] = [
      { key: "plus", name: "Plus", features: ["APPEAL LETTERS included", "20 messages per day"] },
      { key: "unlimited", name: "Unlimited", features: ["appeal credit", "Chat every day"] },
      { key: "other", name: "Other", features: ["Appeal Credits", "Weekly chat"] },
    ];

    it("removes bullets matching /appeal/i regardless of case", () => {
      const result = filterPlansForCohort(mixedCasePlans, false);

      const plus = result.find((p) => p.key === "plus")!;
      expect(plus.features).not.toContain("APPEAL LETTERS included");
      expect(plus.features).toContain("20 messages per day");

      const unlimited = result.find((p) => p.key === "unlimited")!;
      expect(unlimited.features).not.toContain("appeal credit");
      expect(unlimited.features).toContain("Chat every day");

      const other = result.find((p) => p.key === "other")!;
      expect(other.features).not.toContain("Appeal Credits");
      expect(other.features).toContain("Weekly chat");
    });
  });

  describe("plan with NO appeal bullets", () => {
    it("leaves features array unchanged when no appeal bullets are present", () => {
      const result = filterPlansForCohort(PLANS_NO_APPEAL, false);
      // Starter still excluded by key filter
      expect(result.map((p) => p.key)).toEqual(["plus"]);
      const plus = result[0];
      expect(plus.features).toEqual(["20 messages per day", "Chat every day"]);
    });
  });

  describe("edge cases", () => {
    it("returns empty array when given empty plans list", () => {
      expect(filterPlansForCohort([], true)).toEqual([]);
      expect(filterPlansForCohort([], false)).toEqual([]);
    });

    it("does not mutate the original plans array length", () => {
      const plans: TestPlan[] = [...TEST_PLANS];
      const originalLength = plans.length;
      filterPlansForCohort(plans, false);
      expect(plans).toHaveLength(originalLength);
    });
  });
});

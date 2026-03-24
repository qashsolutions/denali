import { describe, it, expect, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

/**
 * Stripe Fulfillment — Unit Tests
 *
 * Tests fulfillCheckoutSession() and handleSubscriptionEvent()
 * for all 3 plans (starter/plus/unlimited) with positive and negative scenarios.
 * Mocks: Stripe SDK, RDS query(), pricing config env vars.
 */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockQuery = vi.fn();
vi.mock("@/lib/db", () => ({
  query: (...args: unknown[]) => mockQuery(...args),
}));

// Mock Stripe SDK — getStripe() instantiates new Stripe(key)
const mockRetrieveSession = vi.fn();
const mockRetrieveSubscription = vi.fn();
vi.mock("stripe", () => {
  return {
    default: class MockStripe {
      checkout = {
        sessions: { retrieve: mockRetrieveSession },
      };
      subscriptions = { retrieve: mockRetrieveSubscription };
    },
  };
});

// Set STRIPE_SECRET_KEY so getStripe() doesn't throw
vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_fake");

import {
  fulfillCheckoutSession,
  handleSubscriptionEvent,
} from "../stripe-fulfillment";

// ---------------------------------------------------------------------------
// Helpers — build mock Stripe objects
// ---------------------------------------------------------------------------

const NOW_UNIX = Math.floor(Date.now() / 1000);
const MONTH_LATER_UNIX = NOW_UNIX + 30 * 24 * 60 * 60;

function makeSession(overrides: Record<string, unknown> = {}) {
  return {
    id: "cs_test_123",
    payment_status: "paid",
    customer: "cus_test_456",
    metadata: {
      user_id: "user-abc",
      email: "test@denali.health",
      plan: "starter",
    },
    subscription: {
      id: "sub_test_789",
      start_date: NOW_UNIX,
      items: {
        data: [{ current_period_end: MONTH_LATER_UNIX }],
      },
    },
    ...overrides,
  };
}

function makeSubscription(
  status: string,
  overrides: Record<string, unknown> = {}
): Stripe.Subscription {
  return {
    id: "sub_test_789",
    status,
    start_date: NOW_UNIX,
    items: {
      data: [{ current_period_end: MONTH_LATER_UNIX }],
    },
    ...overrides,
  } as unknown as Stripe.Subscription;
}

// ---------------------------------------------------------------------------
// fulfillCheckoutSession — Positive scenarios
// ---------------------------------------------------------------------------

describe("fulfillCheckoutSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  describe("Starter plan ($10/month)", () => {
    it("calls fulfill_checkout with correct params and resets credits to 1", async () => {
      mockRetrieveSession.mockResolvedValue(
        makeSession({ metadata: { user_id: "user-1", email: "starter@test.com", plan: "starter" } })
      );

      await fulfillCheckoutSession("cs_starter");

      // fulfill_checkout called
      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT fulfill_checkout($1, $2, $3, $4, $5, $6, $7)`,
        expect.arrayContaining(["user-1", "starter@test.com", "starter"])
      );

      // reset_monthly_appeal_credits called with 1 credit
      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT reset_monthly_appeal_credits($1, $2)`,
        ["starter@test.com", 1]
      );
    });
  });

  describe("Plus plan ($20/month)", () => {
    it("calls fulfill_checkout with correct params and resets credits to 2", async () => {
      mockRetrieveSession.mockResolvedValue(
        makeSession({ metadata: { user_id: "user-2", email: "plus@test.com", plan: "plus" } })
      );

      await fulfillCheckoutSession("cs_plus");

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT fulfill_checkout($1, $2, $3, $4, $5, $6, $7)`,
        expect.arrayContaining(["user-2", "plus@test.com", "plus"])
      );

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT reset_monthly_appeal_credits($1, $2)`,
        ["plus@test.com", 2]
      );
    });
  });

  describe("Unlimited plan ($60/month)", () => {
    it("calls fulfill_checkout but does NOT reset credits (-1 = unlimited)", async () => {
      mockRetrieveSession.mockResolvedValue(
        makeSession({ metadata: { user_id: "user-3", email: "unlimited@test.com", plan: "unlimited" } })
      );

      await fulfillCheckoutSession("cs_unlimited");

      // fulfill_checkout called
      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT fulfill_checkout($1, $2, $3, $4, $5, $6, $7)`,
        expect.arrayContaining(["user-3", "unlimited@test.com", "unlimited"])
      );

      // reset_monthly_appeal_credits NOT called — unlimited bypasses credit tracking
      const creditCalls = mockQuery.mock.calls.filter(
        (c) => typeof c[0] === "string" && c[0].includes("reset_monthly_appeal_credits")
      );
      expect(creditCalls).toHaveLength(0);
    });
  });

  describe("fulfill_checkout DB params verification", () => {
    it("passes all 7 params: userId, email, plan, customerId, subId, periodStart, periodEnd", async () => {
      mockRetrieveSession.mockResolvedValue(makeSession());

      await fulfillCheckoutSession("cs_test_123");

      const fulfillCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("fulfill_checkout")
      );
      expect(fulfillCall).toBeDefined();

      const params = fulfillCall![1] as unknown[];
      expect(params).toHaveLength(7);
      expect(params[0]).toBe("user-abc");                   // userId
      expect(params[1]).toBe("test@denali.health");          // email
      expect(params[2]).toBe("starter");                     // plan
      expect(params[3]).toBe("cus_test_456");                // Stripe customer ID
      expect(params[4]).toBe("sub_test_789");                // Stripe subscription ID
      expect(typeof params[5]).toBe("string");               // periodStart (ISO string)
      expect(typeof params[6]).toBe("string");               // periodEnd (ISO string)
    });
  });

  // ---------------------------------------------------------------------------
  // fulfillCheckoutSession — Negative / edge case scenarios
  // ---------------------------------------------------------------------------

  describe("Payment not yet captured", () => {
    it("skips fulfillment when payment_status is not 'paid'", async () => {
      mockRetrieveSession.mockResolvedValue(
        makeSession({ payment_status: "unpaid" })
      );

      await fulfillCheckoutSession("cs_unpaid");

      // No DB calls at all
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe("Missing user_id metadata", () => {
    it("skips fulfillment when metadata has no user_id", async () => {
      mockRetrieveSession.mockResolvedValue(
        makeSession({
          metadata: { email: "no-user@test.com", plan: "starter" },
        })
      );

      await fulfillCheckoutSession("cs_no_user");

      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe("Missing email in metadata", () => {
    it("still fulfills with empty string email but skips credit reset", async () => {
      mockRetrieveSession.mockResolvedValue(
        makeSession({
          metadata: { user_id: "user-no-email", plan: "starter" },
        })
      );

      await fulfillCheckoutSession("cs_no_email");

      // fulfill_checkout called with empty email
      const fulfillCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("fulfill_checkout")
      );
      expect(fulfillCall).toBeDefined();
      expect((fulfillCall![1] as unknown[])[1]).toBe("");

      // Credit reset NOT called — email is falsy
      const creditCalls = mockQuery.mock.calls.filter(
        (c) => typeof c[0] === "string" && c[0].includes("reset_monthly_appeal_credits")
      );
      expect(creditCalls).toHaveLength(0);
    });
  });

  describe("Null subscription object", () => {
    it("handles null subscription gracefully (null sub ID and period dates)", async () => {
      mockRetrieveSession.mockResolvedValue(
        makeSession({ subscription: null })
      );

      await fulfillCheckoutSession("cs_no_sub");

      const fulfillCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("fulfill_checkout")
      );
      expect(fulfillCall).toBeDefined();

      const params = fulfillCall![1] as unknown[];
      expect(params[4]).toBeNull();  // subId
      expect(params[5]).toBeNull();  // periodStart
      // periodEnd: optional chain returns undefined, then `|| null` in query params
      expect(params[6]).toBeNull();
    });
  });

  describe("Legacy plan name normalization", () => {
    it("normalizes 'per_appeal' to 'starter'", async () => {
      mockRetrieveSession.mockResolvedValue(
        makeSession({
          metadata: { user_id: "user-legacy", email: "legacy@test.com", plan: "per_appeal" },
        })
      );

      await fulfillCheckoutSession("cs_legacy");

      const fulfillCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("fulfill_checkout")
      );
      expect((fulfillCall![1] as unknown[])[2]).toBe("starter");
    });

    it("normalizes 'single' to 'starter'", async () => {
      mockRetrieveSession.mockResolvedValue(
        makeSession({
          metadata: { user_id: "user-single", email: "single@test.com", plan: "single" },
        })
      );

      await fulfillCheckoutSession("cs_single");

      const fulfillCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("fulfill_checkout")
      );
      expect((fulfillCall![1] as unknown[])[2]).toBe("starter");
    });

    it("normalizes 'monthly' to 'plus'", async () => {
      mockRetrieveSession.mockResolvedValue(
        makeSession({
          metadata: { user_id: "user-monthly", email: "monthly@test.com", plan: "monthly" },
        })
      );

      await fulfillCheckoutSession("cs_monthly");

      const fulfillCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("fulfill_checkout")
      );
      expect((fulfillCall![1] as unknown[])[2]).toBe("plus");
    });

    it("defaults undefined plan to 'starter'", async () => {
      mockRetrieveSession.mockResolvedValue(
        makeSession({
          metadata: { user_id: "user-noplan", email: "noplan@test.com" },
        })
      );

      await fulfillCheckoutSession("cs_noplan");

      const fulfillCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("fulfill_checkout")
      );
      expect((fulfillCall![1] as unknown[])[2]).toBe("starter");
    });
  });

  describe("Credit reset DB error", () => {
    it("does not throw when reset_monthly_appeal_credits fails", async () => {
      mockRetrieveSession.mockResolvedValue(
        makeSession({ metadata: { user_id: "user-err", email: "err@test.com", plan: "starter" } })
      );

      // First call succeeds (fulfill_checkout), second rejects (credit reset)
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockRejectedValueOnce(new Error("DB connection lost"));

      // Should not throw
      await expect(fulfillCheckoutSession("cs_err")).resolves.toBeUndefined();
    });
  });

  describe("Idempotency", () => {
    it("can be called twice for the same session without error", async () => {
      mockRetrieveSession.mockResolvedValue(makeSession());

      await fulfillCheckoutSession("cs_idem");
      await fulfillCheckoutSession("cs_idem");

      // fulfill_checkout called twice (DB function handles idempotency)
      const fulfillCalls = mockQuery.mock.calls.filter(
        (c) => typeof c[0] === "string" && c[0].includes("fulfill_checkout")
      );
      expect(fulfillCalls).toHaveLength(2);
    });
  });
});

// ---------------------------------------------------------------------------
// handleSubscriptionEvent — Positive scenarios
// ---------------------------------------------------------------------------

describe("handleSubscriptionEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockQuery.mockResolvedValue({ rows: [] });
  });

  describe("Active subscription (renewal)", () => {
    it("syncs status and resets credits for starter user", async () => {
      // Lookup chain: subscription → user_id → email + plan
      mockQuery
        .mockResolvedValueOnce({ rows: [] })                                           // handle_subscription_change
        .mockResolvedValueOnce({ rows: [{ user_id: "user-renew" }] })                  // SELECT subscriptions
        .mockResolvedValueOnce({ rows: [{ email: "renew@test.com", plan: "starter" }] }) // SELECT users
        .mockResolvedValueOnce({ rows: [] });                                          // reset_monthly_appeal_credits

      await handleSubscriptionEvent(makeSubscription("active"));

      // handle_subscription_change called with "active"
      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT handle_subscription_change($1, $2, $3, $4)`,
        expect.arrayContaining(["sub_test_789", "active"])
      );

      // Credit reset called with 1 (starter)
      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT reset_monthly_appeal_credits($1, $2)`,
        ["renew@test.com", 1]
      );
    });

    it("resets credits to 2 for plus user on renewal", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ user_id: "user-plus-renew" }] })
        .mockResolvedValueOnce({ rows: [{ email: "plus-renew@test.com", plan: "plus" }] })
        .mockResolvedValueOnce({ rows: [] });

      await handleSubscriptionEvent(makeSubscription("active"));

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT reset_monthly_appeal_credits($1, $2)`,
        ["plus-renew@test.com", 2]
      );
    });

    it("skips credit reset for unlimited user on renewal", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ user_id: "user-unlim-renew" }] })
        .mockResolvedValueOnce({ rows: [{ email: "unlim@test.com", plan: "unlimited" }] });

      await handleSubscriptionEvent(makeSubscription("active"));

      // reset_monthly_appeal_credits NOT called — unlimited has -1 credits
      const creditCalls = mockQuery.mock.calls.filter(
        (c) => typeof c[0] === "string" && c[0].includes("reset_monthly_appeal_credits")
      );
      expect(creditCalls).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // handleSubscriptionEvent — Negative / non-active statuses
  // ---------------------------------------------------------------------------

  describe("Past due subscription (payment failure)", () => {
    it("syncs status to 'past_due' and does NOT reset credits", async () => {
      await handleSubscriptionEvent(makeSubscription("past_due"));

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT handle_subscription_change($1, $2, $3, $4)`,
        expect.arrayContaining(["sub_test_789", "past_due"])
      );

      // Only 1 query call (handle_subscription_change) — no credit lookups
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe("Canceled subscription", () => {
    it("syncs status to 'cancelled' (mapped from Stripe 'canceled') and does NOT reset credits", async () => {
      await handleSubscriptionEvent(makeSubscription("canceled"));

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT handle_subscription_change($1, $2, $3, $4)`,
        expect.arrayContaining(["sub_test_789", "cancelled"])
      );

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe("Unpaid subscription", () => {
    it("maps 'unpaid' to 'past_due' and does NOT reset credits", async () => {
      await handleSubscriptionEvent(makeSubscription("unpaid"));

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT handle_subscription_change($1, $2, $3, $4)`,
        expect.arrayContaining(["sub_test_789", "past_due"])
      );

      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  describe("Unknown status (falls through map)", () => {
    it("passes through unknown status as-is", async () => {
      await handleSubscriptionEvent(makeSubscription("trialing"));

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT handle_subscription_change($1, $2, $3, $4)`,
        expect.arrayContaining(["sub_test_789", "trialing"])
      );

      // No credit reset for non-active status
      expect(mockQuery).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // handleSubscriptionEvent — Edge cases during credit reset lookup
  // ---------------------------------------------------------------------------

  describe("Missing subscription record in DB", () => {
    it("handles gracefully when subscription not found in DB", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })  // handle_subscription_change
        .mockResolvedValueOnce({ rows: [] }); // SELECT subscriptions → empty

      await handleSubscriptionEvent(makeSubscription("active"));

      // No user lookup or credit reset — subscription not found
      expect(mockQuery).toHaveBeenCalledTimes(2);
    });
  });

  describe("Missing user record in DB", () => {
    it("handles gracefully when user not found", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })                          // handle_subscription_change
        .mockResolvedValueOnce({ rows: [{ user_id: "user-ghost" }] }) // SELECT subscriptions
        .mockResolvedValueOnce({ rows: [] });                         // SELECT users → empty

      await handleSubscriptionEvent(makeSubscription("active"));

      // No credit reset — user not found
      const creditCalls = mockQuery.mock.calls.filter(
        (c) => typeof c[0] === "string" && c[0].includes("reset_monthly_appeal_credits")
      );
      expect(creditCalls).toHaveLength(0);
    });
  });

  describe("User with null plan defaults to starter", () => {
    it("defaults to starter credits (1) when user plan is null", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ user_id: "user-null-plan" }] })
        .mockResolvedValueOnce({ rows: [{ email: "nullplan@test.com", plan: null }] })
        .mockResolvedValueOnce({ rows: [] });

      await handleSubscriptionEvent(makeSubscription("active"));

      expect(mockQuery).toHaveBeenCalledWith(
        `SELECT reset_monthly_appeal_credits($1, $2)`,
        ["nullplan@test.com", 1]
      );
    });
  });

  describe("User with null email", () => {
    it("skips credit reset when user email is null", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ user_id: "user-no-email" }] })
        .mockResolvedValueOnce({ rows: [{ email: null, plan: "plus" }] });

      await handleSubscriptionEvent(makeSubscription("active"));

      const creditCalls = mockQuery.mock.calls.filter(
        (c) => typeof c[0] === "string" && c[0].includes("reset_monthly_appeal_credits")
      );
      expect(creditCalls).toHaveLength(0);
    });
  });

  describe("Credit reset DB error during renewal", () => {
    it("does not throw when reset_monthly_appeal_credits fails", async () => {
      mockQuery
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ user_id: "user-err" }] })
        .mockResolvedValueOnce({ rows: [{ email: "err@test.com", plan: "starter" }] })
        .mockRejectedValueOnce(new Error("DB timeout"));

      await expect(
        handleSubscriptionEvent(makeSubscription("active"))
      ).resolves.toBeUndefined();
    });
  });

  describe("Period date extraction", () => {
    it("converts Unix timestamps to ISO strings", async () => {
      await handleSubscriptionEvent(makeSubscription("past_due"));

      const changeCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("handle_subscription_change")
      );
      const params = changeCall![1] as unknown[];

      // periodStart should be ISO string from NOW_UNIX
      expect(params[2]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      // periodEnd should be ISO string from MONTH_LATER_UNIX
      expect(params[3]).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it("handles missing start_date and items", async () => {
      await handleSubscriptionEvent(
        makeSubscription("canceled", { start_date: null, items: { data: [] } })
      );

      const changeCall = mockQuery.mock.calls.find(
        (c) => typeof c[0] === "string" && c[0].includes("handle_subscription_change")
      );
      const params = changeCall![1] as unknown[];

      expect(params[2]).toBeNull();  // periodStart null
      expect(params[3]).toBeNull();  // periodEnd null (empty items → undefined → || null)
    });
  });
});

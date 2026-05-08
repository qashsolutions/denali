/**
 * Checkout API Route
 *
 * POST /api/checkout
 *
 * Creates a Stripe Checkout session for subscription plans.
 * All plans are monthly subscriptions: Starter ($10), Plus ($20), Unlimited ($60).
 */

import { NextRequest, NextResponse } from "next/server";
import { PRICING, getBaseUrl } from "@/config";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { withMetrics } from "@/lib/metrics";
import { VALIDATION, AUTH, SYSTEM } from "@/config/messages";

// Stripe is imported dynamically to avoid build errors when key is not set
type Stripe = typeof import("stripe").default;

type PlanType = "starter" | "plus" | "unlimited";

interface CheckoutRequestBody {
  plan: PlanType;
}

// Price IDs from config
const STRIPE_PRICES: Record<PlanType, string> = {
  starter: PRICING.STARTER.stripePriceId,
  plus: PRICING.PLUS.stripePriceId,
  unlimited: PRICING.UNLIMITED.stripePriceId,
};

// Plan rank for upgrade gating. Same-tier or downgrade attempts during an
// active subscription are rejected — those go through the Customer Portal,
// not a fresh Checkout (which would create a second Stripe subscription
// and double-bill).
const PLAN_RANK: Record<string, number> = {
  trial: 0,
  starter: 1,
  plus: 2,
  unlimited: 3,
};

async function _POST(request: NextRequest) {
  try {
    const body: CheckoutRequestBody = await request.json();

    // Validate request
    if (!body.plan || !["starter", "plus", "unlimited"].includes(body.plan)) {
      return NextResponse.json(
        { error: VALIDATION.INVALID_PLAN },
        { status: 400 },
      );
    }

    // Check for Stripe key — never grant free access when missing
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      console.error("[CHECKOUT] STRIPE_SECRET_KEY not configured");
      return NextResponse.json(
        { error: SYSTEM.PAYMENT_NOT_CONFIGURED },
        { status: 503 },
      );
    }

    // Import and initialize Stripe
    const StripeModule = await import("stripe");
    const stripe = new StripeModule.default(stripeKey);

    // Get authenticated user via Cognito JWT
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { error: AUTH.SIGN_IN_REQUIRED },
        { status: 401 },
      );
    }

    const userId = user.userId;
    const email = user.email || "";

    // Kill switch: prevent same-plan or downgrade resubscription via Checkout.
    // Active subscribers must use the Customer Portal to change plans.
    const subResult = await query<{ plan: string; status: string }>(
      `SELECT plan, status FROM subscriptions WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    const sub = subResult.rows[0] ?? null;
    if (sub?.status === "active") {
      const currentRank = PLAN_RANK[sub.plan] ?? 0;
      const requestedRank = PLAN_RANK[body.plan] ?? 0;
      if (requestedRank <= currentRank) {
        return NextResponse.json(
          { error: SYSTEM.ACTIVE_SUBSCRIPTION },
          { status: 409 },
        );
      }
    }

    // Get the origin for redirect URLs (uses safe fallback from config)
    const origin = getBaseUrl(request.headers.get("origin"));

    // All plans are subscriptions
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: STRIPE_PRICES[body.plan],
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${origin}/app/chat?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/chat?payment=cancelled`,
      customer_email: email || undefined,
      metadata: {
        plan: body.plan,
        user_id: userId,
        email: email,
        environment: process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_")
          ? "live"
          : "test",
      },
    });

    logAudit("CHECKOUT_STARTED", {
      userId: userId || undefined,
      resourceType: "subscription",
      metadata: { plan: body.plan },
      request,
    }).catch(() => {});

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);

    if (error instanceof Error && error.message.includes("No such price")) {
      return NextResponse.json(
        { error: "Payment system is being set up. Please try again later." },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: SYSTEM.CHECKOUT_FAILED },
      { status: 500 },
    );
  }
}

export const POST = withMetrics(_POST, "/api/checkout");

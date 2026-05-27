/**
 * Checkout API Route
 *
 * POST /api/checkout
 *
 * Creates a Stripe Checkout session for subscription plans (monthly:
 * Starter $10, Plus $20, Unlimited $60).
 *
 * Policy:
 * - Active subscribers (subscriptions.status='active') cannot start a new
 *   Checkout session. They must cancel via Customer Portal first; their
 *   new plan becomes available at the end of the current billing cycle.
 * - When the user already has a stripe_customer_id, it's reused. This
 *   keeps Stripe's per-email customer count to one, even across
 *   subscribe → cancel → resubscribe cycles.
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

    // Stage 2 cohort gate: Starter is a Medicare-only plan (per-appeal
    // pricing model). Non-Medicare users can still buy Plus / Unlimited
    // for chat capacity. DB-backed source of truth, not the cookie.
    if (body.plan === "starter") {
      const medicareResult = await query<{ is_on_medicare: boolean | null }>(
        `SELECT is_on_medicare FROM users WHERE id = $1 LIMIT 1`,
        [userId],
      );
      if (medicareResult.rows[0]?.is_on_medicare !== true) {
        return NextResponse.json(
          { error: "starter_requires_medicare" },
          { status: 403 },
        );
      }
    }

    // Look up existing subscription state. We use this for two things:
    //   1. Reject any new Checkout while a subscription is status='active'
    //      (plan changes go through Customer Portal at cycle boundaries).
    //   2. Reuse stripe_customer_id when present, so a user who cancels
    //      and resubscribes doesn't accumulate duplicate Stripe customers.
    const subResult = await query<{
      status: string;
      stripe_customer_id: string | null;
    }>(
      `SELECT status, stripe_customer_id FROM subscriptions WHERE user_id = $1 LIMIT 1`,
      [userId],
    );
    const sub = subResult.rows[0] ?? null;
    if (sub?.status === "active") {
      return NextResponse.json(
        { error: SYSTEM.ACTIVE_SUBSCRIPTION_CHANGE_PLAN },
        { status: 409 },
      );
    }

    const existingCustomerId = sub?.stripe_customer_id ?? null;

    // Get the origin for redirect URLs (uses safe fallback from config)
    const origin = getBaseUrl(request.headers.get("origin"));

    // All plans are subscriptions. Pass either customer (reuse) or
    // customer_email (new) — Stripe rejects passing both.
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
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : { customer_email: email || undefined }),
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

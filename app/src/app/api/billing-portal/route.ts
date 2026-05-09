/**
 * Billing Portal API Route
 *
 * POST /api/billing-portal
 *
 * Creates a Stripe Customer Portal session for the authenticated user.
 * Powers the "Manage Subscription" UI for cancel, payment-method update,
 * and invoice history. Plan switching is intentionally disabled in the
 * Stripe Dashboard Portal config until handle_subscription_change is
 * extended to propagate price changes (Task B.2).
 */

import { NextRequest, NextResponse } from "next/server";
import { getBaseUrl } from "@/config";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { withMetrics } from "@/lib/metrics";
import { AUTH, SYSTEM } from "@/config/messages";

async function _POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: AUTH.SIGN_IN_REQUIRED },
        { status: 401 },
      );
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      console.error("[BILLING_PORTAL] STRIPE_SECRET_KEY not configured");
      return NextResponse.json(
        { error: SYSTEM.PAYMENT_NOT_CONFIGURED },
        { status: 503 },
      );
    }

    const result = await query<{ stripe_customer_id: string | null }>(
      `SELECT stripe_customer_id FROM subscriptions WHERE user_id = $1 LIMIT 1`,
      [user.userId],
    );
    const customerId = result.rows[0]?.stripe_customer_id;

    if (!customerId) {
      return NextResponse.json(
        {
          error:
            "We couldn't find your billing record. Please contact support.",
        },
        { status: 409 },
      );
    }

    // Dynamic import to mirror /api/checkout pattern (avoids build break
    // when STRIPE_SECRET_KEY is absent in non-prod environments).
    const StripeModule = await import("stripe");
    const stripe = new StripeModule.default(stripeKey);

    const origin = getBaseUrl(request.headers.get("origin"));

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/app/settings`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Billing portal error:", error);
    return NextResponse.json(
      { error: SYSTEM.GENERIC_ERROR },
      { status: 500 },
    );
  }
}

export const POST = withMetrics(_POST, "/api/billing-portal");

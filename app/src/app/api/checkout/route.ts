/**
 * Checkout API Route
 *
 * POST /api/checkout
 *
 * Creates a Stripe Checkout session for appeal letter purchases.
 * Pricing is configured via config/pricing.ts
 */

import { NextRequest, NextResponse } from "next/server";
import { PRICING, getBaseUrl } from "@/config";
import { getAuthUser } from "@/lib/auth-server";
import { logAudit } from "@/lib/audit";

// Stripe is imported dynamically to avoid build errors when key is not set
type Stripe = typeof import("stripe").default;

interface CheckoutRequestBody {
  plan: "single" | "monthly";
}

// Price IDs from config (with Stripe Dashboard fallback)
const STRIPE_PRICES = {
  single: PRICING.SINGLE_APPEAL.stripePriceId,
  monthly: PRICING.MONTHLY.stripePriceId,
};

export async function POST(request: NextRequest) {
  try {
    const body: CheckoutRequestBody = await request.json();

    // Validate request
    if (!body.plan || !["single", "monthly"].includes(body.plan)) {
      return NextResponse.json(
        { error: "Invalid plan type" },
        { status: 400 }
      );
    }

    // Check for Stripe key — never grant free access when missing
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      console.error("[CHECKOUT] STRIPE_SECRET_KEY not configured");
      return NextResponse.json(
        { error: "Payment system not configured. Please try again later." },
        { status: 503 }
      );
    }

    // Import and initialize Stripe
    const StripeModule = await import("stripe");
    const stripe = new StripeModule.default(stripeKey);

    // Get authenticated user via Cognito JWT
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    const userId = user.userId;
    const email = user.email || "";

    // Get the origin for redirect URLs (uses safe fallback from config)
    const origin = getBaseUrl(request.headers.get("origin"));

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: STRIPE_PRICES[body.plan],
          quantity: 1,
        },
      ],
      mode: body.plan === "monthly" ? "subscription" : "payment",
      success_url: `${origin}/app/chat?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/app/chat?payment=cancelled`,
      customer_email: email || undefined,
      metadata: {
        plan: body.plan,
        user_id: userId,
        email: email,
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
        { error: "Stripe prices not configured. Please set up price IDs." },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}

/**
 * Checkout API Route
 *
 * POST /api/checkout
 *
 * Creates a Stripe Checkout session for appeal letter purchases.
 * Supports both one-time ($10) and subscription ($25/month) payments.
 */

import { NextRequest, NextResponse } from "next/server";

// Stripe is imported dynamically to avoid build errors when key is not set
type Stripe = typeof import("stripe").default;

interface CheckoutRequestBody {
  plan: "single" | "unlimited";
}

// Price IDs from Stripe Dashboard (to be configured)
const STRIPE_PRICES = {
  single: process.env.STRIPE_PRICE_SINGLE || "price_single_appeal",
  unlimited: process.env.STRIPE_PRICE_UNLIMITED || "price_unlimited_monthly",
};

export async function POST(request: NextRequest) {
  try {
    const body: CheckoutRequestBody = await request.json();

    // Validate request
    if (!body.plan || !["single", "unlimited"].includes(body.plan)) {
      return NextResponse.json(
        { error: "Invalid plan type" },
        { status: 400 }
      );
    }

    // Check for Stripe key
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      console.log("[DEV] Stripe not configured, returning mock response");
      return NextResponse.json({
        url: null,
        message: "Stripe not configured. In development mode, payments are simulated.",
      });
    }

    // Import and initialize Stripe
    const StripeModule = await import("stripe");
    const stripe = new StripeModule.default(stripeKey);

    // Get the origin for redirect URLs
    const origin = request.headers.get("origin") || "http://localhost:3000";

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price: STRIPE_PRICES[body.plan],
          quantity: 1,
        },
      ],
      mode: body.plan === "unlimited" ? "subscription" : "payment",
      success_url: `${origin}/chat?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/chat?payment=cancelled`,
      metadata: {
        plan: body.plan,
      },
    });

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

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  fulfillCheckoutSession,
  handleSubscriptionEvent,
} from "@/lib/stripe-fulfillment";
import { WEBHOOK } from "@/config/messages";

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export async function POST(request: NextRequest) {
  if (!WEBHOOK_SECRET) {
    console.error("[STRIPE WEBHOOK] Missing STRIPE_WEBHOOK_SECRET");
    return NextResponse.json(
      { error: WEBHOOK.NOT_CONFIGURED },
      { status: 500 }
    );
  }

  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: WEBHOOK.MISSING_SIGNATURE }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    event = stripe.webhooks.constructEvent(body, signature, WEBHOOK_SECRET);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error(`[STRIPE WEBHOOK] Signature verification failed: ${message}`);
    return NextResponse.json(
      { error: WEBHOOK.INVALID_SIGNATURE },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await fulfillCheckoutSession(session.id);
        break;
      }
      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionEvent(subscription);
        break;
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await handleSubscriptionEvent(subscription);
        break;
      }
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subRef = invoice.parent?.subscription_details?.subscription;
        const subId = typeof subRef === "string" ? subRef : subRef?.id;
        if (subId) {
          console.warn(`[STRIPE WEBHOOK] Payment failed for subscription ${subId}`);
          // Retrieve latest subscription state and update our records
          const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
          const subscription = await stripe.subscriptions.retrieve(subId);
          await handleSubscriptionEvent(subscription);
        }
        break;
      }
      default:
        console.log(`[STRIPE WEBHOOK] Unhandled event type: ${event.type}`);
    }
  } catch (err) {
    // Log but return 200 — Stripe will retry on non-2xx and we don't want
    // transient failures to cause infinite retries
    console.error(`[STRIPE WEBHOOK] Error handling ${event.type}:`, err);
  }

  return NextResponse.json({ received: true });
}

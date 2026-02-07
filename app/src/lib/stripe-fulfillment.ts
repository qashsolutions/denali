import Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase-admin";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key);
}

/**
 * Fulfill a completed checkout session.
 * Idempotent — safe to call multiple times for the same session.
 */
export async function fulfillCheckoutSession(sessionId: string) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ["subscription"],
  });

  if (session.payment_status !== "paid") {
    console.log(`[STRIPE] Session ${sessionId} not yet paid, skipping`);
    return;
  }

  const userId = session.metadata?.user_id;
  const email = session.metadata?.email;
  const plan = session.metadata?.plan; // "single" | "monthly"

  if (!userId) {
    console.error(`[STRIPE] Session ${sessionId} missing user_id in metadata`);
    return;
  }

  const admin = createAdminClient();

  if (plan === "monthly") {
    // Subscription checkout — create subscription record
    const sub = session.subscription as Stripe.Subscription | null;
    const periodStart = sub?.start_date
      ? new Date(sub.start_date * 1000).toISOString()
      : null;

    const { error } = await admin.rpc("fulfill_checkout", {
      p_user_id: userId,
      p_email: email || "",
      p_plan: "monthly",
      p_stripe_customer_id: (session.customer as string) || undefined,
      p_stripe_subscription_id: sub?.id || undefined,
      p_period_start: periodStart || undefined,
      p_period_end: undefined,
    });
    if (error) {
      console.error("[STRIPE] fulfill_checkout RPC error:", error);
      throw error;
    }
    console.log(`[STRIPE] Fulfilled monthly subscription for user ${userId}`);
  } else {
    // One-time payment — just upgrade plan
    const { error } = await admin
      .from("users")
      .update({ plan: "per_appeal", updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) {
      console.error("[STRIPE] Error updating user plan:", error);
      throw error;
    }
    console.log(`[STRIPE] Fulfilled single payment for user ${userId}`);
  }
}

/**
 * Handle subscription lifecycle events (updated, deleted).
 */
export async function handleSubscriptionEvent(
  subscription: Stripe.Subscription
) {
  const statusMap: Record<string, string> = {
    active: "active",
    past_due: "past_due",
    canceled: "cancelled",
    unpaid: "past_due",
  };

  const status = statusMap[subscription.status] || subscription.status;
  const admin = createAdminClient();

  const periodStart = subscription.start_date
    ? new Date(subscription.start_date * 1000).toISOString()
    : null;

  const { error } = await admin.rpc("handle_subscription_change", {
    p_stripe_subscription_id: subscription.id,
    p_status: status,
    p_period_start: periodStart || undefined,
    p_period_end: undefined,
  });

  if (error) {
    console.error("[STRIPE] handle_subscription_change RPC error:", error);
    throw error;
  }

  console.log(
    `[STRIPE] Subscription ${subscription.id} updated to status: ${status}`
  );
}

import Stripe from "stripe";
import { query } from "@/lib/db";
import { PRICING } from "@/config";

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Missing STRIPE_SECRET_KEY");
  return new Stripe(key);
}

/** Map plan name to appeal credits. -1 = unlimited (skip credit tracking). */
function creditsForPlan(plan: string): number {
  switch (plan) {
    case "starter": return PRICING.STARTER.appealCredits;
    case "plus": return PRICING.PLUS.appealCredits;
    case "unlimited": return PRICING.UNLIMITED.appealCredits;
    default: return 0;
  }
}

/** Normalize legacy plan names from transition period metadata */
function normalizePlan(raw: string | undefined): string {
  if (raw === "single" || raw === "per_appeal") return "starter";
  if (raw === "monthly") return "plus";
  return raw || "starter";
}

/**
 * Fulfill a completed checkout session.
 * Idempotent — safe to call multiple times for the same session.
 * All plans are subscriptions now.
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
  const plan = normalizePlan(session.metadata?.plan);

  if (!userId) {
    console.error(`[STRIPE] Session ${sessionId} missing user_id in metadata`);
    return;
  }

  // All plans are subscriptions
  const sub = session.subscription as Stripe.Subscription | null;
  const firstItem = sub?.items?.data?.[0];
  const periodStart = sub?.start_date
    ? new Date(sub.start_date * 1000).toISOString()
    : null;
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000).toISOString()
    : undefined;

  await query(
    `SELECT fulfill_checkout($1, $2, $3, $4, $5, $6, $7)`,
    [
      userId,
      email || "",
      plan,
      (session.customer as string) || null,
      sub?.id || null,
      periodStart || null,
      periodEnd || null,
    ]
  );

  // Set appeal credits (skip for unlimited — they bypass credit checks)
  const credits = creditsForPlan(plan);
  if (email && credits > 0) {
    await query(`SELECT reset_monthly_appeal_credits($1, $2)`, [email, credits]).catch(
      (err) => console.error("[STRIPE] reset_monthly_appeal_credits error:", err)
    );
  }

  console.log(`[STRIPE] Fulfilled ${plan} subscription for user ${userId}`);
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

  const firstItem = subscription.items?.data?.[0];
  const periodStart = subscription.start_date
    ? new Date(subscription.start_date * 1000).toISOString()
    : null;
  const periodEnd = firstItem?.current_period_end
    ? new Date(firstItem.current_period_end * 1000).toISOString()
    : undefined;

  await query(
    `SELECT handle_subscription_change($1, $2, $3, $4)`,
    [subscription.id, status, periodStart || null, periodEnd || null]
  );

  // Reset appeal credits on renewal (active status with new period)
  if (status === "active") {
    const subResult = await query<{ user_id: string }>(
      `SELECT user_id FROM subscriptions WHERE stripe_subscription_id = $1 LIMIT 1`,
      [subscription.id]
    );
    const subUserId = subResult.rows[0]?.user_id;
    if (subUserId) {
      const userResult = await query<{ email: string; plan: string }>(
        `SELECT email, plan FROM users WHERE id = $1 LIMIT 1`,
        [subUserId]
      );
      const userEmail = userResult.rows[0]?.email;
      const userPlan = userResult.rows[0]?.plan || "starter";
      if (userEmail) {
        const credits = creditsForPlan(userPlan);
        if (credits > 0) {
          await query(`SELECT reset_monthly_appeal_credits($1, $2)`, [userEmail, credits]).catch(
            (err) => console.error("[STRIPE] reset_monthly_appeal_credits error:", err)
          );
        }
      }
    }
  }

  console.log(
    `[STRIPE] Subscription ${subscription.id} updated to status: ${status}`
  );
}

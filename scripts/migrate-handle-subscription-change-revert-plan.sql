-- Migration: B.9 — extend handle_subscription_change SP to revert users.plan
-- when a subscription flips to status='cancelled', and backfill the two users
-- whose subscriptions were cancelled BEFORE this SP update landed.
--
-- Tracking: B.9 / 2026-05-10.
-- Apply via the dbinit-style one-off Fargate task.

\echo '=== PRE-CHECK ==='
SELECT u.id, u.email, u.plan AS user_plan, s.status AS sub_status, s.cancelled_at
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.email IN ('ramanac@gmail.com', 'ceeveear@yahoo.com')
ORDER BY u.email;

BEGIN;

-- 1. Replace handle_subscription_change with cancellation-aware version.
--    Parameter list preserved verbatim from sql/001-schema.sql:532.
CREATE OR REPLACE FUNCTION public.handle_subscription_change(
  p_stripe_subscription_id text,
  p_status text,
  p_period_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_period_end timestamp with time zone DEFAULT NULL::timestamp with time zone
) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.subscriptions
  SET status = p_status,
      current_period_start = COALESCE(p_period_start, current_period_start),
      current_period_end = COALESCE(p_period_end, current_period_end),
      cancelled_at = CASE WHEN p_status = 'cancelled' THEN now() ELSE cancelled_at END,
      updated_at = now()
  WHERE stripe_subscription_id = p_stripe_subscription_id;

  -- When status flips to 'cancelled', revert the user's plan so the UI matches
  -- Stripe-side reality. Prior version only touched the subscriptions table,
  -- leaving users.plan stale at the paid tier.
  IF p_status = 'cancelled' THEN
    UPDATE public.users
    SET plan = 'trial', updated_at = now()
    WHERE id = (
      SELECT user_id FROM public.subscriptions
      WHERE stripe_subscription_id = p_stripe_subscription_id
      LIMIT 1
    );
  END IF;
END;
$$;

-- 2. Manual recovery: ramanac and ceeveear had subs cancelled BEFORE this SP
--    update. Their users.plan rows were never reverted by the old handler.
--    Idempotency guard prevents flipping rows already at 'trial'.
UPDATE users
SET plan = 'trial', updated_at = now()
WHERE email IN ('ramanac@gmail.com', 'ceeveear@yahoo.com')
  AND plan IN ('starter', 'plus', 'unlimited');

COMMIT;

\echo '=== POST-CHECK ==='
SELECT u.id, u.email, u.plan AS user_plan, s.status AS sub_status, s.cancelled_at
FROM users u
LEFT JOIN subscriptions s ON s.user_id = u.id
WHERE u.email IN ('ramanac@gmail.com', 'ceeveear@yahoo.com')
ORDER BY u.email;

-- Expected delta: both users' user_plan flips from paid tier → 'trial'.
-- sub_status and cancelled_at unchanged (already correct from prior webhook events).

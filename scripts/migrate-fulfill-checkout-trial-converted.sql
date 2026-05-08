-- Migration: fulfill_checkout SP sets trial_converted = true on payment.
-- Backfills: ramanac@gmail.com's existing paid Plus row.
-- Apply via the dbinit-style one-off Fargate task.
-- Tracking: trial_converted bug 2026-05-07.

\echo '=== PRE-CHECK: state before migration ==='
SELECT user_id, plan, status, trial_converted, trial_end
FROM subscriptions
WHERE user_id = '64681458-00c1-70e6-7623-9a3022a2ca1f';

BEGIN;

-- 1. Replace fulfill_checkout function definition
CREATE OR REPLACE FUNCTION public.fulfill_checkout(
  p_user_id uuid,
  p_email text,
  p_plan text,
  p_stripe_customer_id text DEFAULT NULL::text,
  p_stripe_subscription_id text DEFAULT NULL::text,
  p_period_start timestamp with time zone DEFAULT NULL::timestamp with time zone,
  p_period_end timestamp with time zone DEFAULT NULL::timestamp with time zone
) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    AS $$
BEGIN
  UPDATE public.users SET plan = p_plan WHERE id = p_user_id;

  INSERT INTO public.subscriptions (
    user_id, plan, status, stripe_customer_id, stripe_subscription_id,
    current_period_start, current_period_end, trial_converted
  )
  VALUES (
    p_user_id, p_plan, 'active', p_stripe_customer_id, p_stripe_subscription_id,
    p_period_start, p_period_end, true
  )
  ON CONFLICT (user_id) DO UPDATE SET
    plan = EXCLUDED.plan,
    status = 'active',
    stripe_customer_id = COALESCE(EXCLUDED.stripe_customer_id, subscriptions.stripe_customer_id),
    stripe_subscription_id = COALESCE(EXCLUDED.stripe_subscription_id, subscriptions.stripe_subscription_id),
    current_period_start = COALESCE(EXCLUDED.current_period_start, subscriptions.current_period_start),
    current_period_end = COALESCE(EXCLUDED.current_period_end, subscriptions.current_period_end),
    trial_converted = true,
    updated_at = now();
END;
$$;

-- 2. Backfill ramanac
UPDATE subscriptions
SET trial_converted = true,
    updated_at = now()
WHERE user_id = '64681458-00c1-70e6-7623-9a3022a2ca1f'
  AND status = 'active'
  AND plan IN ('starter','plus','unlimited');

COMMIT;

\echo '=== POST-CHECK: state after migration ==='
SELECT user_id, plan, status, trial_converted, trial_end
FROM subscriptions
WHERE user_id = '64681458-00c1-70e6-7623-9a3022a2ca1f';

-- Expected delta: trial_converted false → true. Everything else unchanged.

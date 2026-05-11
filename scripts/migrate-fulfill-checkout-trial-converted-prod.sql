-- ============================================================
-- PROD-SAFE VARIANT — staging-email backfills stripped
-- ============================================================
-- This migration applies the SP body change only. The staging
-- variant (same filename without the -prod suffix) additionally
-- contains UPDATE statements that target ramanac@gmail.com
-- and/or ceeveear@yahoo.com to manually correct test-mode state.
-- Those backfills MUST NOT run against prod RDS — they could
-- forcibly downgrade any real paying user whose email happens
-- to match.
--
-- Apply this prod-safe version to prod RDS via the
-- denali-prod-pgdump:1 task override pattern.
--
-- Created 2026-05-11 as part of Phase 3 prep.
-- ============================================================

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

COMMIT;

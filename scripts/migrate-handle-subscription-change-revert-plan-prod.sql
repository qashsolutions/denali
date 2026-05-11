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

COMMIT;

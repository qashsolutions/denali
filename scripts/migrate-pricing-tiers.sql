-- Migration: 5-tier pricing model
-- Run against RDS (denali-prod) via psql or ECS exec
-- Idempotent — safe to run multiple times

-- ============================================================
-- Phase A: Migrate existing plan values
-- ============================================================

UPDATE users SET plan = 'starter' WHERE plan = 'per_appeal';
UPDATE subscriptions SET plan = 'starter' WHERE plan = 'per_appeal';

UPDATE users SET plan = 'plus' WHERE plan = 'monthly';
UPDATE subscriptions SET plan = 'plus' WHERE plan = 'monthly';

-- ============================================================
-- Phase B: Update CHECK constraints
-- ============================================================

-- Drop old constraints (names may vary — query pg_constraint if these fail)
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;
ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;

-- Add new constraints with updated plan values
ALTER TABLE users ADD CONSTRAINT users_plan_check
  CHECK (plan IN ('trial', 'starter', 'plus', 'unlimited'));

ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('trial', 'starter', 'plus', 'unlimited', 'trialing'));

-- ============================================================
-- Phase C: Weekly frequency check function
-- ============================================================

CREATE OR REPLACE FUNCTION check_weekly_frequency(p_identifier TEXT, p_max_days INT)
RETURNS TABLE(allowed BOOLEAN, days_used INT) AS $$
DECLARE
  v_week_start DATE;
  v_days INT;
  v_has_today BOOLEAN;
BEGIN
  v_week_start := date_trunc('week', CURRENT_DATE)::DATE;

  SELECT COUNT(DISTINCT usage_date) INTO v_days
  FROM chat_daily_usage
  WHERE identifier = p_identifier
    AND usage_date >= v_week_start
    AND usage_date < v_week_start + 7;

  v_has_today := EXISTS (
    SELECT 1 FROM chat_daily_usage
    WHERE identifier = p_identifier AND usage_date = CURRENT_DATE
  );

  -- 0 = unlimited
  IF p_max_days = 0 THEN
    RETURN QUERY SELECT true, v_days;
    RETURN;
  END IF;

  -- If user already chatted today, that day is counted — allow if within limit
  IF v_has_today THEN
    RETURN QUERY SELECT v_days <= p_max_days, v_days;
  ELSE
    RETURN QUERY SELECT v_days < p_max_days, v_days;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Phase D: Rolling chat limit function (anonymous users)
-- ============================================================

CREATE OR REPLACE FUNCTION check_rolling_chat_limit(p_identifier TEXT, p_max INT, p_window_days INT)
RETURNS TABLE(allowed BOOLEAN, total INT, is_last BOOLEAN) AS $$
DECLARE
  v_total INT;
BEGIN
  SELECT COALESCE(SUM(message_count), 0) INTO v_total
  FROM chat_daily_usage
  WHERE identifier = p_identifier
    AND usage_date >= CURRENT_DATE - p_window_days;

  RETURN QUERY SELECT v_total < p_max, v_total, v_total = p_max - 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Verification
-- ============================================================

-- Check constraints exist
SELECT conname, conrelid::regclass, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE conname IN ('users_plan_check', 'subscriptions_plan_check');

-- Check functions exist
SELECT proname FROM pg_proc
WHERE proname IN ('check_weekly_frequency', 'check_rolling_chat_limit');

-- Fix check_and_increment_chat return type (P0 bug)
-- Applied to production on 2026-04-13.
--
-- BUG: Function returned JSONB, which pg driver wraps as { function_name: value }.
-- TypeScript read row.allowed which was always undefined. !undefined === true,
-- so every non-admin user was rate-limited on every message.
--
-- FIX: Change RETURNS jsonb to RETURNS TABLE (allowed boolean, count integer),
-- matching check_weekly_frequency. pg driver maps TABLE rows as flat objects.

DROP FUNCTION IF EXISTS check_and_increment_chat(text, integer);

CREATE FUNCTION check_and_increment_chat(p_identifier text, p_daily_limit integer)
RETURNS TABLE (allowed boolean, count integer)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INT;
  v_today DATE := CURRENT_DATE;
BEGIN
  SELECT message_count INTO v_count
  FROM chat_daily_usage
  WHERE identifier = p_identifier AND usage_date = v_today;

  v_count := COALESCE(v_count, 0);

  IF p_daily_limit > 0 AND v_count >= p_daily_limit THEN
    RETURN QUERY SELECT false, v_count;
    RETURN;
  END IF;

  INSERT INTO chat_daily_usage (identifier, usage_date, message_count)
  VALUES (p_identifier, v_today, 1)
  ON CONFLICT (identifier, usage_date)
  DO UPDATE SET message_count = chat_daily_usage.message_count + 1,
               updated_at = now();

  RETURN QUERY SELECT true, v_count + 1;
  RETURN;
END;
$$;

-- migrate-appeal-levels.sql
-- Adds multi-level appeal tracking to the appeals table.
-- Idempotent: safe to run multiple times.
--
-- Run via ECS exec or local psql before deploying appeal-levels feature.

-- 1. Add appeal_level column (1-5, default 1)
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS appeal_level INTEGER NOT NULL DEFAULT 1;

-- 2. Add prior_appeal_id column (links Level 2 to Level 1, etc.)
ALTER TABLE appeals ADD COLUMN IF NOT EXISTS prior_appeal_id UUID REFERENCES appeals(id);

-- 3. Add CHECK constraint on appeal_level range
-- Use DO block to avoid error if constraint already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'appeal_level_range'
  ) THEN
    ALTER TABLE appeals ADD CONSTRAINT appeal_level_range
      CHECK (appeal_level >= 1 AND appeal_level <= 5);
  END IF;
END$$;

-- 4. Index for querying appeals by user + service + level
CREATE INDEX IF NOT EXISTS idx_appeals_user_service_level
  ON appeals (user_id, service_description, appeal_level);

-- 5. Update get_unreported_outcome() to return appeal_level
CREATE OR REPLACE FUNCTION get_unreported_outcome(p_email TEXT)
RETURNS TABLE (
  appeal_id UUID,
  followup_id UUID,
  service_description TEXT,
  denial_date TIMESTAMPTZ,
  followup_type TEXT,
  scheduled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  appeal_level INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id AS appeal_id,
    f.id AS followup_id,
    a.service_description,
    a.denial_date,
    f.followup_type,
    f.scheduled_at,
    f.created_at,
    a.appeal_level
  FROM outcome_followups f
  JOIN appeals a ON a.id = f.appeal_id
  WHERE f.email = p_email
    AND f.outcome IS NULL
    AND f.scheduled_at <= NOW()
  ORDER BY f.scheduled_at ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Migration: User Prerequisites (Foundation Stage 1)
-- Design doc ref: Part 2 (Target User), Part 3 (Condition Scope)
--
-- Additive schema changes to support:
--   - Age-based soft gate (birth_year)
--   - Medicare-dependent feature gating (is_on_medicare)
--   - Condition-driven activation mechanism (user_conditions)
--
-- Idempotent: all operations use IF NOT EXISTS guards.
-- Rollback:
--   DROP TABLE IF EXISTS user_conditions;
--   ALTER TABLE users DROP COLUMN IF EXISTS is_on_medicare;
--   ALTER TABLE users DROP COLUMN IF EXISTS birth_year;
-- ============================================================================

BEGIN;

-- 1. users.birth_year
--    NULL-tolerant. Legacy users prompted on next sign-in.
--    New signups required to provide via profile completion modal.
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_year INTEGER;

-- 2. users.is_on_medicare
--    Default false. User-editable via settings.
--    Backfilled below for users with active BB connections.
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_on_medicare
  BOOLEAN NOT NULL DEFAULT false;

-- 3. user_conditions table
--    Activation mechanism for condition-specific skills.
--    Per-user rows of active conditions (claims-inferred or
--    self-reported). Populated by Stage 9 extractors, not here.
CREATE TABLE IF NOT EXISTS user_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  condition_code TEXT NOT NULL,
  condition_category TEXT NOT NULL,
  source TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  confidence NUMERIC(3,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT user_conditions_category_check
    CHECK (condition_category IN (
      'prediabetes', 'type1', 'type2', 'obesity',
      'hypertension', 'dyslipidemia', 'ckd', 'cvd', 'depression'
    )),
  CONSTRAINT user_conditions_source_check
    CHECK (source IN ('claims', 'self_reported', 'ehr')),
  CONSTRAINT user_conditions_unique_active
    UNIQUE (user_id, condition_category, started_at)
);

CREATE INDEX IF NOT EXISTS idx_user_conditions_user_category
  ON user_conditions (user_id, condition_category);

CREATE INDEX IF NOT EXISTS idx_user_conditions_active
  ON user_conditions (user_id)
  WHERE ended_at IS NULL;

-- 4. Backfill is_on_medicare for users with active BB connections
--    Idempotent: only sets true where currently false AND BB
--    connection exists.
UPDATE users
SET is_on_medicare = true, updated_at = now()
WHERE is_on_medicare = false
  AND id IN (
    SELECT user_id FROM ehr_connections
    WHERE provider = 'blue_button' AND status = 'active'
  );

COMMIT;

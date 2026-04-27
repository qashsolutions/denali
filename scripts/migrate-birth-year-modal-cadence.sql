-- Stage 1.C migration: birth-year modal cadence columns
--
-- Adds two columns to support the birth-year prompt UX:
--   1. birth_year_modal_dismissed_at — timestamp of last
--      "Not now" click. Used for the 7-day cooldown before
--      re-prompting.
--   2. birth_year_modal_disabled — boolean, set when the
--      user explicitly turns off the reminder ("Don't show
--      again" button or Settings toggle). Server-managed via
--      dedicated endpoints, not via /api/profile PATCH.
--
-- Both columns are nullable/defaulted such that existing
-- rows have correct semantics post-migration:
--   dismissed_at = NULL     → never dismissed (modal eligible)
--   disabled     = false    → reminder enabled (modal eligible)
--
-- The modal will show when:
--   birth_year IS NULL
--   AND NOT birth_year_modal_disabled
--   AND (
--     birth_year_modal_dismissed_at IS NULL
--     OR birth_year_modal_dismissed_at < NOW() - INTERVAL '7 days'
--   )
--
-- Idempotent: safe to run multiple times.

BEGIN;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS birth_year_modal_dismissed_at TIMESTAMP NULL;

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS birth_year_modal_disabled BOOLEAN NOT NULL DEFAULT false;

COMMIT;

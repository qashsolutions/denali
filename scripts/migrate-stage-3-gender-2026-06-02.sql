-- Stage 3 schema migration: gender capture (Chunk 3)
-- Adds sex_at_birth (mandatory, gated at app layer via forced onboarding interstitial)
-- and gender_identity (optional, no gate) to users table.
--
-- Both columns are nullable TEXT. Value sets are enforced by TypeScript string-literal
-- unions in app code, NOT by DB CHECK constraints — USCDI value sets occasionally
-- evolve, and app-layer validation is more flexible to change than ALTER CONSTRAINT.
--
-- Backward-compatible with currently-running prod code (which doesn't read these
-- columns at all). Old code keeps running fine during the migrate-before-deploy window.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'sex_at_birth'
  ) THEN
    ALTER TABLE users ADD COLUMN sex_at_birth TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users' AND column_name = 'gender_identity'
  ) THEN
    ALTER TABLE users ADD COLUMN gender_identity TEXT;
  END IF;
END $$;

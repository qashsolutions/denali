-- ID.me Identity Verification Migration
-- Run on RDS before deploying ID.me integration
--
-- Adds ID.me verification columns to user_verification table.
-- Data minimization: only stores UUID, verification status, timestamp, and IAL level.
-- No PII (name, DOB, SSN, address) is stored.

ALTER TABLE user_verification
  ADD COLUMN IF NOT EXISTS idme_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS idme_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS idme_uuid TEXT,
  ADD COLUMN IF NOT EXISTS idme_ial_level TEXT;

-- Unique index on idme_uuid to prevent duplicate verifications
-- Partial index: only index non-null values
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_verification_idme_uuid
  ON user_verification(idme_uuid) WHERE idme_uuid IS NOT NULL;

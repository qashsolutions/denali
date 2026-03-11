-- Migration: Add first name and gender from ID.me identity verification
-- Run on RDS before deploy. Idempotent (IF NOT EXISTS).
--
-- Privacy note: We store ONLY first name and gender from ID.me (not last name,
-- DOB, SSN, address, phone). First name personalizes the AI chat experience;
-- gender is used for clinical context (screenings, drug interactions).
-- Full PII minimization per CLAUDE.md Privacy section.

ALTER TABLE user_verification
  ADD COLUMN IF NOT EXISTS idme_first_name TEXT,
  ADD COLUMN IF NOT EXISTS idme_gender TEXT;

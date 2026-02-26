-- AWS migration: add OTP + TOTP columns to user_verification
-- Apply this to RDS PostgreSQL AFTER the baseline schema.
--
-- Also drops the auth.users FK that only exists in Supabase.

-- 1. Drop Supabase-only FK (auth.users doesn't exist on RDS)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_id_fkey;

-- 2. OTP columns for email sign-in
ALTER TABLE public.user_verification
  ADD COLUMN IF NOT EXISTS otp_code TEXT,
  ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMPTZ;

-- 3. TOTP columns for authenticator app MFA
ALTER TABLE public.user_verification
  ADD COLUMN IF NOT EXISTS totp_secret TEXT,
  ADD COLUMN IF NOT EXISTS totp_enrolled_at TIMESTAMPTZ;

-- 4. Index for OTP lookup by expiry (cleanup queries)
CREATE INDEX IF NOT EXISTS idx_user_verification_otp_expires
  ON public.user_verification (otp_expires_at)
  WHERE otp_expires_at IS NOT NULL;

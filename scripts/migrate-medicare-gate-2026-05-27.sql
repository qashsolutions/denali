-- Stage 2: Medicare gate + appeals gating
-- Date: 2026-05-27
-- Schema: is_on_medicare becomes nullable (null = haven't asked).
-- Data fixes: admin test accounts for end-to-end verification.
--
-- SAFETY NOTE (merge-patterns.md § 2 stop-and-investigate output):
-- This migration contains ALTER COLUMN ... DROP NOT NULL, which the doc's
-- safety grep flags. DROP NOT NULL is constraint relaxation, not data or
-- column destruction — the column and its data are preserved; only the
-- non-null constraint is removed. The is_on_medicare column already exists
-- in both staging and prod RDS (applied via Stage 1 on 2026-04-22 staging
-- and 2026-05-25 prod). Investigated and approved by operator on 2026-05-27.
-- Operations below are guarded for idempotence so re-running is safe.

BEGIN;

-- 1. Drop NOT NULL constraint (idempotent: only if currently NOT NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'is_on_medicare'
      AND is_nullable = 'NO'
  ) THEN
    EXECUTE 'ALTER TABLE users ALTER COLUMN is_on_medicare DROP NOT NULL';
  END IF;
END $$;

-- 2. Set default to NULL (idempotent: only if default is not already NULL)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'users'
      AND column_name = 'is_on_medicare'
      AND column_default IS NOT NULL
  ) THEN
    EXECUTE 'ALTER TABLE users ALTER COLUMN is_on_medicare SET DEFAULT NULL';
  END IF;
END $$;

-- 3. Data fixes: idempotent by fixed target values + WHERE on unique email
UPDATE users SET is_on_medicare = true WHERE email = 'ceeveear@yahoo.com';
UPDATE users SET is_on_medicare = NULL WHERE email = 'ramanac@gmail.com';

-- 4. Verify
SELECT email, is_on_medicare, created_at
  FROM users
  WHERE email IN ('ceeveear@yahoo.com', 'ramanac@gmail.com');

COMMIT;

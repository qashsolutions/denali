-- Baseline DDL for audit_logs table
-- Captured from production on 2026-04-10.
-- This table pre-existed this migration file — it was created during the
-- Supabase era and carried over to AWS RDS during the 2026-02 migration.
-- This migration is idempotent and safe to run against existing production databases.
--
-- HIPAA §164.312(b): audit_logs must be append-only with 6-year retention.
-- The REVOKE statements at the bottom enforce append-only at the database level.

-- ── Table Definition ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES users(id) ON DELETE SET NULL,
  action        TEXT NOT NULL,
  resource_type TEXT,
  resource_id   TEXT,
  metadata      JSONB DEFAULT '{}'::jsonb,
  ip_address    TEXT,
  user_agent    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- Index for user-scoped queries (dedup check, user activity history)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user
  ON audit_logs (user_id, created_at DESC);

-- Index for action-scoped queries (grouped audit log display)
CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON audit_logs (action, created_at DESC);

-- ── Append-Only Enforcement ───────────────────────────────────────────────
-- The application DB user (denali_admin) should only INSERT and SELECT.
-- UPDATE, DELETE, and TRUNCATE are revoked to enforce HIPAA 6-year retention.
-- Only a DBA with superuser/rds_superuser privileges can modify audit rows.

REVOKE UPDATE, DELETE, TRUNCATE ON audit_logs FROM denali_admin;
GRANT INSERT, SELECT ON audit_logs TO denali_admin;

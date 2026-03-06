-- Health Reports Migration
-- Creates table for Claude-generated health summary reports.
-- Run on RDS before deploying the health report feature.
-- Idempotent: safe to run multiple times.

-- Create health_reports table
CREATE TABLE IF NOT EXISTS health_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  share_token UUID NOT NULL DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'ready', 'failed')),
  report_data JSONB,
  source_hash TEXT,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '30 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique index on share_token for public lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_health_reports_share_token ON health_reports(share_token);

-- Index on user_id for user's reports
CREATE INDEX IF NOT EXISTS idx_health_reports_user_id ON health_reports(user_id);

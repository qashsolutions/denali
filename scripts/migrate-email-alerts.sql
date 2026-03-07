-- Medicare Email Alerts Migration
-- Creates alert_preferences (opt-out model) and alert_log (dedup + audit) tables.
-- Run: psql $DATABASE_URL -f scripts/migrate-email-alerts.sql

-- Alert preferences (opt-out: no row = enabled)
CREATE TABLE IF NOT EXISTS alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'appeal_deadline', 'med_refill', 'new_denial', 'data_refresh'
  )),
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, alert_type)
);

-- Alert send log (dedup + audit trail)
CREATE TABLE IF NOT EXISTS alert_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'appeal_deadline', 'med_refill', 'new_denial', 'data_refresh', 'outcome_followup'
  )),
  dedup_key TEXT NOT NULL,
  email TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resend_id TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('sent', 'bounced', 'failed')),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_alert_log_dedup ON alert_log (user_id, alert_type, dedup_key);

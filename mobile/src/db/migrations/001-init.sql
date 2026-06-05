-- 001-init.sql — initial Phase 1 SQLCipher schema
--
-- Owned by: mobile-local-data-modeler (Wave 1).
-- Spec:     docs/design/phase-1-45plus.md § Local data model
-- Contract: mobile/src/contracts/LocalDataDAL.ts (frozen).
--
-- Pattern mirror: server-side diabetes_snapshots
--   (app/src/lib/fhir/snapshots.ts + UNIQUE(user_id, loinc_code, observed_date)
--   ON CONFLICT DO NOTHING). Mobile generalizes that to
--   UNIQUE(user_id, code, effective_at) across all observation categories.
--
-- Invariants enforced here:
--   2. Encrypted at rest — schema is meaningful only after PRAGMA key is set
--      at open time (see src/db/open.ts).
--   4. Append-only time-series — UNIQUE(user_id, code, effective_at) + the
--      DAL inserts with ON CONFLICT DO NOTHING. Corrections insert a new row
--      with supersedes_id pointing at the old row. Never UPDATE value cols.
--
-- Idempotent: all CREATE TABLE / CREATE INDEX use IF NOT EXISTS so the
-- migration is safe to re-run on every open until the migration runner is
-- introduced.

-- ─── profile ─────────────────────────────────────────────────────────────
-- Local mirror of the authenticated user (Cognito sub as PK).
-- Single-row table in practice; the DAL's getProfile() returns the most
-- recently updated row.
CREATE TABLE IF NOT EXISTS profile (
  id              TEXT PRIMARY KEY,                -- Cognito sub
  email           TEXT NOT NULL,
  plan            TEXT NOT NULL DEFAULT 'trial',
  birth_year      INTEGER,
  is_on_medicare  INTEGER,                         -- 0 | 1 | NULL (SQLite has no BOOLEAN)
  sex_at_birth    TEXT,
  gender_identity TEXT,
  created_at      TEXT NOT NULL,                   -- ISO8601
  updated_at      TEXT NOT NULL,                   -- ISO8601
  CHECK (plan IN ('trial', 'starter', 'plus', 'unlimited')),
  CHECK (is_on_medicare IS NULL OR is_on_medicare IN (0, 1)),
  CHECK (
    sex_at_birth IS NULL OR
    sex_at_birth IN ('male', 'female', 'intersex', 'unknown')
  ),
  CHECK (
    gender_identity IS NULL OR
    gender_identity IN (
      'male', 'female', 'non-binary',
      'transgender-male', 'transgender-female',
      'other', 'prefer-not-to-say'
    )
  )
);

-- ─── observations ────────────────────────────────────────────────────────
-- Append-only time series — generalizes diabetes_snapshots to every
-- observation category. Corrections insert a new row with supersedes_id;
-- the original row is never UPDATEd or DELETEd.
CREATE TABLE IF NOT EXISTS observations (
  id             TEXT PRIMARY KEY,
  user_id        TEXT NOT NULL,
  category       TEXT NOT NULL,
  code_system    TEXT NOT NULL,
  code           TEXT NOT NULL,
  display        TEXT NOT NULL,
  value_num      REAL,
  value_text     TEXT,
  unit           TEXT,
  source         TEXT NOT NULL,
  effective_at   TEXT NOT NULL,                    -- ISO8601 (server's observed_date)
  recorded_at    TEXT NOT NULL,                    -- ISO8601 (insert time)
  report_id      TEXT,
  supersedes_id  TEXT,
  metadata_json  TEXT,
  CHECK (category IN (
    'anthropometric', 'vital', 'biomarker', 'symptom',
    'questionnaire', 'screening', 'lifestyle',
    'family_history', 'condition'
  )),
  CHECK (code_system IN ('LOINC', 'SNOMED', 'ICD10', 'internal')),
  CHECK (source IN (
    'fhir', 'log', 'self_reported', 'uploaded_report', 'derived'
  ))
);

-- Append-only key: collisions are no-ops at the DAL layer
-- (INSERT … ON CONFLICT DO NOTHING). Mirrors the server's
-- diabetes_snapshots UNIQUE(user_id, loinc_code, observed_date).
CREATE UNIQUE INDEX IF NOT EXISTS observations_unique_user_code_effective
  ON observations (user_id, code, effective_at);

-- Common read paths: timeline-by-category and per-report review.
CREATE INDEX IF NOT EXISTS observations_user_category_effective_idx
  ON observations (user_id, category, effective_at DESC);

CREATE INDEX IF NOT EXISTS observations_user_code_effective_idx
  ON observations (user_id, code, effective_at DESC);

CREATE INDEX IF NOT EXISTS observations_report_id_idx
  ON observations (report_id);

CREATE INDEX IF NOT EXISTS observations_supersedes_id_idx
  ON observations (supersedes_id);

-- ─── conditions ──────────────────────────────────────────────────────────
-- Local mirror of server's user_conditions (scripts/migrate-user-prerequisites.sql).
-- Mobile extends `source` with 'uploaded_report' (server has claims|self_reported|ehr).
CREATE TABLE IF NOT EXISTS conditions (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL,
  condition_code     TEXT NOT NULL,
  condition_category TEXT NOT NULL,
  source             TEXT NOT NULL,
  started_at         TEXT NOT NULL,                -- ISO8601
  ended_at           TEXT,                         -- ISO8601 | NULL
  confidence         REAL,                         -- 0..1
  CHECK (condition_category IN (
    'prediabetes', 'type1', 'type2', 'obesity',
    'hypertension', 'dyslipidemia', 'ckd', 'cvd', 'depression'
  )),
  CHECK (source IN ('claims', 'self_reported', 'ehr', 'uploaded_report')),
  CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE INDEX IF NOT EXISTS conditions_user_category_idx
  ON conditions (user_id, condition_category);

CREATE INDEX IF NOT EXISTS conditions_user_active_idx
  ON conditions (user_id) WHERE ended_at IS NULL;

-- ─── reports ─────────────────────────────────────────────────────────────
-- Pointer + metadata for an uploaded document. The encrypted blob itself
-- lives outside the DB at `file_blob_ref`; the DAL never opens it.
CREATE TABLE IF NOT EXISTS reports (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  type              TEXT NOT NULL,
  file_blob_ref     TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  uploaded_at       TEXT NOT NULL,                 -- ISO8601
  parsed_at         TEXT,                          -- ISO8601 | NULL
  parse_status      TEXT NOT NULL DEFAULT 'pending',
  summary_text      TEXT,
  CHECK (type IN ('lab', 'ehr', 'visit')),
  CHECK (parse_status IN (
    'pending', 'parsing', 'confirmed', 'partial', 'rejected'
  ))
);

CREATE INDEX IF NOT EXISTS reports_user_uploaded_idx
  ON reports (user_id, uploaded_at DESC);

-- ─── analyses ────────────────────────────────────────────────────────────
-- On-device record of transient Bedrock inferences (invariant 5: nothing
-- persisted server-side; the device keeps the audit trail).
CREATE TABLE IF NOT EXISTS analyses (
  id                         TEXT PRIMARY KEY,
  user_id                    TEXT NOT NULL,
  requested_at               TEXT NOT NULL,        -- ISO8601
  input_observation_ids_json TEXT NOT NULL,
  model_used                 TEXT NOT NULL,
  result_text                TEXT NOT NULL,
  result_structured_json     TEXT
);

CREATE INDEX IF NOT EXISTS analyses_user_requested_idx
  ON analyses (user_id, requested_at DESC);

-- ─── chat_messages ───────────────────────────────────────────────────────
-- Local-only chat persistence (invariant 1: chat is not persisted server-side).
CREATE TABLE IF NOT EXISTS chat_messages (
  id          TEXT PRIMARY KEY,
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL,                       -- ISO8601
  session_id  TEXT,
  CHECK (role IN ('user', 'assistant', 'system'))
);

CREATE INDEX IF NOT EXISTS chat_messages_session_created_idx
  ON chat_messages (session_id, created_at);

-- ─── schema_migrations ───────────────────────────────────────────────────
-- One row per applied migration; the open module reads this on every open
-- to decide whether to apply the next file.
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  applied_at TEXT NOT NULL                         -- ISO8601
);

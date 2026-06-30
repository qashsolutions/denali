/**
 * Migration registry — owned by mobile-local-data-modeler (Wave 1).
 *
 * Each migration is the SQL body of the matching `NNN-name.sql` file in this
 * directory, inlined as a template-literal export so both Metro (which has
 * no .sql loader) and vitest (Node) can consume the same source.
 *
 * Editing convention: when adding a migration,
 *   1. Author and review the SQL in `NNN-name.sql` (human-readable artifact).
 *   2. Copy the EXACT body into this file as a string export.
 *   3. Append to the `MIGRATIONS` array. NEVER reorder, NEVER edit a migration
 *      that has already shipped — write a new one.
 *
 * The migration runner lives in `src/db/open.ts`.
 */

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

/**
 * 001-init — initial schema (profile, observations, conditions, reports,
 * analyses, chat_messages, schema_migrations).
 *
 * MIRROR of `src/db/migrations/001-init.sql`. If you edit one, edit both.
 */
const M001_INIT = `
-- profile
CREATE TABLE IF NOT EXISTS profile (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL,
  plan            TEXT NOT NULL DEFAULT 'trial',
  birth_year      INTEGER,
  is_on_medicare  INTEGER,
  sex_at_birth    TEXT,
  gender_identity TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
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

-- observations (append-only)
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
  effective_at   TEXT NOT NULL,
  recorded_at    TEXT NOT NULL,
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
CREATE UNIQUE INDEX IF NOT EXISTS observations_unique_user_code_effective
  ON observations (user_id, code, effective_at);
CREATE INDEX IF NOT EXISTS observations_user_category_effective_idx
  ON observations (user_id, category, effective_at DESC);
CREATE INDEX IF NOT EXISTS observations_user_code_effective_idx
  ON observations (user_id, code, effective_at DESC);
CREATE INDEX IF NOT EXISTS observations_report_id_idx
  ON observations (report_id);
CREATE INDEX IF NOT EXISTS observations_supersedes_id_idx
  ON observations (supersedes_id);

-- conditions
CREATE TABLE IF NOT EXISTS conditions (
  id                 TEXT PRIMARY KEY,
  user_id            TEXT NOT NULL,
  condition_code     TEXT NOT NULL,
  condition_category TEXT NOT NULL,
  source             TEXT NOT NULL,
  started_at         TEXT NOT NULL,
  ended_at           TEXT,
  confidence         REAL,
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

-- reports
CREATE TABLE IF NOT EXISTS reports (
  id                TEXT PRIMARY KEY,
  user_id           TEXT NOT NULL,
  type              TEXT NOT NULL,
  file_blob_ref     TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  uploaded_at       TEXT NOT NULL,
  parsed_at         TEXT,
  parse_status      TEXT NOT NULL DEFAULT 'pending',
  summary_text      TEXT,
  CHECK (type IN ('lab', 'ehr', 'visit')),
  CHECK (parse_status IN (
    'pending', 'parsing', 'confirmed', 'partial', 'rejected'
  ))
);
CREATE INDEX IF NOT EXISTS reports_user_uploaded_idx
  ON reports (user_id, uploaded_at DESC);

-- analyses
CREATE TABLE IF NOT EXISTS analyses (
  id                         TEXT PRIMARY KEY,
  user_id                    TEXT NOT NULL,
  requested_at               TEXT NOT NULL,
  input_observation_ids_json TEXT NOT NULL,
  model_used                 TEXT NOT NULL,
  result_text                TEXT NOT NULL,
  result_structured_json     TEXT
);
CREATE INDEX IF NOT EXISTS analyses_user_requested_idx
  ON analyses (user_id, requested_at DESC);

-- chat_messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id          TEXT PRIMARY KEY,
  role        TEXT NOT NULL,
  content     TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  session_id  TEXT,
  CHECK (role IN ('user', 'assistant', 'system'))
);
CREATE INDEX IF NOT EXISTS chat_messages_session_created_idx
  ON chat_messages (session_id, created_at);

-- schema_migrations
CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  name       TEXT NOT NULL,
  applied_at TEXT NOT NULL
);
`;

/** Ordered registry. Append-only. Never reorder. Never edit a shipped entry. */
export const MIGRATIONS: ReadonlyArray<Migration> = [
  { version: 1, name: "001-init", sql: M001_INIT },
];

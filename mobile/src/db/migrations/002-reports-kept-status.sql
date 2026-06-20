-- 002-reports-kept-status — add the 'kept' parse_status (CU-3).
--
-- "kept" = the user pressed Save on the review screen with no values accepted,
-- a deliberate decision to keep the DOCUMENT on file. The 001-init CHECK
-- constraint only allowed pending/parsing/confirmed/partial/rejected, so writing
-- 'kept' would violate it. SQLite cannot ALTER a CHECK in place, so rebuild the
-- reports table with the expanded constraint, preserving every row + the index.
-- No declared foreign keys reference reports, so no FK toggling is needed.
--
-- MIRROR of the M002 string in src/db/migrations/index.ts. If you edit one, edit
-- both. Append-only: never edit a shipped migration.

DROP TABLE IF EXISTS reports_m002;

CREATE TABLE reports_m002 (
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
    'pending', 'parsing', 'confirmed', 'partial', 'rejected', 'kept'
  ))
);

INSERT INTO reports_m002
  SELECT id, user_id, type, file_blob_ref, original_filename,
         uploaded_at, parsed_at, parse_status, summary_text
  FROM reports;

DROP TABLE reports;
ALTER TABLE reports_m002 RENAME TO reports;

CREATE INDEX IF NOT EXISTS reports_user_uploaded_idx
  ON reports (user_id, uploaded_at DESC);

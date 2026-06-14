-- Zero-knowledge backup blob store (decision D16; docs/design/zk-backup-v1.md §5).
-- Date: 2026-06-14
--
-- Stores ONLY client-side-encrypted ciphertext + wrapping metadata that the
-- server CANNOT decrypt. The decryption key (recovery key / DEK) never reaches
-- the server — invariant 3, and the ZK supersession of invariant 6. No plaintext
-- health data is ever stored here; `ciphertext` and the *_dek/*_nonce/*_salt
-- columns are opaque hex blobs, `manifest` is non-secret metadata only (counts +
-- versions; NO content hash — the AES-GCM tag already guarantees integrity, and a
-- plaintext hash server-side would be a needless plaintext fingerprint).
--
-- v1 retention: last-write-wins single snapshot per user (the PUT handler
-- deletes prior rows in the same transaction). Run manually, in order, BEFORE
-- deploying the /api/backup route. Idempotent; wrapped in a transaction so a
-- partial apply (table without its index) cannot occur.

BEGIN;

CREATE TABLE IF NOT EXISTS backup_blobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  version       INTEGER NOT NULL,          -- envelope schema version
  kek_salt      TEXT NOT NULL,             -- hex; HKDF salt for the KEK
  wrap_nonce    TEXT NOT NULL,             -- hex; AEAD nonce wrapping the DEK
  wrapped_dek   TEXT NOT NULL,             -- hex; DEK encrypted under the KEK
  data_nonce    TEXT NOT NULL,             -- hex; AEAD nonce for the payload
  ciphertext    TEXT NOT NULL,             -- hex; encrypted health-record export (opaque)
  manifest      JSONB NOT NULL,            -- non-secret: counts + versions only
  size_bytes    BIGINT NOT NULL,           -- ciphertext size, for quota/telemetry
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Latest-per-user lookup (GET returns the newest row).
CREATE INDEX IF NOT EXISTS idx_backup_blobs_user_created
  ON backup_blobs (user_id, created_at DESC);

-- The app's RDS role needs DML; the route does SELECT / INSERT / DELETE (no UPDATE).
-- Safe to run even if denali_admin already owns the table.
GRANT SELECT, INSERT, DELETE ON backup_blobs TO denali_admin;

COMMENT ON TABLE backup_blobs IS
  'Zero-knowledge backup ciphertext (D16). Server-undecryptable; no plaintext PHI. Decryption key is on-device only.';

COMMIT;

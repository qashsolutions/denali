/**
 * Backup manifest — non-secret metadata describing an encrypted backup. It is
 * stored alongside the ciphertext AND bound into the AEAD as additional-
 * authenticated-data, so a swapped or edited manifest causes decryption to
 * fail (an attacker can't, e.g., splice a different user's ciphertext under a
 * forged manifest). Carries NO PHI and NO key material.
 */

export interface BackupManifest {
  /** Backup envelope format version (bumped on envelope-shape changes). */
  schemaVersion: number;
  /** Health-record (DAL) schema version the payload was exported from. */
  appDataVersion: number;
  /** Coarse counts for restore UX + integrity sanity — not the data itself. */
  recordCounts: {
    observations: number;
    conditions: number;
    profile: number;
  };
  /** Lowercase-hex SHA-256 of the plaintext payload (defense-in-depth). */
  contentHash: string;
  /** ISO-8601 creation time, supplied by the caller (kept out of pure code). */
  createdAtIso: string;
}

/**
 * Canonical AEAD additional-authenticated-data for a manifest. Fields are
 * emitted in a FIXED order (a tuple, not the object) so seal and open derive
 * byte-identical AAD regardless of key ordering.
 */
export function manifestAad(m: BackupManifest): Uint8Array {
  const canonical = JSON.stringify([
    m.schemaVersion,
    m.appDataVersion,
    m.recordCounts.observations,
    m.recordCounts.conditions,
    m.recordCounts.profile,
    m.contentHash,
    m.createdAtIso,
  ]);
  return new TextEncoder().encode(canonical);
}

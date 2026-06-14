/**
 * Backup envelope — the zero-knowledge seal/open orchestration
 * (docs/design/zk-backup-v1.md §3). Pure: every primitive comes from the
 * injected BackupCrypto, so this is fully unit-testable with real crypto.
 *
 * Key hierarchy:
 *   RK  (recovery key, 256-bit, on-device CSPRNG; the user safeguards it)
 *    └─ KEK = HKDF-SHA256(RK, kekSalt, "denali-backup-kek-v1")
 *        └─ wraps a per-backup random DEK (AES-256-GCM)
 *            └─ DEK encrypts the health-record export (AES-256-GCM, manifest as AAD)
 *
 * The server stores only the SealedBackup struct (ciphertext + wrapping
 * metadata + manifest) — never the RK, the DEK, or any plaintext. Restore
 * needs the RK, which exists only on the user's devices/keychain.
 */

import {
  type BackupCrypto,
  KEY_BYTES,
  NONCE_BYTES,
} from "./cryptoProvider";
import { type BackupManifest, manifestAad } from "./manifest";

/** Bump when the envelope shape or KDF parameters change. */
export const BACKUP_SCHEMA_VERSION = 1;

/** HKDF `info` — domain-separates this KEK from any future derived key. */
const KEK_INFO = new TextEncoder().encode("denali-backup-kek-v1");

/** Everything the server stores. All fields are non-secret EXCEPT that none
 *  of them, alone or together, can decrypt without the RK. */
export interface SealedBackup {
  version: number;
  /** HKDF salt for KEK = HKDF(RK, kekSalt). */
  kekSalt: Uint8Array;
  /** Nonce used to wrap the DEK under the KEK. */
  wrapNonce: Uint8Array;
  /** The DEK, AES-256-GCM-encrypted under the KEK. */
  wrappedDek: Uint8Array;
  /** Nonce used to encrypt the payload under the DEK. */
  dataNonce: Uint8Array;
  /** The health-record export, AES-256-GCM-encrypted under the DEK. */
  ciphertext: Uint8Array;
  manifest: BackupManifest;
}

/** Decryption failure (wrong recovery key, tampered blob, or hash mismatch).
 *  Carries no plaintext / key material in its message. */
export class BackupDecryptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupDecryptError";
  }
}

/**
 * Seal a plaintext payload into an uploadable SealedBackup. `schemaVersion` is
 * stamped here; the caller supplies the rest of the manifest (counts, app-data
 * version, timestamp).
 */
export function sealBackup(
  crypto: BackupCrypto,
  recoveryKey: Uint8Array,
  payload: Uint8Array,
  meta: Omit<BackupManifest, "schemaVersion">,
): SealedBackup {
  const manifest: BackupManifest = {
    ...meta,
    schemaVersion: BACKUP_SCHEMA_VERSION,
  };

  const kekSalt = crypto.randomBytes(KEY_BYTES);
  const kek = crypto.hkdfSha256(recoveryKey, kekSalt, KEK_INFO, KEY_BYTES);

  const dek = crypto.randomBytes(KEY_BYTES);
  const wrapNonce = crypto.randomBytes(NONCE_BYTES);
  const wrappedDek = crypto.aeadSeal(kek, wrapNonce, dek);

  const dataNonce = crypto.randomBytes(NONCE_BYTES);
  const ciphertext = crypto.aeadSeal(
    dek,
    dataNonce,
    payload,
    manifestAad(manifest),
  );

  return {
    version: BACKUP_SCHEMA_VERSION,
    kekSalt,
    wrapNonce,
    wrappedDek,
    dataNonce,
    ciphertext,
    manifest,
  };
}

/**
 * Open a SealedBackup with the recovery key. Throws BackupDecryptError if the
 * RK is wrong, the blob/manifest was tampered, or the content hash mismatches.
 */
export function openBackup(
  crypto: BackupCrypto,
  recoveryKey: Uint8Array,
  sealed: SealedBackup,
): Uint8Array {
  const kek = crypto.hkdfSha256(
    recoveryKey,
    sealed.kekSalt,
    KEK_INFO,
    KEY_BYTES,
  );

  let dek: Uint8Array;
  try {
    dek = crypto.aeadOpen(kek, sealed.wrapNonce, sealed.wrappedDek);
  } catch {
    throw new BackupDecryptError(
      "Could not unwrap the data key — wrong recovery key or corrupted backup.",
    );
  }

  let payload: Uint8Array;
  try {
    payload = crypto.aeadOpen(
      dek,
      sealed.dataNonce,
      sealed.ciphertext,
      manifestAad(sealed.manifest),
    );
  } catch {
    throw new BackupDecryptError(
      "Backup payload failed authentication — corrupted or tampered.",
    );
  }

  // No separate content-hash check: the AES-GCM auth tag already guarantees the
  // payload decrypted authentically (a wrong key or tampered blob throws above).
  // A plaintext hash is redundant and was removed so the server never holds a
  // plaintext fingerprint (ZK review, 2026-06-14).
  return payload;
}

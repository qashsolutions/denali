/**
 * Backup crypto provider — the vetted primitives behind zero-knowledge backup
 * (docs/design/zk-backup-v1.md §3), wrapped in a tiny INJECTABLE interface so
 * the envelope logic stays pure and unit-testable with real crypto.
 *
 * Primitives come from @noble (audited, pure-JS — runs in Hermes with no native
 * module; the AEAD/HKDF ops have no Web-Crypto dependency, verified by spike).
 * The CSPRNG is INJECTED — expo-crypto in the app, deterministic/node in tests —
 * so this module never hand-rolls crypto and never seeds from a weak source.
 *
 * INVARIANT 3 ("login ≠ encryption key"): nothing here derives a key from any
 * Cognito sub, JWT, email, or other server-issued value. Keys are random
 * (RK/DEK) or HKDF-derived from the random RK (KEK).
 */

import { gcm } from "@noble/ciphers/aes.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 } from "@noble/hashes/sha2.js";

/** 256-bit keys; 96-bit nonces (AES-GCM standard). */
export const KEY_BYTES = 32;
export const NONCE_BYTES = 12;

/** Secure random byte source — supplied by the caller (never Math.random). */
export type RandomBytes = (length: number) => Uint8Array;

export interface BackupCrypto {
  /** CSPRNG bytes (expo-crypto in app; deterministic/node in tests). */
  randomBytes: RandomBytes;
  /** HKDF-SHA256 (extract + expand). */
  hkdfSha256(
    ikm: Uint8Array,
    salt: Uint8Array,
    info: Uint8Array,
    length: number,
  ): Uint8Array;
  /** AES-256-GCM seal → ciphertext‖tag. Optional additional-authenticated-data. */
  aeadSeal(
    key: Uint8Array,
    nonce: Uint8Array,
    plaintext: Uint8Array,
    aad?: Uint8Array,
  ): Uint8Array;
  /** AES-256-GCM open. THROWS if the auth tag fails (wrong key or tampered). */
  aeadOpen(
    key: Uint8Array,
    nonce: Uint8Array,
    ciphertext: Uint8Array,
    aad?: Uint8Array,
  ): Uint8Array;
  /** SHA-256 digest (payload content-hash). */
  sha256(data: Uint8Array): Uint8Array;
}

/**
 * Build a provider over @noble with the given CSPRNG. The app wires
 * `expo-crypto`'s `getRandomBytes`; tests inject node randomness or a
 * deterministic generator.
 */
export function createBackupCrypto(randomBytes: RandomBytes): BackupCrypto {
  return {
    randomBytes,
    hkdfSha256: (ikm, salt, info, length) =>
      hkdf(sha256, ikm, salt, info, length),
    aeadSeal: (key, nonce, plaintext, aad) =>
      gcm(key, nonce, aad).encrypt(plaintext),
    aeadOpen: (key, nonce, ciphertext, aad) =>
      gcm(key, nonce, aad).decrypt(ciphertext),
    sha256: (data) => sha256(data),
  };
}

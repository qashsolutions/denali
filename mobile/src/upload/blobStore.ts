/**
 * Phase 1 mobile — encrypted on-device blob storage for uploaded reports.
 *
 * Wave 2 / mobile-upload-parse-builder.
 *
 * Invariant 2 ("Encrypted at rest. SQLCipher DB; uploaded files stored as
 * encrypted on-device blobs.") is satisfied here. Reports are written to
 * `<documentDirectory>/reports/<reportId>.bin` as:
 *
 *     [12-byte IV] [ciphertext + GCM tag]
 *
 * AES-256-GCM via `expo-crypto`'s native key + sealed-data implementation.
 *
 * INVARIANT 3 ("login ≠ encryption key"):
 *   - The blob encryption key is derived via HKDF-SHA-256 from the SAME
 *     root key in `mobile/src/db/keystore.ts` (`getOrCreateDbKey()`),
 *     with `info = "denali.reports.v1"`.
 *   - Domain separation via `info` means the SQLCipher passphrase and the
 *     blob key are cryptographically distinct, even though both descend
 *     from the same on-device root.
 *   - The blob key is NEVER reused as the SQLCipher passphrase and NEVER
 *     derived from any server-issued value (Cognito sub, JWT, etc.).
 *
 * Static-source enforcement: a sibling test (`__tests__/blobStore.test.ts`)
 * greps this module's source and asserts absence of `@/auth`, `fetch`,
 * `XMLHttpRequest`, `cognito`, `jwt`, `refresh_token`, `access_token`.
 */

import * as Crypto from "expo-crypto";
import {
  AESEncryptionKey,
  AESSealedData,
  aesDecryptAsync,
  aesEncryptAsync,
} from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";

import { getOrCreateDbKey } from "@/db/keystore";

/**
 * HKDF info string. Versioned so a future key-rotation can use
 * `denali.reports.v2` without re-encrypting v1 blobs.
 */
const HKDF_INFO = "denali.reports.v1";

/** Length of the AES key in bytes (AES-256). */
const AES_KEY_BYTES = 32;

/** Length of the AES-GCM IV in bytes. The standard / SP 800-38D recommended size. */
const IV_BYTES = 12;

/** Subdirectory inside documentDirectory where encrypted blobs live. */
const REPORTS_SUBDIR = "reports";

// ── Public API ───────────────────────────────────────────────────────────

/**
 * Encrypt the source file at `sourceUri` and persist it under
 * `<documentDirectory>/reports/<reportId>.bin`.
 *
 * Returns the path (file:// URI) of the encrypted blob — this is what the
 * DAL stores in `reports.file_blob_ref`. The plaintext is NEVER persisted.
 *
 * The picker hands us a URI to a temp file (Expo's `copyToCacheDirectory`).
 * We do NOT touch that temp file beyond reading its bytes; the OS cleans it
 * up. We do not leave a plaintext copy anywhere.
 */
export async function storeBlob(
  reportId: string,
  sourceUri: string,
): Promise<string> {
  assertValidReportId(reportId);

  // 1. Read plaintext bytes from the picker's temp file.
  const sourceFile = new File(sourceUri);
  const plaintext = await sourceFile.bytes();

  // 2. Derive the blob key.
  const key = await deriveBlobKey();

  // 3. Generate a 12-byte IV and AES-GCM encrypt.
  const iv = Crypto.getRandomBytes(IV_BYTES);
  const sealed = await aesEncryptAsync(plaintext, key, {
    nonce: { bytes: iv },
  });

  // 4. Pull combined bytes (IV + ciphertext + tag) for compact on-disk format.
  const combined = await sealed.combined("bytes");

  // 5. Ensure the reports subdirectory exists, then write atomically.
  const dir = ensureReportsDir();
  const out = new File(dir, `${reportId}.bin`);
  if (out.exists) {
    // Overwrite is intentional — the report row is the source of truth for
    // identity; if a re-upload happens for the same id, the latest bytes win.
    out.delete();
  }
  out.create();
  out.write(combined);

  return out.uri;
}

/**
 * Read + decrypt the blob for `reportId`. Used by the OCR / PDF-text
 * extractor; never streamed off-device.
 *
 * Throws if the blob is missing or fails authentication (wrong key, tampered
 * file, or wrong info-string domain).
 */
export async function readBlob(reportId: string): Promise<Uint8Array> {
  assertValidReportId(reportId);

  const dir = ensureReportsDir();
  const file = new File(dir, `${reportId}.bin`);
  if (!file.exists) {
    throw new Error(`[blobStore] No blob for report ${reportId}`);
  }

  const combined = await file.bytes();
  if (combined.byteLength <= IV_BYTES) {
    throw new Error(`[blobStore] Blob for ${reportId} is truncated`);
  }

  const key = await deriveBlobKey();
  const sealed = AESSealedData.fromCombined(combined);
  const plaintext = await aesDecryptAsync(sealed, key, { output: "bytes" });
  return plaintext;
}

/**
 * Delete the on-disk blob for `reportId`. No-op if the file doesn't exist.
 * Callers should also clear the corresponding `reports` row through the DAL.
 */
export function deleteBlob(reportId: string): void {
  assertValidReportId(reportId);
  const dir = ensureReportsDir();
  const file = new File(dir, `${reportId}.bin`);
  if (file.exists) file.delete();
}

// ── HKDF-SHA-256 ─────────────────────────────────────────────────────────

/**
 * Derive the AES-256 blob key from the on-device root using HKDF-SHA-256
 * (RFC 5869) with no salt and `info = HKDF_INFO`. Output length is 32 bytes
 * (one HMAC-SHA-256 block, so the Expand step is a single iteration).
 *
 * Memoized per process — keystore reads are cheap but skipping them keeps
 * the hot path responsive when the user uploads several files in a row.
 */
let cachedKeyPromise: Promise<AESEncryptionKey> | null = null;

async function deriveBlobKey(): Promise<AESEncryptionKey> {
  if (cachedKeyPromise) return cachedKeyPromise;
  cachedKeyPromise = (async () => {
    const rootHex = await getOrCreateDbKey();
    const rootBytes = hexToBytes(rootHex);
    const derivedBytes = await hkdfSha256(
      rootBytes,
      /* salt */ new Uint8Array(0),
      utf8(HKDF_INFO),
      AES_KEY_BYTES,
    );
    return await AESEncryptionKey.import(derivedBytes);
  })().catch((err) => {
    // Don't cache failures — next call should retry.
    cachedKeyPromise = null;
    throw err;
  });
  return cachedKeyPromise;
}

/**
 * Test-only — clear the memoized key. Used by unit tests that exercise the
 * fresh-derivation path. Real callers don't need to call this.
 */
export function __dangerouslyClearBlobKeyCacheForTests(): void {
  cachedKeyPromise = null;
}

/**
 * HKDF as in RFC 5869, restricted to a single-block output (sufficient for
 * a 32-byte AES-256 key with SHA-256 as the underlying hash).
 */
async function hkdfSha256(
  ikm: Uint8Array,
  salt: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  if (length > 32) {
    // Single-block HKDF-Expand maxes at hashLen (32 for SHA-256). We never
    // need more here; surface a clear error if someone tries.
    throw new Error(`[blobStore] hkdfSha256: length must be <= 32 (got ${length})`);
  }

  // HKDF-Extract: PRK = HMAC-SHA256(salt, IKM). If salt is empty, use a
  // 32-byte zero buffer per the RFC.
  const usedSalt = salt.byteLength === 0 ? new Uint8Array(32) : salt;
  const prk = await hmacSha256(usedSalt, ikm);

  // HKDF-Expand (single block): T(1) = HMAC-SHA256(PRK, info || 0x01).
  const expandInput = new Uint8Array(info.byteLength + 1);
  expandInput.set(info, 0);
  expandInput[info.byteLength] = 0x01;
  const t1 = await hmacSha256(prk, expandInput);

  return t1.slice(0, length);
}

/**
 * HMAC-SHA-256 built on `Crypto.digest(SHA256, …)`. Standard RFC 2104
 * construction with 64-byte block size.
 */
async function hmacSha256(
  key: Uint8Array,
  msg: Uint8Array,
): Promise<Uint8Array> {
  const BLOCK = 64;

  // If key is longer than block size, hash it down first.
  let k0: Uint8Array;
  if (key.byteLength > BLOCK) {
    k0 = new Uint8Array(await sha256(key));
  } else {
    k0 = new Uint8Array(BLOCK);
    k0.set(key, 0);
  }
  if (k0.byteLength < BLOCK) {
    const padded = new Uint8Array(BLOCK);
    padded.set(k0, 0);
    k0 = padded;
  }

  const ipad = new Uint8Array(BLOCK);
  const opad = new Uint8Array(BLOCK);
  for (let i = 0; i < BLOCK; i++) {
    ipad[i] = k0[i] ^ 0x36;
    opad[i] = k0[i] ^ 0x5c;
  }

  const inner = new Uint8Array(BLOCK + msg.byteLength);
  inner.set(ipad, 0);
  inner.set(msg, BLOCK);
  const innerHash = new Uint8Array(await sha256(inner));

  const outer = new Uint8Array(BLOCK + innerHash.byteLength);
  outer.set(opad, 0);
  outer.set(innerHash, BLOCK);
  return new Uint8Array(await sha256(outer));
}

async function sha256(data: Uint8Array): Promise<ArrayBuffer> {
  return await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, data);
}

// ── Helpers ──────────────────────────────────────────────────────────────

function ensureReportsDir(): Directory {
  const dir = new Directory(Paths.document, REPORTS_SUBDIR);
  if (!dir.exists) dir.create({ intermediates: true });
  return dir;
}

function assertValidReportId(reportId: string): void {
  // Defense against path traversal — the DAL generates UUIDs, but never trust.
  if (!/^[A-Za-z0-9_-]+$/.test(reportId)) {
    throw new Error(`[blobStore] Invalid reportId: ${reportId}`);
  }
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("[blobStore] hex string must have even length");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    const byte = parseInt(hex.substr(i * 2, 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error("[blobStore] non-hex character in key string");
    }
    out[i] = byte;
  }
  return out;
}

function utf8(s: string): Uint8Array {
  // RN provides global TextEncoder via React Native core (0.85+).
  return new TextEncoder().encode(s);
}

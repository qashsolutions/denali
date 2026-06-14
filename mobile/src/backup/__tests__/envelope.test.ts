/**
 * ZK backup crypto core — real-crypto unit tests (no mock: @noble is pure JS,
 * so vitest exercises the actual AEAD/HKDF). Proves correctness (RFC 5869
 * vector), the full seal/open round-trip, and that wrong-key / tampered-blob /
 * tampered-manifest all fail closed.
 */

import { randomBytes as nodeRandomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import { createBackupCrypto, type RandomBytes } from "../cryptoProvider";
import {
  BACKUP_SCHEMA_VERSION,
  BackupDecryptError,
  openBackup,
  sealBackup,
} from "../envelope";
import { type BackupManifest } from "../manifest";

const rng: RandomBytes = (n) => new Uint8Array(nodeRandomBytes(n));
const crypto = createBackupCrypto(rng);

const utf8 = (s: string) => new TextEncoder().encode(s);
const hex = (u8: Uint8Array) => Buffer.from(u8).toString("hex");

const META: Omit<BackupManifest, "schemaVersion" | "contentHash"> = {
  appDataVersion: 3,
  recordCounts: { observations: 412, conditions: 19, profile: 1 },
  createdAtIso: "2026-06-14T10:00:00.000Z",
};

const PAYLOAD = utf8(
  JSON.stringify({ observations: [{ code: "2160-0", value: 1.1 }], profile: { birth_year: 1979 } }),
);

describe("HKDF-SHA256 provider correctness (RFC 5869 Test Case 1)", () => {
  it("derives the published OKM", () => {
    const ikm = new Uint8Array(22).fill(0x0b);
    const salt = Uint8Array.from(Array.from({ length: 13 }, (_, i) => i));
    const info = Uint8Array.from([
      0xf0, 0xf1, 0xf2, 0xf3, 0xf4, 0xf5, 0xf6, 0xf7, 0xf8, 0xf9,
    ]);
    const okm = crypto.hkdfSha256(ikm, salt, info, 42);
    expect(hex(okm)).toBe(
      "3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865",
    );
  });
});

describe("sealBackup / openBackup envelope", () => {
  it("round-trips the payload with the correct recovery key", () => {
    const rk = rng(32);
    const sealed = sealBackup(crypto, rk, PAYLOAD, META);
    const opened = openBackup(crypto, rk, sealed);
    expect(hex(opened)).toBe(hex(PAYLOAD));
  });

  it("stamps schemaVersion + content hash, and carries the caller meta", () => {
    const rk = rng(32);
    const sealed = sealBackup(crypto, rk, PAYLOAD, META);
    expect(sealed.manifest.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(sealed.manifest.contentHash).toBe(hex(crypto.sha256(PAYLOAD)));
    expect(sealed.manifest.appDataVersion).toBe(3);
    expect(sealed.manifest.recordCounts.observations).toBe(412);
    expect(sealed.manifest.createdAtIso).toBe("2026-06-14T10:00:00.000Z");
  });

  it("never stores the payload in the clear (ciphertext differs from plaintext)", () => {
    const rk = rng(32);
    const sealed = sealBackup(crypto, rk, PAYLOAD, META);
    expect(hex(sealed.ciphertext)).not.toBe(hex(PAYLOAD));
    // ciphertext+tag is longer than plaintext (GCM 16-byte tag appended).
    expect(sealed.ciphertext.length).toBe(PAYLOAD.length + 16);
  });

  it("uses fresh salt + nonces per seal (no reuse across backups)", () => {
    const rk = rng(32);
    const a = sealBackup(crypto, rk, PAYLOAD, META);
    const b = sealBackup(crypto, rk, PAYLOAD, META);
    expect(hex(a.kekSalt)).not.toBe(hex(b.kekSalt));
    expect(hex(a.dataNonce)).not.toBe(hex(b.dataNonce));
    expect(hex(a.wrapNonce)).not.toBe(hex(b.wrapNonce));
    expect(hex(a.ciphertext)).not.toBe(hex(b.ciphertext));
  });

  it("fails closed with the WRONG recovery key", () => {
    const sealed = sealBackup(crypto, rng(32), PAYLOAD, META);
    expect(() => openBackup(crypto, rng(32), sealed)).toThrow(BackupDecryptError);
  });

  it("fails closed on a TAMPERED ciphertext (AEAD auth tag)", () => {
    const rk = rng(32);
    const sealed = sealBackup(crypto, rk, PAYLOAD, META);
    sealed.ciphertext[0] ^= 0x01;
    expect(() => openBackup(crypto, rk, sealed)).toThrow(BackupDecryptError);
  });

  it("fails closed on a TAMPERED manifest (AAD binding)", () => {
    const rk = rng(32);
    const sealed = sealBackup(crypto, rk, PAYLOAD, META);
    // Forge the record count — manifest is bound as AAD, so open must reject.
    sealed.manifest.recordCounts.observations = 9999;
    expect(() => openBackup(crypto, rk, sealed)).toThrow(BackupDecryptError);
  });
});

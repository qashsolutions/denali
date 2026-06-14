/**
 * Wire codec — converts a SealedBackup (binary fields) to/from a JSON-safe
 * shape for transport to `/api/backup` and back (docs/design/zk-backup-v1.md
 * §5). Byte fields are hex-encoded; the manifest is already JSON-safe and
 * passes through unchanged.
 *
 * This is CLIENT-side: the server stores/returns the WireBackup verbatim (it
 * never decodes or decrypts). `wireToSealed` validates the downloaded shape and
 * fails closed (WireFormatError) on a malformed/incomplete blob so a corrupt
 * server response can't reach the AEAD layer as garbage.
 *
 * Hex (2× size) is the v1 encoding for simplicity; base64 is a later size
 * optimization. Health-record exports are small, so this is fine for v1.
 */

import { bytesToHex, hexToBytes } from "@noble/ciphers/utils.js";

import { type SealedBackup } from "./envelope";
import { type BackupManifest } from "./manifest";

/** JSON-serializable form of a SealedBackup (byte fields → hex strings). */
export interface WireBackup {
  version: number;
  kekSalt: string;
  wrapNonce: string;
  wrappedDek: string;
  dataNonce: string;
  ciphertext: string;
  manifest: BackupManifest;
}

export class WireFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WireFormatError";
  }
}

export function sealedToWire(s: SealedBackup): WireBackup {
  return {
    version: s.version,
    kekSalt: bytesToHex(s.kekSalt),
    wrapNonce: bytesToHex(s.wrapNonce),
    wrappedDek: bytesToHex(s.wrappedDek),
    dataNonce: bytesToHex(s.dataNonce),
    ciphertext: bytesToHex(s.ciphertext),
    manifest: s.manifest,
  };
}

const HEX_FIELDS = [
  "kekSalt",
  "wrapNonce",
  "wrappedDek",
  "dataNonce",
  "ciphertext",
] as const;

/**
 * Validate + decode a downloaded WireBackup. Throws WireFormatError if a hex
 * field is missing/non-string/invalid-hex or the manifest is absent.
 */
export function wireToSealed(w: unknown): SealedBackup {
  if (typeof w !== "object" || w === null) {
    throw new WireFormatError("Backup wire payload is not an object.");
  }
  const obj = w as Record<string, unknown>;
  if (typeof obj.version !== "number") {
    throw new WireFormatError("Backup wire payload is missing a version.");
  }
  if (typeof obj.manifest !== "object" || obj.manifest === null) {
    throw new WireFormatError("Backup wire payload is missing a manifest.");
  }

  const decoded: Record<string, Uint8Array> = {};
  for (const field of HEX_FIELDS) {
    const value = obj[field];
    if (typeof value !== "string") {
      throw new WireFormatError(`Backup wire field "${field}" is not a string.`);
    }
    try {
      decoded[field] = hexToBytes(value);
    } catch {
      throw new WireFormatError(`Backup wire field "${field}" is not valid hex.`);
    }
  }

  return {
    version: obj.version,
    kekSalt: decoded.kekSalt,
    wrapNonce: decoded.wrapNonce,
    wrappedDek: decoded.wrappedDek,
    dataNonce: decoded.dataNonce,
    ciphertext: decoded.ciphertext,
    manifest: obj.manifest as BackupManifest,
  };
}

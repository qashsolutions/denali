/**
 * TOTP (RFC 6238) implementation using Node.js crypto only.
 * No external library required.
 * Compatible with Google Authenticator, Authy, and any RFC 6238 TOTP app.
 */

import { createHmac, randomBytes } from "crypto";

const BASE32_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf: Buffer): string {
  let result = "";
  let bits = 0;
  let value = 0;
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      result += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    result += BASE32_CHARS[(value << (5 - bits)) & 31];
  }
  return result;
}

function base32Decode(str: string): Buffer {
  const s = str.toUpperCase().replace(/=+$/, "");
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;
  for (const char of s) {
    const idx = BASE32_CHARS.indexOf(char);
    if (idx === -1) throw new Error(`Invalid base32 character: ${char}`);
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

function computeHOTP(key: Buffer, counter: bigint): string {
  const msg = Buffer.alloc(8);
  msg.writeBigInt64BE(counter);
  const hmac = createHmac("sha1", key);
  hmac.update(msg);
  const hash = hmac.digest();
  const offset = hash[hash.length - 1] & 0x0f;
  const code =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);
  return String(code % 1_000_000).padStart(6, "0");
}

/**
 * Generate a random TOTP secret (20 bytes, base32-encoded).
 */
export function generateTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

/**
 * Build an otpauth:// URI for QR code display in authenticator apps.
 */
export function generateTotpUri(secret: string, email: string, issuer = "Denali"): string {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Verify a 6-digit TOTP code.
 * Accepts codes from the previous, current, and next 30-second window (skew=1).
 */
export function verifyTotp(secret: string, token: string, skew = 1): boolean {
  if (!/^\d{6}$/.test(token)) return false;
  try {
    const key = base32Decode(secret);
    const now = BigInt(Math.floor(Date.now() / 1000 / 30));
    for (let w = -skew; w <= skew; w++) {
      if (computeHOTP(key, now + BigInt(w)) === token) return true;
    }
    return false;
  } catch {
    return false;
  }
}

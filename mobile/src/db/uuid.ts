/**
 * UUID v4 helper — owned by mobile-local-data-modeler.
 *
 * We delegate to the platform CSPRNG (`crypto.getRandomValues`) only. RN
 * 0.85 ships a global `crypto` shim that satisfies the Web Crypto subset
 * we use; Node 20+ does the same. No fallback to `Math.random` — if
 * randomness is unavailable, we'd rather crash loudly than emit a
 * predictable id into the local DB.
 *
 * Why hand-rolled instead of `uuid` package: keeps the mobile bundle lean
 * and avoids pulling a Node-targeting package into Metro. The output is
 * RFC 4122 §4.4 compliant (version 4, variant 10).
 */

function getRandomBytes(length: number): Uint8Array {
  const cryptoObj = (globalThis as { crypto?: Crypto }).crypto;
  if (!cryptoObj || typeof cryptoObj.getRandomValues !== "function") {
    throw new Error(
      "[uuid] No CSPRNG available — refusing to emit a non-random id.",
    );
  }
  const buf = new Uint8Array(length);
  cryptoObj.getRandomValues(buf);
  return buf;
}

export function uuidv4(): string {
  const bytes = getRandomBytes(16);
  // Version 4 in the high nibble of byte 6
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Variant 10 in the high nibble of byte 8
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex: string[] = [];
  for (let i = 0; i < 16; i++) hex.push(bytes[i].toString(16).padStart(2, "0"));
  return (
    hex.slice(0, 4).join("") +
    "-" +
    hex.slice(4, 6).join("") +
    "-" +
    hex.slice(6, 8).join("") +
    "-" +
    hex.slice(8, 10).join("") +
    "-" +
    hex.slice(10, 16).join("")
  );
}

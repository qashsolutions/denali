/**
 * Test-only stub for `expo-crypto`.
 *
 * Why: the real `expo-crypto` imports `expo-modules-core` which pulls in
 * `react-native`'s entry, which Vite/vitest's Node SSR transform can't
 * parse (Flow + JSX syntax). Any test that transitively imports
 * `expo-crypto` (via `mobile/src/db/uuid.ts`, `mobile/src/db/keystore.ts`,
 * or `mobile/src/upload/blobStore.ts`) would fail to load otherwise.
 *
 * Wiring: `vitest.config.ts` aliases `expo-crypto` → this file.
 * `keystore.test.ts` still vi.mocks `expo-crypto` to override these
 * defaults with deterministic bytes; the alias is the underlying module
 * the mock replaces.
 *
 * We use Node's `crypto.randomBytes` here — that IS a CSPRNG, so tests
 * exercise the real "secure" code path (the keystore's no-CSPRNG branch
 * still gets coverage by tests that overwrite this module).
 */

import { randomBytes } from "node:crypto";

export function getRandomBytes(byteCount: number): Uint8Array {
  return new Uint8Array(randomBytes(byteCount));
}

export async function getRandomBytesAsync(
  byteCount: number,
): Promise<Uint8Array> {
  return getRandomBytes(byteCount);
}

export function getRandomValues<
  T extends
    | Int8Array
    | Uint8Array
    | Int16Array
    | Uint16Array
    | Int32Array
    | Uint32Array,
>(typedArray: T): T {
  const buf = randomBytes(typedArray.byteLength);
  for (let i = 0; i < buf.length; i++) {
    typedArray[i] = buf[i] as never;
  }
  return typedArray;
}

export function randomUUID(): string {
  const bytes = randomBytes(16);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
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

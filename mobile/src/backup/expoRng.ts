/**
 * Production backup crypto — binds the provider to expo-crypto's platform
 * CSPRNG (the same FIPS-grade source the SQLCipher keystore uses). Kept out of
 * the pure modules so they stay vitest-testable with an injected RNG; this
 * adapter is the one place that touches the native CSPRNG.
 */

import * as Crypto from "expo-crypto";

import {
  type BackupCrypto,
  createBackupCrypto,
  type RandomBytes,
} from "./cryptoProvider";

export const expoRandomBytes: RandomBytes = (length) => {
  if (typeof Crypto.getRandomBytes !== "function") {
    throw new Error(
      "[backup] No platform CSPRNG available — refusing to generate key material.",
    );
  }
  return Crypto.getRandomBytes(length);
};

/** App-wide backup crypto provider: expo-crypto CSPRNG + @noble primitives. */
export const backupCrypto: BackupCrypto = createBackupCrypto(expoRandomBytes);

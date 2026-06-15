/**
 * Recovery-key store — persists the backup recovery key on-device in the OS
 * secure enclave (expo-secure-store), under a label DISTINCT from the SQLCipher
 * key. This is a same-device CONVENIENCE so "Back up now" + auto-backup don't
 * re-prompt for the phrase; it is NOT the cross-device recovery mechanism — that
 * is the BIP39 kit the user saves. (expo-secure-store is device-local; iCloud /
 * Google keychain SYNC is a flagged follow-up needing a custom native module.)
 *
 * Invariant 3: the key here is on-device CSPRNG, never derived from login.
 *
 * The interface is exported so the backup controller can take it as an injected
 * dependency (and tests can supply an in-memory fake without the native module).
 */

import { bytesToHex, hexToBytes } from "@noble/ciphers/utils.js";
import * as SecureStore from "expo-secure-store";

export interface RecoveryKeyStore {
  save(rk: Uint8Array): Promise<void>;
  load(): Promise<Uint8Array | null>;
  clear(): Promise<void>;
}

const RK_LABEL = "denali.backup.rk.v1";

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const recoveryKeyStore: RecoveryKeyStore = {
  async save(rk) {
    await SecureStore.setItemAsync(RK_LABEL, bytesToHex(rk), OPTIONS);
  },
  async load() {
    const hex = await SecureStore.getItemAsync(RK_LABEL, OPTIONS);
    return hex ? hexToBytes(hex) : null;
  },
  async clear() {
    await SecureStore.deleteItemAsync(RK_LABEL);
  },
};

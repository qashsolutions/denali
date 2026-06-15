/**
 * Backup controller — the operations the UI calls. Ties the recovery key, the
 * on-device crypto, the local key store, and the remote API together. All
 * native/IO is reached through injected dependencies, so the orchestration is
 * unit-tested with a mock ApiClient + in-memory store + real crypto.
 *
 *   enableBackup       generate RK -> store locally -> upload first snapshot ->
 *                      return the BIP39 phrase for the recovery kit
 *   backupNow          load RK -> upload (throws if backup isn't enabled here)
 *   restoreFromPhrase  phrase -> RK -> download+decrypt+import -> remember RK
 *   disableBackup      delete server backup -> clear local RK
 */

import type { ApiClient, LocalDataDAL } from "@/contracts";

import type { ImportResult } from "./backupService";
import type { BackupCrypto, RandomBytes } from "./cryptoProvider";
import {
  generateRecoveryKey,
  phraseToRecoveryKey,
  recoveryKeyToPhrase,
} from "./recoveryKey";
import type { RecoveryKeyStore } from "./recoveryKeyStore";
import {
  deleteServerBackup,
  restoreBackupFromServer,
  uploadBackup,
} from "./remoteBackup";

export class BackupNotEnabledError extends Error {
  constructor() {
    super("Backup isn't enabled on this device.");
    this.name = "BackupNotEnabledError";
  }
}

export interface BackupDeps {
  api: ApiClient;
  dal: LocalDataDAL;
  crypto: BackupCrypto;
  store: RecoveryKeyStore;
  randomBytes: RandomBytes;
  /** Injected clock (Date is fine in app code; injected for test determinism). */
  nowIso: () => string;
}

export interface EnableBackupResult {
  /** The 24-word BIP39 phrase to show in the recovery kit (show ONCE). */
  phrase: string;
  sizeBytes: number;
}

/** First-time enable: mint a recovery key, store it, upload, return the phrase. */
export async function enableBackup(deps: BackupDeps): Promise<EnableBackupResult> {
  const rk = generateRecoveryKey(deps.randomBytes);
  await deps.store.save(rk);
  const { sizeBytes } = await uploadBackup(
    deps.api,
    deps.dal,
    deps.crypto,
    rk,
    deps.nowIso(),
  );
  return { phrase: recoveryKeyToPhrase(rk), sizeBytes };
}

/** Manual / automatic re-upload using the device-stored recovery key. */
export async function backupNow(deps: BackupDeps): Promise<{ sizeBytes: number }> {
  const rk = await deps.store.load();
  if (!rk) throw new BackupNotEnabledError();
  return uploadBackup(deps.api, deps.dal, deps.crypto, rk, deps.nowIso());
}

/**
 * Restore on a new device from the recovery phrase. Returns null if the server
 * has no backup; throws InvalidRecoveryPhraseError on a bad phrase and
 * BackupDecryptError on a valid-but-wrong phrase. On success the RK is stored
 * locally so future backups don't re-prompt.
 */
export async function restoreFromPhrase(
  deps: BackupDeps,
  phrase: string,
): Promise<ImportResult | null> {
  const rk = phraseToRecoveryKey(phrase);
  const result = await restoreBackupFromServer(deps.api, deps.dal, deps.crypto, rk);
  if (result) await deps.store.save(rk);
  return result;
}

/** Turn backup off: delete the server copy, then forget the local key. */
export async function disableBackup(deps: BackupDeps): Promise<void> {
  await deleteServerBackup(deps.api);
  await deps.store.clear();
}

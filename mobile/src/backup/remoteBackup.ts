/**
 * Remote backup — the network layer for ZK backup (docs/design/zk-backup-v1.md
 * §5/§6). Wires the on-device crypto (createEncryptedBackup /
 * restoreEncryptedBackup) to /api/backup via the injected ApiClient + the wire
 * codec. The server only ever receives ciphertext; the recovery key never
 * leaves this process.
 *
 * Mobile has no HTTP PUT (the ApiClient verb set is GET/POST/PATCH/DELETE), so
 * upload uses POST — the route exposes a POST alias of PUT (mirrors the consent
 * route's PATCH alias).
 *
 * Type-only imports of the contracts keep this module free of the native auth
 * graph, so it unit-tests with a mock ApiClient + real crypto.
 */

import type { ApiClient, LocalDataDAL } from "@/contracts";

import {
  createEncryptedBackup,
  restoreEncryptedBackup,
  type ImportResult,
} from "./backupService";
import type { BackupCrypto } from "./cryptoProvider";
import type { BackupManifest } from "./manifest";
import { sealedToWire, wireToSealed } from "./wire";

const BACKUP_PATH = "/api/backup";

/** True for an HttpError-shaped 404 (no backup on the server yet). */
function isNotFound(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { status?: unknown }).status === 404
  );
}

/** Encrypt the local record on-device and upload it (last-write-wins). */
export async function uploadBackup(
  api: ApiClient,
  dal: LocalDataDAL,
  crypto: BackupCrypto,
  recoveryKey: Uint8Array,
  nowIso: string,
): Promise<{ sizeBytes: number }> {
  const sealed = await createEncryptedBackup(dal, crypto, recoveryKey, nowIso);
  const res = await api.apiPost<{ success: boolean; sizeBytes: number }>(
    BACKUP_PATH,
    sealedToWire(sealed),
  );
  return { sizeBytes: res.sizeBytes };
}

/**
 * Read the server backup's manifest WITHOUT decrypting (non-secret metadata —
 * counts/versions/date) so the restore screen can preview it before the user
 * supplies their recovery key. Returns null when the server has no backup.
 */
export async function peekServerBackup(
  api: ApiClient,
): Promise<BackupManifest | null> {
  try {
    const wire = await api.apiGet<unknown>(BACKUP_PATH);
    return wireToSealed(wire).manifest;
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
}

/**
 * Download + decrypt + import the server backup into the local DAL. Returns
 * null when the server has no backup (404). Throws BackupDecryptError on a
 * wrong recovery key, BackupDataError on an incompatible payload.
 */
export async function restoreBackupFromServer(
  api: ApiClient,
  dal: LocalDataDAL,
  crypto: BackupCrypto,
  recoveryKey: Uint8Array,
): Promise<ImportResult | null> {
  let wire: unknown;
  try {
    wire = await api.apiGet<unknown>(BACKUP_PATH);
  } catch (err) {
    if (isNotFound(err)) return null;
    throw err;
  }
  const sealed = wireToSealed(wire);
  return restoreEncryptedBackup(dal, crypto, recoveryKey, sealed);
}

/** Delete the server backup (opt-out / disable cloud backup). */
export async function deleteServerBackup(api: ApiClient): Promise<void> {
  await api.apiDelete<{ success: boolean }>(BACKUP_PATH);
}

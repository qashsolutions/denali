/**
 * Backup service — bridges the local DAL to the ZK envelope (docs/design/
 * zk-backup-v1.md §4). Export reads the durable health record; import writes
 * it back through the append-only DAL (idempotent — ON CONFLICT DO NOTHING).
 * The encrypted-backup orchestration here is what the (later) upload/restore
 * UI calls; it never persists plaintext anywhere off-device.
 */

import type { LocalDataDAL } from "@/contracts";

import type { BackupCrypto } from "./cryptoProvider";
import { openBackup, sealBackup, type SealedBackup } from "./envelope";
import {
  BACKUP_DATA_VERSION,
  type BackupData,
  deriveRecordCounts,
  deserializeBackupData,
  serializeBackupData,
} from "./payload";

export interface ImportResult {
  observationsInserted: number;
  observationsSkipped: number;
  conditionsInserted: number;
  conditionsSkipped: number;
  profileRestored: boolean;
}

/**
 * Read the durable health record off the DAL. Observations include the FULL
 * history (latest_only: false) so supersede chains survive a round-trip;
 * conditions include inactive ones. `exportedAtIso` is supplied by the caller.
 */
export async function exportHealthRecord(
  dal: LocalDataDAL,
  exportedAtIso: string,
): Promise<BackupData> {
  const profile = await dal.getProfile();
  const observations = await dal.listObservations({ latest_only: false });
  const conditions = profile
    ? await dal.listConditions(profile.id, { active_only: false })
    : [];
  return {
    dataVersion: BACKUP_DATA_VERSION,
    exportedAtIso,
    profile,
    observations,
    conditions,
  };
}

/**
 * Write a health record back through the DAL. Idempotent: duplicate
 * observations/conditions resolve to no-ops via the DAL's append-only
 * ON CONFLICT DO NOTHING, so re-importing the same backup inserts nothing new.
 * Observations are inserted oldest-first (by recorded_at) so supersede chains
 * land after the rows they reference.
 */
export async function importHealthRecord(
  dal: LocalDataDAL,
  data: BackupData,
): Promise<ImportResult> {
  const result: ImportResult = {
    observationsInserted: 0,
    observationsSkipped: 0,
    conditionsInserted: 0,
    conditionsSkipped: 0,
    profileRestored: false,
  };

  if (data.profile) {
    await dal.upsertProfile({
      id: data.profile.id,
      email: data.profile.email,
      plan: data.profile.plan,
      birth_year: data.profile.birth_year,
      is_on_medicare: data.profile.is_on_medicare,
      sex_at_birth: data.profile.sex_at_birth,
      gender_identity: data.profile.gender_identity,
    });
    result.profileRestored = true;
  }

  const ordered = [...data.observations].sort((a, b) =>
    a.recorded_at.localeCompare(b.recorded_at),
  );
  for (const o of ordered) {
    const { inserted } = await dal.insertObservation({
      id: o.id,
      user_id: o.user_id,
      category: o.category,
      code_system: o.code_system,
      code: o.code,
      display: o.display,
      value_num: o.value_num,
      value_text: o.value_text,
      unit: o.unit,
      source: o.source,
      effective_at: o.effective_at,
      recorded_at: o.recorded_at,
      report_id: o.report_id,
      supersedes_id: o.supersedes_id,
      metadata_json: o.metadata_json,
    });
    if (inserted) result.observationsInserted++;
    else result.observationsSkipped++;
  }

  for (const c of data.conditions) {
    const { inserted } = await dal.insertCondition({
      id: c.id,
      user_id: c.user_id,
      condition_code: c.condition_code,
      condition_category: c.condition_category,
      source: c.source,
      started_at: c.started_at,
      ended_at: c.ended_at,
      confidence: c.confidence,
    });
    if (inserted) result.conditionsInserted++;
    else result.conditionsSkipped++;
  }

  return result;
}

/**
 * Full create path: export → serialize → seal. Returns the uploadable
 * SealedBackup (ciphertext + wrapping metadata + manifest). `nowIso` stamps
 * both the export and the manifest.
 */
export async function createEncryptedBackup(
  dal: LocalDataDAL,
  crypto: BackupCrypto,
  recoveryKey: Uint8Array,
  nowIso: string,
): Promise<SealedBackup> {
  const data = await exportHealthRecord(dal, nowIso);
  const payload = serializeBackupData(data);
  return sealBackup(crypto, recoveryKey, payload, {
    appDataVersion: BACKUP_DATA_VERSION,
    recordCounts: deriveRecordCounts(data),
    createdAtIso: nowIso,
  });
}

/**
 * Full restore path: open (throws BackupDecryptError on wrong key/tamper) →
 * deserialize (throws BackupDataError on incompatible payload) → import.
 */
export async function restoreEncryptedBackup(
  dal: LocalDataDAL,
  crypto: BackupCrypto,
  recoveryKey: Uint8Array,
  sealed: SealedBackup,
): Promise<ImportResult> {
  const payload = openBackup(crypto, recoveryKey, sealed);
  const data = deserializeBackupData(payload);
  return importHealthRecord(dal, data);
}

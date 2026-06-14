/**
 * Backup payload — the plaintext shape that gets sealed (docs/design/
 * zk-backup-v1.md §4). The durable on-device health record: profile +
 * the full append-only observation history + conditions.
 *
 * EXCLUDED: chat (ephemeral, D11), transient analyses, and report file blobs
 * (binary; the structured observations extracted from reports ARE included via
 * `source: "uploaded_report"`). This is pure (serialize/deserialize/validate)
 * so it's fully unit-testable; the DAL read/write lives in backupService.ts.
 */

import type {
  ConditionRow,
  ObservationRow,
  ProfileRow,
} from "@/contracts";

/** Bump when the backed-up health-record shape changes. */
export const BACKUP_DATA_VERSION = 1;

export interface BackupData {
  /** Health-record schema version (gates restore compatibility). */
  dataVersion: number;
  /** ISO-8601 export time (supplied by the caller). */
  exportedAtIso: string;
  profile: ProfileRow | null;
  /** Full history including superseded rows (latest_only: false). */
  observations: ObservationRow[];
  conditions: ConditionRow[];
}

/** Thrown when a decrypted payload isn't a valid/compatible backup. */
export class BackupDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BackupDataError";
  }
}

export function serializeBackupData(data: BackupData): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(data));
}

/**
 * Parse + validate a decrypted payload. Throws BackupDataError on malformed
 * JSON, a missing/!==-current version, or wrong-typed top-level fields. (The
 * payload is already AEAD-authenticated by openBackup before it reaches here;
 * this guards against a same-key backup from an incompatible app version.)
 */
export function deserializeBackupData(bytes: Uint8Array): BackupData {
  let raw: unknown;
  try {
    raw = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new BackupDataError("Backup payload is not valid JSON.");
  }
  if (typeof raw !== "object" || raw === null) {
    throw new BackupDataError("Backup payload is not an object.");
  }
  const obj = raw as Record<string, unknown>;
  if (obj.dataVersion !== BACKUP_DATA_VERSION) {
    throw new BackupDataError(
      `Unsupported backup data version ${String(obj.dataVersion)} (this app reads v${BACKUP_DATA_VERSION}).`,
    );
  }
  if (!Array.isArray(obj.observations) || !Array.isArray(obj.conditions)) {
    throw new BackupDataError("Backup payload is missing record arrays.");
  }
  if (typeof obj.exportedAtIso !== "string") {
    throw new BackupDataError("Backup payload is missing exportedAtIso.");
  }
  if (obj.profile !== null && typeof obj.profile !== "object") {
    throw new BackupDataError("Backup payload has a malformed profile.");
  }
  return {
    dataVersion: BACKUP_DATA_VERSION,
    exportedAtIso: obj.exportedAtIso,
    profile: (obj.profile as ProfileRow | null) ?? null,
    observations: obj.observations as ObservationRow[],
    conditions: obj.conditions as ConditionRow[],
  };
}

/** Coarse counts for the manifest (restore UX + integrity sanity). */
export function deriveRecordCounts(data: BackupData): {
  observations: number;
  conditions: number;
  profile: number;
} {
  return {
    observations: data.observations.length,
    conditions: data.conditions.length,
    profile: data.profile ? 1 : 0,
  };
}

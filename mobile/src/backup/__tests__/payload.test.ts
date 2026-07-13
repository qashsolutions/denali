/**
 * Backup payload — serialize / deserialize / validate (pure).
 */

import { describe, expect, it } from "vitest";

import type { ConditionRow, ObservationRow, ProfileRow } from "@/contracts";

import {
  BACKUP_DATA_VERSION,
  type BackupData,
  BackupDataError,
  deriveRecordCounts,
  deserializeBackupData,
  serializeBackupData,
} from "../payload";

const profile: ProfileRow = {
  id: "u1",
  email: "a@b.co",
  plan: "trial",
  birth_year: 1979,
  is_on_medicare: false,
  sex_at_birth: "female",
  gender_identity: "female",
  pcos_history: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const obs: ObservationRow = {
  id: "o1",
  user_id: "u1",
  category: "biomarker",
  code_system: "LOINC",
  code: "2160-0",
  display: "Creatinine",
  value_num: 1.1,
  value_text: null,
  unit: "mg/dL",
  source: "uploaded_report",
  effective_at: "2026-01-01T00:00:00.000Z",
  recorded_at: "2026-01-02T00:00:00.000Z",
  report_id: null,
  supersedes_id: null,
  metadata_json: null,
};

const cond: ConditionRow = {
  id: "c1",
  user_id: "u1",
  condition_code: "E66.9",
  condition_category: "obesity",
  source: "self_reported",
  started_at: "2026-01-01T00:00:00.000Z",
  ended_at: null,
  confidence: 0.9,
};

const data: BackupData = {
  dataVersion: BACKUP_DATA_VERSION,
  exportedAtIso: "2026-06-14T10:00:00.000Z",
  profile,
  observations: [obs],
  conditions: [cond],
};

describe("serialize / deserialize round-trip", () => {
  it("preserves the full record", () => {
    const out = deserializeBackupData(serializeBackupData(data));
    expect(out).toEqual(data);
  });

  it("preserves a null profile + empty arrays", () => {
    const empty: BackupData = {
      dataVersion: BACKUP_DATA_VERSION,
      exportedAtIso: "2026-06-14T10:00:00.000Z",
      profile: null,
      observations: [],
      conditions: [],
    };
    expect(deserializeBackupData(serializeBackupData(empty))).toEqual(empty);
  });
});

describe("deserialize validation (fails closed)", () => {
  const enc = (o: unknown) => new TextEncoder().encode(JSON.stringify(o));

  it("rejects non-JSON", () => {
    expect(() =>
      deserializeBackupData(new TextEncoder().encode("not json{")),
    ).toThrow(BackupDataError);
  });

  it("rejects an incompatible data version", () => {
    expect(() =>
      deserializeBackupData(enc({ ...data, dataVersion: 99 })),
    ).toThrow(BackupDataError);
  });

  it("rejects missing record arrays", () => {
    expect(() =>
      deserializeBackupData(enc({ ...data, observations: undefined })),
    ).toThrow(BackupDataError);
  });

  it("rejects a malformed profile", () => {
    expect(() =>
      deserializeBackupData(enc({ ...data, profile: 42 })),
    ).toThrow(BackupDataError);
  });
});

describe("deriveRecordCounts", () => {
  it("counts observations, conditions, and profile presence", () => {
    expect(deriveRecordCounts(data)).toEqual({
      observations: 1,
      conditions: 1,
      profile: 1,
    });
  });

  it("reports profile: 0 when absent", () => {
    expect(deriveRecordCounts({ ...data, profile: null }).profile).toBe(0);
  });
});

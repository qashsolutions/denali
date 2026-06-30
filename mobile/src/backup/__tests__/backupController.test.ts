/**
 * Backup controller — enable / backupNow / restoreFromPhrase / disable, with a
 * mock ApiClient, an in-memory key store, a fake DAL, and real crypto.
 */

import { randomBytes as nodeRandomBytes } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ApiClient,
  ConditionInsertInput,
  LocalDataDAL,
  ObservationInsertInput,
  ObservationRow,
  ProfileUpsertInput,
} from "@/contracts";

import {
  backupNow,
  BackupNotEnabledError,
  type BackupDeps,
  disableBackup,
  enableBackup,
  restoreFromPhrase,
} from "../backupController";
import { createBackupCrypto, type RandomBytes } from "../cryptoProvider";
import { InvalidRecoveryPhraseError } from "../recoveryKey";
import type { RecoveryKeyStore } from "../recoveryKeyStore";

const rng: RandomBytes = (n) => new Uint8Array(nodeRandomBytes(n));
const crypto = createBackupCrypto(rng);

const OBS: ObservationRow = {
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

let inserted: ObservationInsertInput[] = [];
let stored: Uint8Array | null = null;

const dal = {
  getProfile: async () => null,
  listObservations: async () => [OBS],
  insertObservation: async (o: ObservationInsertInput) => {
    inserted.push(o);
    return { inserted: true, id: o.id ?? "x" };
  },
  insertCondition: async (c: ConditionInsertInput) => ({ inserted: true, id: c.id ?? "c" }),
  upsertProfile: async (p: ProfileUpsertInput) => p,
} as unknown as LocalDataDAL;

const api = {
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
} as unknown as ApiClient;

const store: RecoveryKeyStore = {
  save: vi.fn(async (k: Uint8Array) => { stored = k; }),
  load: vi.fn(async () => stored),
  clear: vi.fn(async () => { stored = null; }),
};

const deps: BackupDeps = {
  api,
  dal,
  crypto,
  store,
  randomBytes: rng,
  nowIso: () => "2026-06-14T10:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  inserted = [];
  stored = null;
  vi.mocked(api.apiPost).mockResolvedValue({ success: true, sizeBytes: 0 });
});

describe("enableBackup", () => {
  it("mints a 24-word phrase, stores the key, and uploads", async () => {
    const result = await enableBackup(deps);
    expect(result.phrase.split(" ")).toHaveLength(24);
    expect(store.save).toHaveBeenCalledTimes(1);
    expect(api.apiPost).toHaveBeenCalledWith("/api/backup", expect.any(Object));
  });
});

describe("backupNow", () => {
  it("throws when backup isn't enabled on this device", async () => {
    await expect(backupNow(deps)).rejects.toBeInstanceOf(BackupNotEnabledError);
  });

  it("uploads using the stored key once enabled", async () => {
    await enableBackup(deps);
    vi.mocked(api.apiPost).mockClear();
    await backupNow(deps);
    expect(api.apiPost).toHaveBeenCalledTimes(1);
  });
});

describe("restoreFromPhrase", () => {
  it("round-trips: the phrase decrypts the server backup and imports it", async () => {
    const { phrase } = await enableBackup(deps);
    const wireSent = vi.mocked(api.apiPost).mock.calls[0][1];
    vi.mocked(api.apiGet).mockResolvedValue(wireSent);

    inserted = [];
    stored = null;
    const result = await restoreFromPhrase(deps, phrase);

    expect(result?.observationsInserted).toBe(1);
    expect(inserted[0].code).toBe("2160-0");
    expect(store.save).toHaveBeenCalled(); // RK remembered after restore
  });

  it("throws on an invalid phrase (before any network call)", async () => {
    await expect(restoreFromPhrase(deps, "not a real phrase")).rejects.toBeInstanceOf(
      InvalidRecoveryPhraseError,
    );
    expect(api.apiGet).not.toHaveBeenCalled();
  });
});

describe("disableBackup", () => {
  it("deletes the server backup and clears the local key", async () => {
    vi.mocked(api.apiDelete).mockResolvedValue({ success: true });
    stored = rng(32);
    await disableBackup(deps);
    expect(api.apiDelete).toHaveBeenCalledWith("/api/backup");
    expect(store.clear).toHaveBeenCalledTimes(1);
  });
});

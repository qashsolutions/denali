/**
 * Remote backup network layer — upload/peek/restore/delete against a mock
 * ApiClient with real crypto. Includes the client-side body-spy guard: the
 * recovery key's bytes never appear in the uploaded request body.
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

import { createBackupCrypto, type RandomBytes } from "../cryptoProvider";
import { BackupDecryptError } from "../envelope";
import {
  deleteServerBackup,
  peekServerBackup,
  restoreBackupFromServer,
  uploadBackup,
} from "../remoteBackup";

const rng: RandomBytes = (n) => new Uint8Array(nodeRandomBytes(n));
const crypto = createBackupCrypto(rng);
const NOW = "2026-06-14T10:00:00.000Z";

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

// Source DAL (no profile → conditions skipped): one observation to back up.
const srcDal = {
  getProfile: async () => null,
  listObservations: async () => [OBS],
} as unknown as LocalDataDAL;

let insertedObs: ObservationInsertInput[] = [];
const destDal = {
  getProfile: async () => null,
  upsertProfile: async (p: ProfileUpsertInput) => p,
  insertObservation: async (o: ObservationInsertInput) => {
    insertedObs.push(o);
    return { inserted: true, id: o.id ?? "x" };
  },
  insertCondition: async (c: ConditionInsertInput) => ({
    inserted: true,
    id: c.id ?? "c",
  }),
} as unknown as LocalDataDAL;

const api = {
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
} as unknown as ApiClient;

beforeEach(() => {
  vi.clearAllMocks();
  insertedObs = [];
});

/** Upload with a known RK and return the wire body the client sent. */
async function uploadAndCapture(rk: Uint8Array): Promise<unknown> {
  vi.mocked(api.apiPost).mockResolvedValue({ success: true, sizeBytes: 0 });
  await uploadBackup(api, srcDal, crypto, rk, NOW);
  return vi.mocked(api.apiPost).mock.calls[0][1];
}

describe("uploadBackup", () => {
  it("POSTs the wire form to /api/backup", async () => {
    const body = await uploadAndCapture(rng(32));
    expect(api.apiPost).toHaveBeenCalledTimes(1);
    expect(vi.mocked(api.apiPost).mock.calls[0][0]).toBe("/api/backup");
    const wire = body as Record<string, unknown>;
    expect(typeof wire.ciphertext).toBe("string");
    expect(wire.ciphertext).toMatch(/^[0-9a-f]+$/);
    expect(wire.manifest).toBeTypeOf("object");
  });

  it("body-spy: the recovery key never appears in the uploaded body", async () => {
    const rk = rng(32);
    const body = await uploadAndCapture(rk);
    const json = JSON.stringify(body);
    expect(json).not.toContain(Buffer.from(rk).toString("hex"));
    expect(json).not.toContain("Uint8Array");
  });
});

describe("restoreBackupFromServer", () => {
  it("round-trips: server-stored wire decrypts + imports with the same RK", async () => {
    const rk = rng(32);
    const wireSent = await uploadAndCapture(rk);
    vi.mocked(api.apiGet).mockResolvedValue(wireSent);

    const result = await restoreBackupFromServer(api, destDal, crypto, rk);
    expect(result?.observationsInserted).toBe(1);
    expect(insertedObs[0].code).toBe("2160-0");
  });

  it("returns null when the server has no backup (404)", async () => {
    vi.mocked(api.apiGet).mockRejectedValue({ status: 404 });
    const result = await restoreBackupFromServer(api, destDal, crypto, rng(32));
    expect(result).toBeNull();
  });

  it("throws on the wrong recovery key", async () => {
    const wireSent = await uploadAndCapture(rng(32));
    vi.mocked(api.apiGet).mockResolvedValue(wireSent);
    await expect(
      restoreBackupFromServer(api, destDal, crypto, rng(32)),
    ).rejects.toBeInstanceOf(BackupDecryptError);
  });
});

describe("peekServerBackup", () => {
  it("returns the manifest (no decryption) for the restore preview", async () => {
    const wireSent = await uploadAndCapture(rng(32));
    vi.mocked(api.apiGet).mockResolvedValue(wireSent);
    const manifest = await peekServerBackup(api);
    expect(manifest?.recordCounts.observations).toBe(1);
  });

  it("returns null on 404", async () => {
    vi.mocked(api.apiGet).mockRejectedValue({ status: 404 });
    expect(await peekServerBackup(api)).toBeNull();
  });
});

describe("deleteServerBackup", () => {
  it("DELETEs /api/backup", async () => {
    vi.mocked(api.apiDelete).mockResolvedValue({ success: true });
    await deleteServerBackup(api);
    expect(api.apiDelete).toHaveBeenCalledWith("/api/backup");
  });
});

/**
 * Backup service — export/import + the encrypted create/restore round-trip,
 * exercised against an in-memory append-only DAL (ON CONFLICT DO NOTHING).
 */

import { randomBytes as nodeRandomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";

import type {
  AnalysisInsertInput,
  AnalysisRow,
  ChatMessageInsertInput,
  ChatMessageRow,
  ConditionInsertInput,
  ConditionRow,
  ConditionsFilter,
  LocalDataDAL,
  ObservationInsertInput,
  ObservationRow,
  ObservationsFilter,
  ProfileRow,
  ProfileUpsertInput,
  ReportInsertInput,
  ReportRow,
} from "@/contracts";

import { createBackupCrypto, type RandomBytes } from "../cryptoProvider";
import { createEncryptedBackup, restoreEncryptedBackup } from "../backupService";
import { BackupDecryptError } from "../envelope";

const rng: RandomBytes = (n) => new Uint8Array(nodeRandomBytes(n));
const crypto = createBackupCrypto(rng);
const NOW = "2026-06-14T10:00:00.000Z";

/** Minimal append-only in-memory DAL for the backup round-trip. */
class FakeDal implements LocalDataDAL {
  observations: ObservationRow[] = [];
  conditions: ConditionRow[] = [];
  profile: ProfileRow | null = null;

  async insertObservation(input: ObservationInsertInput) {
    const id = input.id ?? `o-${this.observations.length}`;
    const conflict = this.observations.some(
      (o) =>
        o.user_id === input.user_id &&
        o.code === input.code &&
        o.effective_at === input.effective_at,
    );
    if (conflict) return { inserted: false, id };
    this.observations.push({
      ...input,
      id,
      recorded_at: input.recorded_at ?? NOW,
    });
    return { inserted: true, id };
  }

  async listObservations(filter?: ObservationsFilter) {
    if (filter?.latest_only === false) return [...this.observations];
    const superseded = new Set(
      this.observations.map((o) => o.supersedes_id).filter(Boolean),
    );
    return this.observations.filter((o) => !superseded.has(o.id));
  }

  async insertCondition(input: ConditionInsertInput) {
    const id = input.id ?? `c-${this.conditions.length}`;
    if (this.conditions.some((c) => c.id === id)) return { inserted: false, id };
    this.conditions.push({ ...input, id });
    return { inserted: true, id };
  }

  async listConditions(userId: string, filter?: ConditionsFilter) {
    let rows = this.conditions.filter((c) => c.user_id === userId);
    if (filter?.active_only !== false) rows = rows.filter((c) => c.ended_at === null);
    return rows;
  }

  async getProfile() {
    return this.profile;
  }

  async upsertProfile(input: ProfileUpsertInput) {
    this.profile = {
      id: input.id,
      email: input.email,
      plan: input.plan ?? "trial",
      birth_year: input.birth_year ?? null,
      is_on_medicare: input.is_on_medicare ?? null,
      sex_at_birth: input.sex_at_birth ?? null,
      gender_identity: input.gender_identity ?? null,
      pcos_history: input.pcos_history ?? null,
      created_at: this.profile?.created_at ?? NOW,
      updated_at: NOW,
    };
    return this.profile;
  }

  // ── unused by the backup path — present to satisfy the contract ──
  async getObservation(): Promise<ObservationRow | null> {
    throw new Error("not used in FakeDal");
  }
  async getLatestObservation(): Promise<ObservationRow | null> {
    throw new Error("not used in FakeDal");
  }
  async insertReport(_i: ReportInsertInput): Promise<{ id: string }> {
    throw new Error("not used in FakeDal");
  }
  async getReport(): Promise<ReportRow | null> {
    throw new Error("not used in FakeDal");
  }
  async listReports(): Promise<ReportRow[]> {
    throw new Error("not used in FakeDal");
  }
  async updateReportParseStatus(): Promise<void> {
    throw new Error("not used in FakeDal");
  }
  async renameReport(): Promise<void> {
    throw new Error("not used in FakeDal");
  }
  async deleteReport(): Promise<void> {
    throw new Error("not used in FakeDal");
  }
  async insertAnalysis(_i: AnalysisInsertInput): Promise<{ id: string }> {
    throw new Error("not used in FakeDal");
  }
  async listAnalyses(): Promise<AnalysisRow[]> {
    throw new Error("not used in FakeDal");
  }
  async insertChatMessage(_i: ChatMessageInsertInput): Promise<{ id: string }> {
    throw new Error("not used in FakeDal");
  }
  async listChatMessages(): Promise<ChatMessageRow[]> {
    throw new Error("not used in FakeDal");
  }
}

function obsInput(over: Partial<ObservationInsertInput>): ObservationInsertInput {
  return {
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
    ...over,
  };
}

async function seededSource(): Promise<FakeDal> {
  const dal = new FakeDal();
  await dal.upsertProfile({
    id: "u1",
    email: "a@b.co",
    plan: "trial",
    birth_year: 1979,
    is_on_medicare: false,
    sex_at_birth: "female",
    gender_identity: "female",
  });
  await dal.insertObservation(obsInput({ id: "o1", code: "2160-0" }));
  await dal.insertObservation(
    obsInput({ id: "o2", code: "4548-4", display: "HbA1c", value_num: 5.4, unit: "%" }),
  );
  await dal.insertCondition({
    id: "c1",
    user_id: "u1",
    condition_code: "E66.9",
    condition_category: "obesity",
    source: "self_reported",
    started_at: "2026-01-01T00:00:00.000Z",
    ended_at: null,
    confidence: 0.9,
  });
  return dal;
}

describe("createEncryptedBackup / restoreEncryptedBackup", () => {
  it("round-trips the full record into a fresh device", async () => {
    const src = await seededSource();
    const rk = rng(32);
    const sealed = await createEncryptedBackup(src, crypto, rk, NOW);

    const dest = new FakeDal();
    const result = await restoreEncryptedBackup(dest, crypto, rk, sealed);

    expect(result.observationsInserted).toBe(2);
    expect(result.conditionsInserted).toBe(1);
    expect(result.profileRestored).toBe(true);
    expect(await dest.listObservations({ latest_only: false })).toEqual(
      await src.listObservations({ latest_only: false }),
    );
    expect((await dest.getProfile())?.sex_at_birth).toBe("female");
  });

  it("stamps manifest counts (no PHI) from the exported record", async () => {
    const src = await seededSource();
    const sealed = await createEncryptedBackup(src, crypto, rng(32), NOW);
    expect(sealed.manifest.recordCounts).toEqual({
      observations: 2,
      conditions: 1,
      profile: 1,
    });
    expect(sealed.manifest.createdAtIso).toBe(NOW);
  });

  it("is idempotent — re-restoring the same backup inserts nothing new", async () => {
    const src = await seededSource();
    const rk = rng(32);
    const sealed = await createEncryptedBackup(src, crypto, rk, NOW);

    const dest = new FakeDal();
    await restoreEncryptedBackup(dest, crypto, rk, sealed);
    const second = await restoreEncryptedBackup(dest, crypto, rk, sealed);

    expect(second.observationsInserted).toBe(0);
    expect(second.observationsSkipped).toBe(2);
    expect(second.conditionsSkipped).toBe(1);
    expect(await dest.listObservations({ latest_only: false })).toHaveLength(2);
  });

  it("fails closed when restoring with the wrong recovery key", async () => {
    const src = await seededSource();
    const sealed = await createEncryptedBackup(src, crypto, rng(32), NOW);
    await expect(
      restoreEncryptedBackup(new FakeDal(), crypto, rng(32), sealed),
    ).rejects.toBeInstanceOf(BackupDecryptError);
  });
});

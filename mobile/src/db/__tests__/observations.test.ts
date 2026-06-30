/**
 * observations DAL — append-only, supersede chain, enum, filter coverage.
 *
 * The invariants under test are the load-bearing ones from
 * `mobile/CLAUDE.md` (4: append-only) and `LocalDataDAL.ts` (UNIQUE +
 * ON CONFLICT DO NOTHING + supersedes_id semantics).
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createLocalDataDAL } from "../dal";
import type { LocalDataDAL } from "@/contracts/LocalDataDAL";
import { createTestAdapter, type TestAdapter } from "./_testAdapter";

const USER = "11111111-1111-4111-8111-111111111111";

function hba1cInput(
  overrides: Partial<Parameters<LocalDataDAL["insertObservation"]>[0]> = {},
) {
  return {
    user_id: USER,
    category: "biomarker" as const,
    code_system: "LOINC" as const,
    code: "4548-4",
    display: "Hemoglobin A1c/Hemoglobin.total in Blood",
    value_num: 5.9,
    value_text: null,
    unit: "%",
    source: "self_reported" as const,
    effective_at: "2026-04-15T00:00:00.000Z",
    report_id: null,
    supersedes_id: null,
    metadata_json: null,
    ...overrides,
  };
}

describe("observations DAL", () => {
  let adapter: TestAdapter;
  let dal: LocalDataDAL;

  beforeEach(() => {
    adapter = createTestAdapter();
    dal = createLocalDataDAL(adapter);
  });

  afterEach(() => {
    adapter.close();
  });

  it("append-only: re-inserting the same (user_id, code, effective_at) is a no-op", async () => {
    const first = await dal.insertObservation(hba1cInput({ value_num: 5.9 }));
    expect(first.inserted).toBe(true);
    expect(first.id).toBeTruthy();

    // Same key, different value — ON CONFLICT DO NOTHING must swallow it.
    const second = await dal.insertObservation(hba1cInput({ value_num: 6.4 }));
    expect(second.inserted).toBe(false);

    // Original row must remain unchanged.
    const row = await dal.getObservation(first.id);
    expect(row).not.toBeNull();
    expect(row!.value_num).toBe(5.9);

    // Exactly one row in the table.
    const all = await dal.listObservations({ latest_only: false });
    expect(all).toHaveLength(1);
  });

  it("supersede chain: latest_only returns the newest row, not the original", async () => {
    const a = await dal.insertObservation(
      hba1cInput({
        effective_at: "2026-04-15T00:00:00.000Z",
        value_num: 5.9,
      }),
    );
    const b = await dal.insertObservation(
      hba1cInput({
        // Correction supplied on a DIFFERENT effective_at so the row makes
        // it into the table — append-only blocks same-key collisions, not
        // same-code different-day rows.
        effective_at: "2026-04-16T00:00:00.000Z",
        value_num: 6.0,
        supersedes_id: a.id,
      }),
    );
    expect(b.inserted).toBe(true);

    const latest = await dal.listObservations({
      code: "4548-4",
      latest_only: true,
    });
    expect(latest).toHaveLength(1);
    expect(latest[0].id).toBe(b.id);
    expect(latest[0].value_num).toBe(6.0);

    // The original row is still present and unchanged when latest_only=false.
    const all = await dal.listObservations({
      code: "4548-4",
      latest_only: false,
    });
    expect(all).toHaveLength(2);
    const original = all.find((r) => r.id === a.id);
    expect(original).toBeDefined();
    expect(original!.value_num).toBe(5.9);

    // getObservation by id always returns the row as-is.
    const fetchedA = await dal.getObservation(a.id);
    expect(fetchedA!.value_num).toBe(5.9);
  });

  it("getLatestObservation walks the supersede chain", async () => {
    const a = await dal.insertObservation(
      hba1cInput({
        effective_at: "2026-04-15T00:00:00.000Z",
        value_num: 5.9,
      }),
    );
    const b = await dal.insertObservation(
      hba1cInput({
        effective_at: "2026-04-16T00:00:00.000Z",
        value_num: 6.0,
        supersedes_id: a.id,
      }),
    );

    const latest = await dal.getLatestObservation(USER, "4548-4");
    expect(latest).not.toBeNull();
    expect(latest!.id).toBe(b.id);
    expect(latest!.value_num).toBe(6.0);
  });

  it("source enum: rejects an unknown source value", async () => {
    await expect(
      // @ts-expect-error — intentionally violating the union to hit the CHECK.
      dal.insertObservation(hba1cInput({ source: "bogus" })),
    ).rejects.toThrow();
  });

  it("LOINC round-trip: code_system + code persist exactly as written", async () => {
    const r = await dal.insertObservation(
      hba1cInput({ code_system: "LOINC", code: "4548-4" }),
    );
    const fetched = await dal.getObservation(r.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.code_system).toBe("LOINC");
    expect(fetched!.code).toBe("4548-4");
    expect(fetched!.display).toContain("Hemoglobin");
  });

  it("report_id filter scopes results to a single report", async () => {
    const reportA = "rep-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    const reportB = "rep-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

    await dal.insertObservation(
      hba1cInput({
        code: "4548-4",
        effective_at: "2026-04-15T00:00:00.000Z",
        report_id: reportA,
      }),
    );
    await dal.insertObservation(
      hba1cInput({
        code: "2345-7", // glucose — distinct code so UNIQUE doesn't collide
        display: "Glucose",
        effective_at: "2026-04-15T00:00:00.000Z",
        report_id: reportA,
      }),
    );
    await dal.insertObservation(
      hba1cInput({
        code: "59261-8", // alt HbA1c LOINC
        display: "Hemoglobin A1c/Hemoglobin.total in Blood by IFCC protocol",
        effective_at: "2026-05-01T00:00:00.000Z",
        report_id: reportB,
      }),
    );

    const justA = await dal.listObservations({ report_id: reportA });
    expect(justA).toHaveLength(2);
    expect(justA.every((r) => r.report_id === reportA)).toBe(true);

    const justB = await dal.listObservations({ report_id: reportB });
    expect(justB).toHaveLength(1);
    expect(justB[0].report_id).toBe(reportB);
  });

  it("auto-stamps recorded_at when input does not supply one", async () => {
    const before = Date.now();
    const r = await dal.insertObservation(hba1cInput());
    const after = Date.now();

    const fetched = await dal.getObservation(r.id);
    expect(fetched).not.toBeNull();
    const recordedMs = new Date(fetched!.recorded_at).getTime();
    expect(recordedMs).toBeGreaterThanOrEqual(before);
    expect(recordedMs).toBeLessThanOrEqual(after);
  });

  it("category CHECK constraint rejects unknown observation categories", async () => {
    await expect(
      // @ts-expect-error — intentionally invalid category
      dal.insertObservation(hba1cInput({ category: "not_a_category" })),
    ).rejects.toThrow();
  });

  it("since/until window filters by effective_at", async () => {
    await dal.insertObservation(
      hba1cInput({
        effective_at: "2026-01-01T00:00:00.000Z",
      }),
    );
    await dal.insertObservation(
      hba1cInput({
        effective_at: "2026-03-01T00:00:00.000Z",
      }),
    );
    await dal.insertObservation(
      hba1cInput({
        effective_at: "2026-06-01T00:00:00.000Z",
      }),
    );

    const q1 = await dal.listObservations({
      since: "2026-02-01T00:00:00.000Z",
      until: "2026-05-01T00:00:00.000Z",
    });
    expect(q1).toHaveLength(1);
    expect(q1[0].effective_at).toBe("2026-03-01T00:00:00.000Z");
  });
});

/**
 * reports DAL tests — pointer + metadata + parse-status transitions.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createLocalDataDAL } from "../dal";
import type { LocalDataDAL } from "@/contracts/LocalDataDAL";
import { createTestAdapter, type TestAdapter } from "./_testAdapter";

const USER = "33333333-3333-4333-8333-333333333333";

describe("reports DAL", () => {
  let adapter: TestAdapter;
  let dal: LocalDataDAL;

  beforeEach(() => {
    adapter = createTestAdapter();
    dal = createLocalDataDAL(adapter);
  });

  afterEach(() => {
    adapter.close();
  });

  it("inserts a report defaulting to pending status with no parsed_at", async () => {
    const r = await dal.insertReport({
      user_id: USER,
      type: "lab",
      file_blob_ref: "/blobs/abc.enc",
      original_filename: "lab-results.pdf",
    });
    const fetched = await dal.getReport(r.id);
    expect(fetched).not.toBeNull();
    expect(fetched!.parse_status).toBe("pending");
    expect(fetched!.parsed_at).toBeNull();
    expect(fetched!.summary_text).toBeNull();
    expect(fetched!.type).toBe("lab");
  });

  it("type CHECK rejects unknown report type", async () => {
    await expect(
      dal.insertReport({
        user_id: USER,
        // @ts-expect-error — intentionally invalid
        type: "selfie",
        file_blob_ref: "/blobs/abc.enc",
        original_filename: "x.pdf",
      }),
    ).rejects.toThrow();
  });

  it("updateReportParseStatus transitions pending → confirmed and stamps parsed_at + summary", async () => {
    const r = await dal.insertReport({
      user_id: USER,
      type: "lab",
      file_blob_ref: "/blobs/abc.enc",
      original_filename: "lab.pdf",
    });
    await dal.updateReportParseStatus(r.id, "parsing");
    let mid = await dal.getReport(r.id);
    expect(mid!.parse_status).toBe("parsing");
    expect(mid!.parsed_at).toBeNull();

    await dal.updateReportParseStatus(r.id, "confirmed", "HbA1c 5.9% and glucose 96");
    const done = await dal.getReport(r.id);
    expect(done!.parse_status).toBe("confirmed");
    expect(done!.parsed_at).not.toBeNull();
    expect(done!.summary_text).toBe("HbA1c 5.9% and glucose 96");
  });

  it("listReports orders newest first", async () => {
    const r1 = await dal.insertReport({
      user_id: USER,
      type: "lab",
      file_blob_ref: "/blobs/a.enc",
      original_filename: "older.pdf",
      uploaded_at: "2026-01-01T00:00:00.000Z",
    });
    const r2 = await dal.insertReport({
      user_id: USER,
      type: "visit",
      file_blob_ref: "/blobs/b.enc",
      original_filename: "newer.pdf",
      uploaded_at: "2026-06-01T00:00:00.000Z",
    });
    const list = await dal.listReports(USER);
    expect(list.map((r) => r.id)).toEqual([r2.id, r1.id]);
  });

  // CU-3 / migration 002: the 'kept' status (deliberate document-on-file).
  it("accepts the 'kept' parse_status (migration 002 expanded the CHECK)", async () => {
    const r = await dal.insertReport({
      user_id: USER,
      type: "lab",
      file_blob_ref: "/blobs/kept.enc",
      original_filename: "kept-doc.pdf",
    });
    await dal.updateReportParseStatus(r.id, "kept", "No new values saved.");
    const fetched = await dal.getReport(r.id);
    expect(fetched!.parse_status).toBe("kept");
    // 'kept' is terminal (the Save path) → parsed_at stamped, like confirmed.
    expect(fetched!.parsed_at).not.toBeNull();
  });

  it("still rejects an unknown parse_status after the rebuild", async () => {
    const r = await dal.insertReport({
      user_id: USER,
      type: "lab",
      file_blob_ref: "/blobs/x.enc",
      original_filename: "x.pdf",
    });
    await expect(
      // @ts-expect-error — exercising the DB CHECK with an invalid value.
      dal.updateReportParseStatus(r.id, "bogus", "nope"),
    ).rejects.toThrow();
  });

  // UPL-2: deleteReport removes the row (blob handled by removeReport).
  it("deleteReport removes the row and is idempotent", async () => {
    const r = await dal.insertReport({
      user_id: USER,
      type: "lab",
      file_blob_ref: "/blobs/del.enc",
      original_filename: "del.pdf",
    });
    expect(await dal.getReport(r.id)).not.toBeNull();
    await dal.deleteReport(r.id);
    expect(await dal.getReport(r.id)).toBeNull();
    // Idempotent — deleting a gone id is a no-op, not an error.
    await expect(dal.deleteReport(r.id)).resolves.toBeUndefined();
  });

  it("deleteReport leaves linked observations intact (append-only invariant)", async () => {
    const r = await dal.insertReport({
      user_id: USER,
      type: "lab",
      file_blob_ref: "/blobs/obs.enc",
      original_filename: "obs.pdf",
    });
    await dal.insertObservation({
      user_id: USER,
      category: "biomarker",
      code_system: "LOINC",
      code: "2345-7",
      display: "Glucose",
      value_num: 95,
      value_text: null,
      unit: "mg/dL",
      source: "uploaded_report",
      effective_at: "2026-06-01T00:00:00.000Z",
      report_id: r.id,
      supersedes_id: null,
      metadata_json: null,
    });
    await dal.deleteReport(r.id);
    const obs = await dal.listObservations({ report_id: r.id });
    expect(obs).toHaveLength(1); // committed values survive document removal
  });
});

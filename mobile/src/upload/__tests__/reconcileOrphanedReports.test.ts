/**
 * reconcileOrphanedReports (Phase 3) — orphan sweep safety pins.
 *
 * A hard kill during upload review leaves a 'parsing' report row + its encrypted
 * blob with no committed values (the beforeRemove abandon guard never fires).
 * The sweep removes those, and ONLY those:
 *   1. prior-session in-flight orphan, no obs        -> reconciled (row + blob)
 *   2. report with committed observations            -> NEVER touched (invariant 4)
 *   3. THIS-session in-flight (uploaded_at >= start) -> NOT touched (predates filter)
 *   4. terminal (confirmed/partial/kept/rejected)    -> NOT touched
 * Plus the once-per-launch guard.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Stub the encrypted-blob layer (expo-file-system) so removeReport's blob delete
// is an observable no-op spy in node.
vi.mock("../blobStore", () => ({ deleteBlob: vi.fn() }));

import type { LocalDataDAL } from "@/contracts/LocalDataDAL";

import { createLocalDataDAL } from "../../db/dal";
import { createTestAdapter, type TestAdapter } from "../../db/__tests__/_testAdapter";
import { deleteBlob } from "../blobStore";
import {
  claimOrphanSweep,
  reconcileOrphanedReports,
} from "../removeReport";

const USER = "33333333-3333-4333-8333-333333333333";
const SESSION = "2026-06-29T12:00:00.000Z";
const BEFORE = "2026-06-29T11:00:00.000Z"; // a dead prior process
const AFTER = "2026-06-29T13:00:00.000Z"; // this session

function report(
  id: string,
  parse_status: "pending" | "parsing" | "confirmed" | "partial" | "kept" | "rejected",
  uploaded_at: string,
) {
  return {
    id,
    user_id: USER,
    type: "lab" as const,
    file_blob_ref: `/blobs/${id}.bin`,
    original_filename: `${id}.pdf`,
    uploaded_at,
    parse_status,
  };
}

describe("reconcileOrphanedReports", () => {
  let adapter: TestAdapter;
  let dal: LocalDataDAL;

  beforeEach(() => {
    adapter = createTestAdapter();
    dal = createLocalDataDAL(adapter);
    vi.clearAllMocks();
  });
  afterEach(() => adapter.close());

  it("reconciles ONLY the prior-session in-flight orphan with no committed values", async () => {
    await dal.insertReport(report("orphan", "parsing", BEFORE)); // (1) the orphan
    await dal.insertReport(report("hasValues", "parsing", BEFORE)); // (2) committed obs
    await dal.insertReport(report("thisSession", "parsing", AFTER)); // (3) current
    await dal.insertReport(report("terminal", "confirmed", BEFORE)); // (4) terminal
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
      effective_at: BEFORE,
      report_id: "hasValues",
      supersedes_id: null,
      metadata_json: null,
    });

    const { removed } = await reconcileOrphanedReports(dal, USER, SESSION);

    expect(removed).toBe(1);
    // (1) the orphan: row + blob gone.
    expect(await dal.getReport("orphan")).toBeNull();
    expect(deleteBlob).toHaveBeenCalledWith("orphan");
    expect(deleteBlob).toHaveBeenCalledTimes(1);
    // (2) committed values -> untouched (append-only invariant).
    expect(await dal.getReport("hasValues")).not.toBeNull();
    // (3) this-session in-flight -> untouched (predates filter).
    expect(await dal.getReport("thisSession")).not.toBeNull();
    // (4) terminal -> untouched.
    expect(await dal.getReport("terminal")).not.toBeNull();
  });

  it("removes nothing when there are no prior-session orphans", async () => {
    await dal.insertReport(report("a", "confirmed", BEFORE));
    await dal.insertReport(report("b", "parsing", AFTER));
    const { removed } = await reconcileOrphanedReports(dal, USER, SESSION);
    expect(removed).toBe(0);
    expect(deleteBlob).not.toHaveBeenCalled();
  });
});

describe("claimOrphanSweep — once per launch", () => {
  it("returns true once, then false", () => {
    expect(claimOrphanSweep()).toBe(true);
    expect(claimOrphanSweep()).toBe(false);
    expect(claimOrphanSweep()).toBe(false);
  });
});

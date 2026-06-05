/**
 * conditions DAL tests — mirror server's user_conditions semantics.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createLocalDataDAL } from "../dal";
import type { LocalDataDAL } from "@/contracts/LocalDataDAL";
import { createTestAdapter, type TestAdapter } from "./_testAdapter";

const USER = "22222222-2222-4222-8222-222222222222";

describe("conditions DAL", () => {
  let adapter: TestAdapter;
  let dal: LocalDataDAL;

  beforeEach(() => {
    adapter = createTestAdapter();
    dal = createLocalDataDAL(adapter);
  });

  afterEach(() => {
    adapter.close();
  });

  it("inserts and lists active conditions only by default", async () => {
    await dal.insertCondition({
      user_id: USER,
      condition_code: "E11.9",
      condition_category: "type2",
      source: "self_reported",
      started_at: "2024-01-01T00:00:00.000Z",
      ended_at: null,
      confidence: 0.9,
    });
    await dal.insertCondition({
      user_id: USER,
      condition_code: "E66.9",
      condition_category: "obesity",
      source: "self_reported",
      started_at: "2024-01-01T00:00:00.000Z",
      ended_at: "2025-06-01T00:00:00.000Z",
      confidence: null,
    });

    const active = await dal.listConditions(USER);
    expect(active).toHaveLength(1);
    expect(active[0].condition_category).toBe("type2");

    const all = await dal.listConditions(USER, { active_only: false });
    expect(all).toHaveLength(2);
  });

  it("category CHECK rejects unknown condition_category", async () => {
    await expect(
      dal.insertCondition({
        user_id: USER,
        condition_code: "X.X",
        // @ts-expect-error — intentionally invalid
        condition_category: "not_a_real_category",
        source: "self_reported",
        started_at: "2024-01-01T00:00:00.000Z",
        ended_at: null,
        confidence: null,
      }),
    ).rejects.toThrow();
  });

  it("source CHECK rejects unknown source", async () => {
    await expect(
      dal.insertCondition({
        user_id: USER,
        condition_code: "E11.9",
        condition_category: "type2",
        // @ts-expect-error — intentionally invalid
        source: "made_up",
        started_at: "2024-01-01T00:00:00.000Z",
        ended_at: null,
        confidence: null,
      }),
    ).rejects.toThrow();
  });

  it("filters by category", async () => {
    await dal.insertCondition({
      user_id: USER,
      condition_code: "E11.9",
      condition_category: "type2",
      source: "self_reported",
      started_at: "2024-01-01T00:00:00.000Z",
      ended_at: null,
      confidence: 0.9,
    });
    await dal.insertCondition({
      user_id: USER,
      condition_code: "I10",
      condition_category: "hypertension",
      source: "ehr",
      started_at: "2024-01-01T00:00:00.000Z",
      ended_at: null,
      confidence: 0.8,
    });

    const onlyHtn = await dal.listConditions(USER, {
      category: "hypertension",
    });
    expect(onlyHtn).toHaveLength(1);
    expect(onlyHtn[0].condition_code).toBe("I10");
  });
});

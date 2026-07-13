/**
 * profile DAL tests — upsert + boolean marshalling.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createLocalDataDAL } from "../dal";
import type { LocalDataDAL } from "@/contracts/LocalDataDAL";
import { createTestAdapter, type TestAdapter } from "./_testAdapter";

const SUB = "44444444-4444-4444-8444-444444444444";

describe("profile DAL", () => {
  let adapter: TestAdapter;
  let dal: LocalDataDAL;

  beforeEach(() => {
    adapter = createTestAdapter();
    dal = createLocalDataDAL(adapter);
  });

  afterEach(() => {
    adapter.close();
  });

  it("returns null when no profile row exists", async () => {
    const p = await dal.getProfile();
    expect(p).toBeNull();
  });

  it("upsert creates then updates, preserving created_at and bumping updated_at", async () => {
    const first = await dal.upsertProfile({
      id: SUB,
      email: "ramanac@gmail.com",
    });
    expect(first.id).toBe(SUB);
    expect(first.plan).toBe("trial");
    expect(first.is_on_medicare).toBeNull();
    expect(first.created_at).toBeTruthy();
    expect(first.updated_at).toBe(first.created_at);

    // Small pause so updated_at can move.
    await new Promise((r) => setTimeout(r, 5));

    const second = await dal.upsertProfile({
      id: SUB,
      email: "ramanac@gmail.com",
      is_on_medicare: true,
      sex_at_birth: "male",
    });
    expect(second.created_at).toBe(first.created_at);
    expect(second.updated_at >= first.updated_at).toBe(true);
    expect(second.is_on_medicare).toBe(true);
    expect(second.sex_at_birth).toBe("male");
  });

  it("marshals is_on_medicare correctly across null / true / false", async () => {
    await dal.upsertProfile({ id: SUB, email: "x@y.com" });
    let p = await dal.getProfile();
    expect(p!.is_on_medicare).toBeNull();

    await dal.upsertProfile({
      id: SUB,
      email: "x@y.com",
      is_on_medicare: false,
    });
    p = await dal.getProfile();
    expect(p!.is_on_medicare).toBe(false);

    await dal.upsertProfile({
      id: SUB,
      email: "x@y.com",
      is_on_medicare: true,
    });
    p = await dal.getProfile();
    expect(p!.is_on_medicare).toBe(true);
  });

  it("marshals pcos_history correctly across null / true / false (migration 003)", async () => {
    await dal.upsertProfile({ id: SUB, email: "x@y.com" });
    let p = await dal.getProfile();
    expect(p!.pcos_history).toBeNull();

    await dal.upsertProfile({ id: SUB, email: "x@y.com", pcos_history: true });
    p = await dal.getProfile();
    expect(p!.pcos_history).toBe(true);

    await dal.upsertProfile({ id: SUB, email: "x@y.com", pcos_history: false });
    p = await dal.getProfile();
    expect(p!.pcos_history).toBe(false);
  });

  it("pcos_history is additive — an upsert that omits it preserves the stored value", async () => {
    await dal.upsertProfile({ id: SUB, email: "x@y.com", pcos_history: true });
    // A later upsert that doesn't mention pcos_history must NOT clear it.
    await dal.upsertProfile({
      id: SUB,
      email: "x@y.com",
      sex_at_birth: "female",
    });
    const p = await dal.getProfile();
    expect(p!.pcos_history).toBe(true);
    expect(p!.sex_at_birth).toBe("female");
  });

  it("plan CHECK rejects unknown plan", async () => {
    await expect(
      dal.upsertProfile({
        id: SUB,
        email: "x@y.com",
        // @ts-expect-error — intentionally invalid
        plan: "pro_plus_max",
      }),
    ).rejects.toThrow();
  });
});

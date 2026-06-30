/**
 * analyses + chat_messages DAL tests — append-only, ordering, scoping.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createLocalDataDAL } from "../dal";
import type { LocalDataDAL } from "@/contracts/LocalDataDAL";
import { createTestAdapter, type TestAdapter } from "./_testAdapter";

const USER = "55555555-5555-4555-8555-555555555555";

describe("analyses DAL", () => {
  let adapter: TestAdapter;
  let dal: LocalDataDAL;

  beforeEach(() => {
    adapter = createTestAdapter();
    dal = createLocalDataDAL(adapter);
  });

  afterEach(() => {
    adapter.close();
  });

  it("inserts and lists most-recent-first", async () => {
    await dal.insertAnalysis({
      user_id: USER,
      requested_at: "2026-01-01T00:00:00.000Z",
      input_observation_ids_json: "[\"a\"]",
      model_used: "claude-haiku-4-5",
      result_text: "first analysis",
      result_structured_json: null,
    });
    await dal.insertAnalysis({
      user_id: USER,
      requested_at: "2026-06-01T00:00:00.000Z",
      input_observation_ids_json: "[\"a\",\"b\"]",
      model_used: "claude-sonnet-4-6",
      result_text: "second analysis",
      result_structured_json: null,
    });
    const list = await dal.listAnalyses(USER);
    expect(list).toHaveLength(2);
    expect(list[0].result_text).toBe("second analysis");
    expect(list[1].result_text).toBe("first analysis");

    const limited = await dal.listAnalyses(USER, 1);
    expect(limited).toHaveLength(1);
    expect(limited[0].result_text).toBe("second analysis");
  });
});

describe("chat_messages DAL", () => {
  let adapter: TestAdapter;
  let dal: LocalDataDAL;

  beforeEach(() => {
    adapter = createTestAdapter();
    dal = createLocalDataDAL(adapter);
  });

  afterEach(() => {
    adapter.close();
  });

  it("scopes by session_id and orders by created_at ascending", async () => {
    await dal.insertChatMessage({
      role: "user",
      content: "first user msg",
      created_at: "2026-01-01T00:00:00.000Z",
      session_id: "s1",
    });
    await dal.insertChatMessage({
      role: "assistant",
      content: "first assistant msg",
      created_at: "2026-01-01T00:00:01.000Z",
      session_id: "s1",
    });
    await dal.insertChatMessage({
      role: "user",
      content: "other session",
      created_at: "2026-01-01T00:00:02.000Z",
      session_id: "s2",
    });

    const s1 = await dal.listChatMessages("s1");
    expect(s1.map((m) => m.content)).toEqual([
      "first user msg",
      "first assistant msg",
    ]);

    const s2 = await dal.listChatMessages("s2");
    expect(s2).toHaveLength(1);
    expect(s2[0].content).toBe("other session");
  });

  it("listChatMessages(null) returns rows with NULL session_id only", async () => {
    await dal.insertChatMessage({
      role: "user",
      content: "no session",
      session_id: null,
    });
    await dal.insertChatMessage({
      role: "user",
      content: "in s1",
      session_id: "s1",
    });
    const nullList = await dal.listChatMessages(null);
    expect(nullList).toHaveLength(1);
    expect(nullList[0].content).toBe("no session");
  });

  it("role CHECK rejects unknown role", async () => {
    await expect(
      dal.insertChatMessage({
        // @ts-expect-error — intentionally invalid
        role: "moderator",
        content: "x",
        session_id: null,
      }),
    ).rejects.toThrow();
  });
});

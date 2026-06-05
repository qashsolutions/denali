/**
 * chatHistory — pure helper tests.
 *
 * Asserts:
 *   1. appendUserTurn does not mutate input.
 *   2. withAssistantTurn replaces a trailing assistant; otherwise appends.
 *   3. appendAssistantDelta concatenates onto trailing assistant.
 *   4. clearHistory returns an empty array — D11: session-scoped chat,
 *      cleared on sign-out.
 */

import { describe, expect, it } from "vitest";

import {
  appendAssistantDelta,
  appendUserTurn,
  clearHistory,
  withAssistantTurn,
  type ChatTurn,
} from "../chatHistory";

describe("appendUserTurn", () => {
  it("appends a user turn without mutating input", () => {
    const before: ChatTurn[] = [{ role: "assistant", content: "hi" }];
    const after = appendUserTurn(before, "what's my A1c trend?");
    expect(after).toHaveLength(2);
    expect(after[1]).toEqual({
      role: "user",
      content: "what's my A1c trend?",
    });
    expect(before).toHaveLength(1); // unchanged
  });
});

describe("withAssistantTurn", () => {
  it("replaces a trailing assistant turn in place", () => {
    const before: ChatTurn[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "partial" },
    ];
    const after = withAssistantTurn(before, "final answer");
    expect(after).toHaveLength(2);
    expect(after[1]).toEqual({ role: "assistant", content: "final answer" });
  });

  it("appends when the last turn is a user turn", () => {
    const before: ChatTurn[] = [{ role: "user", content: "hi" }];
    const after = withAssistantTurn(before, "hello");
    expect(after).toHaveLength(2);
    expect(after[1].role).toBe("assistant");
  });

  it("appends when the history is empty", () => {
    const after = withAssistantTurn([], "hello");
    expect(after).toEqual([{ role: "assistant", content: "hello" }]);
  });
});

describe("appendAssistantDelta", () => {
  it("concatenates the delta onto the trailing assistant turn", () => {
    const before: ChatTurn[] = [
      { role: "user", content: "hi" },
      { role: "assistant", content: "Hel" },
    ];
    const after = appendAssistantDelta(before, "lo!");
    expect(after[1]).toEqual({ role: "assistant", content: "Hello!" });
  });

  it("creates a new assistant turn if none exists at the tail", () => {
    const before: ChatTurn[] = [{ role: "user", content: "hi" }];
    const after = appendAssistantDelta(before, "Hi back");
    expect(after).toHaveLength(2);
    expect(after[1]).toEqual({ role: "assistant", content: "Hi back" });
  });
});

describe("clearHistory", () => {
  it("returns an empty array (D11 — session-scoped chat)", () => {
    expect(clearHistory()).toEqual([]);
  });
});

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
  stripSuggestionsBlock,
  stripTrailingAssistant,
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

describe("stripTrailingAssistant (retry strip — chat-1)", () => {
  const user = (content: string): ChatTurn => ({ role: "user", content });
  const asst = (content: string): ChatTurn => ({ role: "assistant", content });

  it("drops a trailing PARTIAL assistant turn, keeping the user turn", () => {
    const h = [user("hi"), asst("partial repl")];
    expect(stripTrailingAssistant(h)).toEqual([user("hi")]);
  });

  it("is a no-op when the last turn is the user (failure left no partial)", () => {
    const h = [asst("done"), user("next question")];
    expect(stripTrailingAssistant(h)).toEqual(h);
  });

  it("returns an empty array for empty history", () => {
    expect(stripTrailingAssistant([])).toEqual([]);
  });

  it("does not mutate the input array", () => {
    const h = [user("hi"), asst("partial")];
    const copy = [...h];
    stripTrailingAssistant(h);
    expect(h).toEqual(copy);
  });
});

describe("stripSuggestionsBlock", () => {
  it("strips a closed [SUGGESTIONS] block and trailing divider", () => {
    const raw =
      "Are you asking about blood pressure?\n\n*Helps me point you the right way.*\n\n[SUGGESTIONS]\nBlood pressure help\nSomething else\n[/SUGGESTIONS]";
    expect(stripSuggestionsBlock(raw)).toBe(
      "Are you asking about blood pressure?\n\n*Helps me point you the right way.*",
    );
  });

  it("strips an unclosed block (still streaming) at the end", () => {
    const raw = "Here is the answer.\n\n[SUGGESTIONS]\nTell me more";
    expect(stripSuggestionsBlock(raw)).toBe("Here is the answer.");
  });

  it("strips a trailing --- divider", () => {
    expect(stripSuggestionsBlock("Answer body.\n\n---")).toBe("Answer body.");
  });

  it("leaves content without a block unchanged (trimmed)", () => {
    expect(stripSuggestionsBlock("Just a normal reply.")).toBe(
      "Just a normal reply.",
    );
  });

  it("is case-insensitive on the tag", () => {
    expect(stripSuggestionsBlock("Hi.\n[suggestions]\na\n[/suggestions]")).toBe(
      "Hi.",
    );
  });
});

/**
 * markdown tokenizer + summary/details splitter tests.
 *
 * Pins the subset the chat models emit (`**bold**`, `*italic*`, `-`/`1.`
 * lists, `#` headings) and the graceful-degradation contract (malformed
 * markdown stays literal, never throws).
 */

import { describe, expect, it } from "vitest";

import { parseInline, parseMarkdown, splitSummaryDetails } from "../markdown";

describe("parseInline", () => {
  it("parses **bold**", () => {
    expect(parseInline("a **b** c")).toEqual([
      { text: "a " },
      { text: "b", bold: true },
      { text: " c" },
    ]);
  });

  it("parses *italic*", () => {
    expect(parseInline("a *b* c")).toEqual([
      { text: "a " },
      { text: "b", italic: true },
      { text: " c" },
    ]);
  });

  it("parses bold and italic in the same line", () => {
    expect(parseInline("**x** and *y*")).toEqual([
      { text: "x", bold: true },
      { text: " and " },
      { text: "y", italic: true },
    ]);
  });

  it("leaves plain text as a single span", () => {
    expect(parseInline("just text")).toEqual([{ text: "just text" }]);
  });

  it("leaves an unmatched asterisk literal (graceful degradation)", () => {
    expect(parseInline("2 * 3 = 6")).toEqual([{ text: "2 * 3 = 6" }]);
  });
});

describe("parseMarkdown", () => {
  it("treats a blank line as a paragraph boundary", () => {
    const blocks = parseMarkdown("First para.\n\nSecond para.");
    expect(blocks).toHaveLength(2);
    expect(blocks[0]).toEqual({
      type: "paragraph",
      spans: [{ text: "First para." }],
    });
    expect(blocks[1]).toEqual({
      type: "paragraph",
      spans: [{ text: "Second para." }],
    });
  });

  it("joins soft newlines within a paragraph", () => {
    const blocks = parseMarkdown("line one\nline two");
    expect(blocks).toEqual([
      { type: "paragraph", spans: [{ text: "line one line two" }] },
    ]);
  });

  it("groups consecutive bullet lines into one block with inline parsing", () => {
    const blocks = parseMarkdown("- **a**\n- b\n- c");
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: "bullet",
      items: [[{ text: "a", bold: true }], [{ text: "b" }], [{ text: "c" }]],
    });
  });

  it("groups numbered lines into one block", () => {
    const blocks = parseMarkdown("1. first\n2. second");
    expect(blocks).toEqual([
      {
        type: "numbered",
        items: [[{ text: "first" }], [{ text: "second" }]],
      },
    ]);
  });

  it("parses a heading line", () => {
    const blocks = parseMarkdown("## What it covers\nbody");
    expect(blocks[0]).toEqual({
      type: "heading",
      spans: [{ text: "What it covers" }],
    });
    expect(blocks[1]).toEqual({ type: "paragraph", spans: [{ text: "body" }] });
  });

  it("handles a paragraph followed by a bullet list", () => {
    const blocks = parseMarkdown("Here are the options:\n- one\n- two");
    expect(blocks).toHaveLength(2);
    expect(blocks[0].type).toBe("paragraph");
    expect(blocks[1].type).toBe("bullet");
  });

  it("never throws on empty input", () => {
    expect(parseMarkdown("")).toEqual([]);
  });
});

describe("splitSummaryDetails", () => {
  it("splits the lead paragraph (summary) from the rest (details)", () => {
    const { summary, details } = splitSummaryDetails(
      "Your A1C is in the prediabetes range.\n\n- below 5.7 normal\n- 5.7–6.4 prediabetes",
    );
    expect(summary).toBe("Your A1C is in the prediabetes range.");
    expect(details).toBe("- below 5.7 normal\n- 5.7–6.4 prediabetes");
  });

  it("returns empty details when there is only one block (no toggle)", () => {
    const { summary, details } = splitSummaryDetails("Short answer only.");
    expect(summary).toBe("Short answer only.");
    expect(details).toBe("");
  });

  it("trims surrounding whitespace", () => {
    const { summary, details } = splitSummaryDetails(
      "  Summary line.  \n\n  Detail line.  ",
    );
    expect(summary).toBe("Summary line.");
    expect(details).toBe("Detail line.");
  });

  it("treats a blank line with spaces/tabs as the boundary", () => {
    const { summary, details } = splitSummaryDetails("A.\n \t\nB.");
    expect(summary).toBe("A.");
    expect(details).toBe("B.");
  });
});

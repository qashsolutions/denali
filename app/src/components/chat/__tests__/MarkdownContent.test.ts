import { describe, it, expect } from "vitest";

/**
 * Regression test for the __TABLE_N__ rendering bug observed in prod
 * 2026-04-30 (conversation b6658245-cf24-410e-9217-3dadc454635b).
 *
 * Bug shape: when the model emits a markdown table without a trailing
 * blank line before the next text, the table-extraction regex matches
 * but the placeholder ends up in the same paragraph as the trailing
 * text. The original substitution logic required the placeholder to
 * be alone in its paragraph (^__TABLE_(\d+)__$), so it failed and the
 * placeholder leaked into the rendered DOM as literal text.
 *
 * Fix: the table extraction now pads the placeholder with blank lines
 * (\n\n__TABLE_N__\n\n), forcing it into its own paragraph regardless
 * of model whitespace.
 *
 * parseMarkdown is not exported from MarkdownContent.tsx, so this test
 * reimplements the (post-fix) logic locally — matching the convention
 * established in markdown.test.ts.
 */

// Replicate parseTable just enough for the regression test.
// Real implementation lives in MarkdownContent.tsx.
function parseTable(headerRow: string, bodyRows: string): string {
  const headers = headerRow.split("|").map((h) => h.trim()).filter(Boolean);
  const rows = bodyRows.trim().split("\n").map((row) =>
    row.split("|").map((c) => c.trim()).filter(Boolean)
  );
  const headerHtml = headers.map((h) => `<th>${h}</th>`).join("");
  const rowsHtml = rows
    .map((row) => `<tr>${row.map((c) => `<td>${c}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>`;
}

// Replicate parseMarkdown WITH THE FIX APPLIED (padded placeholder).
function parseMarkdown(text: string): string {
  const tableRegex = /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g;
  let processedText = text;

  const tables: string[] = [];
  processedText = processedText.replace(tableRegex, (_match, headerRow, bodyRows) => {
    const tableHtml = parseTable(headerRow, bodyRows);
    tables.push(tableHtml);
    return `\n\n__TABLE_${tables.length - 1}__\n\n`;
  });

  const paragraphs = processedText.split(/\n\n+/);

  const result = paragraphs
    .map((para) => {
      const tableMatch = para.match(/^__TABLE_(\d+)__$/);
      if (tableMatch) {
        return tables[parseInt(tableMatch[1])];
      }

      let html = para
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/\n/g, "<br />");

      return `<p>${html}</p>`;
    })
    .join("");

  return result;
}

describe("parseMarkdown — table placeholder substitution", () => {
  it("substitutes the placeholder when table has a trailing blank line (control case)", () => {
    const input = [
      "Intro line:",
      "",
      "| Doctor | Specialty |",
      "|--------|-----------|",
      "| Dr. A | Cardio |",
      "| Dr. B | Ortho |",
      "",
      "Trailing text.",
    ].join("\n");

    const result = parseMarkdown(input);

    expect(result).toContain("<table>");
    expect(result).toContain("<td>Dr. A</td>");
    expect(result).toContain("Trailing text.");
    expect(result).not.toContain("__TABLE_0__");
  });

  it("substitutes the placeholder when table has NO trailing blank line (regression case)", () => {
    // This is the exact shape that broke prod on 2026-04-30:
    // intro line + blank line + table + immediate trailing text + blank line + more content.
    const input = [
      "Here are doctors near you in Los Angeles who accept Medicare:",
      "",
      "| # | Doctor | Specialty | Location | Medicare |",
      "|---|--------|-----------|----------|----------|",
      "| 1 | Dr. A | Family | LA | Yes |",
      "| 2 | Dr. B | Internal | LA | Yes |",
      "| 3 | Dr. C | Cardio | LA | Yes |",
      "All accept Medicare ✓",
      "",
      "When you call to schedule, tell them:",
      "- Your symptoms",
    ].join("\n");

    const result = parseMarkdown(input);

    // The table must be substituted into rendered HTML.
    expect(result).toContain("<table>");
    expect(result).toContain("<td>Dr. A</td>");

    // The trailing text after the table must survive intact.
    expect(result).toContain("All accept Medicare");

    // The follow-up paragraphs must still render.
    expect(result).toContain("When you call to schedule");

    // CRITICAL: the placeholder must NOT leak into the rendered output.
    expect(result).not.toContain("__TABLE_0__");
    expect(result).not.toContain("__TABLE_");
  });

  it("handles multiple tables in one message without leaking placeholders", () => {
    const input = [
      "First section:",
      "",
      "| A | B |",
      "|---|---|",
      "| 1 | 2 |",
      "After first table",
      "",
      "Second section:",
      "",
      "| C | D |",
      "|---|---|",
      "| 3 | 4 |",
      "After second table",
    ].join("\n");

    const result = parseMarkdown(input);

    expect(result).not.toContain("__TABLE_");
    expect(result).toContain("<td>1</td>");
    expect(result).toContain("<td>3</td>");
    expect(result).toContain("After first table");
    expect(result).toContain("After second table");
  });
});

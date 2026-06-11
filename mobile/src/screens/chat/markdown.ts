/**
 * Minimal markdown tokenizer for the mobile chat bubble.
 *
 * WHY in-house (no library): the web app hand-rolls markdown too
 * (`MarkdownContent.parseMarkdown`), the subset the chat models emit is
 * tiny (`**bold**`, `*italic*`, `-`/`1.` lists, short headings), and RN
 * renders via nested <Text>/<View> — there is no HTML sink, so the web's
 * XSS-escaping concern doesn't transfer. Unknown/malformed markdown
 * degrades to literal text; this never throws.
 *
 * Output is a flat block list; `ChatMarkdown.tsx` renders it. Pure +
 * unit-tested so the parsing logic is provable without rendering.
 */

export interface InlineSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

export type Block =
  | { type: "paragraph"; spans: InlineSpan[] }
  | { type: "heading"; spans: InlineSpan[] }
  | { type: "bullet"; items: InlineSpan[][] }
  | { type: "numbered"; items: InlineSpan[][] };

const BULLET_RE = /^\s*[-*]\s+(.*)$/;
const NUMBERED_RE = /^\s*\d+\.\s+(.*)$/;
const HEADING_RE = /^\s*#{1,3}\s+(.*)$/;
// Matches **bold** first, then *italic* (single-asterisk runs). Inner text
// is non-greedy and excludes the delimiter so `**a** and *b*` splits cleanly.
const INLINE_RE = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;

/**
 * Split a line of text into bold/italic/plain spans. Anything that isn't a
 * well-formed `**…**` / `*…*` run stays as literal text.
 */
export function parseInline(text: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > last) {
      spans.push({ text: text.slice(last, m.index) });
    }
    if (m[2] !== undefined) {
      spans.push({ text: m[2], bold: true });
    } else if (m[3] !== undefined) {
      spans.push({ text: m[3], italic: true });
    }
    last = INLINE_RE.lastIndex;
  }
  if (last < text.length) {
    spans.push({ text: text.slice(last) });
  }
  return spans.length > 0 ? spans : [{ text }];
}

/**
 * Parse a markdown string into renderable blocks. Consecutive list lines
 * group into one list block; blank lines separate paragraphs; soft
 * (single) newlines inside a paragraph are preserved as spaces.
 */
export function parseMarkdown(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];

  const flushPara = (): void => {
    if (para.length > 0) {
      blocks.push({ type: "paragraph", spans: parseInline(para.join(" ")) });
      para = [];
    }
  };

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      flushPara();
      i += 1;
      continue;
    }

    const heading = HEADING_RE.exec(line);
    if (heading) {
      flushPara();
      blocks.push({ type: "heading", spans: parseInline(heading[1].trim()) });
      i += 1;
      continue;
    }

    if (BULLET_RE.test(line)) {
      flushPara();
      const items: InlineSpan[][] = [];
      while (i < lines.length) {
        const b = BULLET_RE.exec(lines[i]);
        if (!b) break;
        items.push(parseInline(b[1].trim()));
        i += 1;
      }
      blocks.push({ type: "bullet", items });
      continue;
    }

    if (NUMBERED_RE.test(line)) {
      flushPara();
      const items: InlineSpan[][] = [];
      while (i < lines.length) {
        const n = NUMBERED_RE.exec(lines[i]);
        if (!n) break;
        items.push(parseInline(n[1].trim()));
        i += 1;
      }
      blocks.push({ type: "numbered", items });
      continue;
    }

    para.push(line.trim());
    i += 1;
  }
  flushPara();
  return blocks;
}

/**
 * Split an assistant reply into the summary (shown always) and the details
 * (collapsed behind a toggle). The summary is the first block — paragraph,
 * heading, or list — up to the first blank line; everything after is detail.
 *
 * Pairs with the backend MOBILE_CHAT_BREVITY nudge, which tells the model to
 * lead with a 1–2 sentence answer, so the first block IS a real summary.
 * When there's no second block, `details` is empty and the caller shows no
 * toggle.
 */
export function splitSummaryDetails(content: string): {
  summary: string;
  details: string;
} {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  // First blank-line boundary separates the lead block from the rest.
  const match = normalized.match(/\n[ \t]*\n/);
  if (!match || match.index === undefined) {
    return { summary: normalized, details: "" };
  }
  const summary = normalized.slice(0, match.index).trim();
  const details = normalized.slice(match.index + match[0].length).trim();
  return { summary, details };
}

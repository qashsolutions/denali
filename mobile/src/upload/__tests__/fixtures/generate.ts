/**
 * One-shot generator for `sample-lab.pdf` — the test fixture used by the
 * extract-wrapper logic test.
 *
 * Why hand-rolled (vs `pdfkit` / `pdf-lib`):
 *
 *   The fixture's job is to be a *minimal valid PDF with a text layer* so
 *   `expo-pdf-text-extract`'s native bridge (PDFKit / PDFBox) can extract a
 *   known short string. Hand-rolling avoids a devDep and a transitive font
 *   binary — the script is self-contained and the resulting file is
 *   deterministic (same bytes every run).
 *
 *   Consumed by the wrapper-logic test (`extract.test.ts`) — the test
 *   mocks the native module, so it never actually parses the PDF. It
 *   only checks that the wrapper code maps native-module outputs to
 *   `ExtractResult` correctly. The fixture serves as a "this is what a
 *   small lab PDF looks like" reference and a sanity-check that the
 *   bytes are a valid PDF (the PDF header is asserted in the test).
 *
 * Run from the repo root:
 *
 *   cd mobile
 *   npx tsx src/upload/__tests__/fixtures/generate.ts
 *
 * Output: writes `sample-lab.pdf` next to this file. The PDF is
 * committed; re-run only if the embedded text needs to change.
 *
 * The embedded text is a deterministic short lab snippet:
 *
 *   Glucose 95 mg/dL
 *   Cholesterol 180 mg/dL
 *   HbA1c 5.6%
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const LINES = [
  "Glucose 95 mg/dL",
  "Cholesterol 180 mg/dL",
  "HbA1c 5.6%",
] as const;

/**
 * Build a minimal valid single-page PDF embedding the given text lines.
 *
 * The PDF uses the Type1 standard font Helvetica (no font subsetting,
 * no font binary required). Each line is positioned with `Td` (relative
 * text move) and rendered via `Tj`. The byte offsets in the xref table
 * are computed from the cumulative buffer length.
 */
function buildPdf(lines: readonly string[]): Uint8Array {
  // Per PDF 1.4 §7.5.2 the file must begin with `%PDF-x.y` + a 4-byte binary
  // marker so naive tools recognize it as binary.
  const header = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";

  // ── Object bodies ─────────────────────────────────────────────────────
  // Use object numbers 1..5:
  //   1 = Catalog
  //   2 = Pages (root)
  //   3 = Page
  //   4 = Font (Helvetica, Type1, WinAnsiEncoding)
  //   5 = Content stream

  const contentLines = lines
    .map(
      (line, idx) =>
        idx === 0
          ? `BT /F1 12 Tf 72 740 Td (${escapePdfString(line)}) Tj ET`
          : `BT /F1 12 Tf 72 ${740 - idx * 18} Td (${escapePdfString(line)}) Tj ET`,
    )
    .join("\n");
  const contentBody = contentLines + "\n";
  const contentStream = `<< /Length ${contentBody.length} >>\nstream\n${contentBody}endstream`;

  const objects: string[] = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 4 0 R >> >> >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    contentStream,
  ];

  // Compose body + collect xref offsets.
  let body = header;
  const offsets: number[] = [];
  objects.forEach((obj, idx) => {
    offsets.push(Buffer.byteLength(body, "binary"));
    body += `${idx + 1} 0 obj\n${obj}\nendobj\n`;
  });

  // xref
  const xrefStart = Buffer.byteLength(body, "binary");
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => {
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  });

  // trailer
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  const full = body + xref + trailer;
  return Buffer.from(full, "binary");
}

function escapePdfString(s: string): string {
  // Escape backslash, opening paren, closing paren per PDF 1.7 §7.3.4.2.
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

// ── Write the fixture ────────────────────────────────────────────────────

const bytes = buildPdf(LINES);
const pdfPath = path.join(__dirname, "sample-lab.pdf");
fs.writeFileSync(pdfPath, bytes);

// eslint-disable-next-line no-console
console.log(`[generate] wrote ${pdfPath} (${bytes.byteLength} bytes)`);

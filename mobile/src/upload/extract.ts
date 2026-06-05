/**
 * Phase 1 mobile — on-device text extraction (Wave 2).
 *
 * Contract:
 *   - `extractText(file: PickedFile, blobUri: string): Promise<ExtractResult>`
 *
 * Phase 1 capability matrix:
 *
 *   | Source     | Platform | Status                                     |
 *   |------------|----------|--------------------------------------------|
 *   | PDF text   | iOS+And  | SUPPORTED — pdfjs-dist on the encrypted    |
 *   |            |          | blob's decrypted bytes (pure JS, no native |
 *   |            |          | dep, New-Arch safe).                       |
 *   | PDF scan   | iOS+And  | DEFERRED — needs OCR; surface gap.         |
 *   | Image      | iOS+And  | DEFERRED — needs OCR; surface gap.         |
 *
 * OCR gap rationale (recorded for the Pass 2 follow-up):
 *
 *   At work date 2026-06-04, no on-device OCR library is broadly validated
 *   against the New Architecture + Expo SDK 56 + RN 0.85.3 stack:
 *     - @react-native-ml-kit/text-recognition (latest 2024-Q4) has no
 *       documented New-Arch support; install would require turbo-module-only
 *       interop work outside Wave 2 scope.
 *     - expo-text-recognition does not exist in SDK 56.
 *     - VisionKit text recognition via expo-modules-core requires a custom
 *       native module — not landed.
 *
 * Per the upload-parse builder agent's hard rule ("On-device OCR or nothing.
 * No cloud OCR fallback in Phase 1.") we ship PDF text-layer support only
 * and surface a clear "OCR not yet supported on this device" message in the
 * UI for scanned PDFs and image uploads. The reports row is still created
 * (so the file is preserved encrypted on-device); the parse step is gated
 * with a `reason` field downstream code can render.
 *
 * Pdfjs-dist note: we use the legacy build (`pdfjs-dist/legacy/build/pdf`)
 * which is the same ES-module build that runs in pure JavaScript on
 * arbitrary runtimes — no DOM dependency, no worker required for plain
 * text extraction. The build is loaded lazily so apps that never upload a
 * PDF don't pay the parser cost on cold boot.
 */

import type { PickedFile } from "./picker";
import { readBlob } from "./blobStore";

export type ExtractResult =
  | {
      ok: true;
      /** UTF-8 extracted text. May be very long (50k+ chars). */
      text: string;
      /** "pdf-text-layer" | future: "ocr-ios" | "ocr-android". */
      method: "pdf-text-layer";
    }
  | {
      ok: false;
      reason:
        | "pdf_has_no_text_layer"
        | "ocr_not_supported_phase_1"
        | "extract_failed";
      detail?: string;
    };

/**
 * Extract plain text from a picked file. Reads the encrypted blob via
 * `blobStore.readBlob(reportId)`, decrypts in memory, and runs the
 * appropriate extractor.
 *
 * The plaintext bytes never touch disk in plaintext form.
 */
export async function extractText(
  file: PickedFile,
  reportId: string,
): Promise<ExtractResult> {
  try {
    if (file.kind === "pdf") {
      return await extractPdfTextLayer(reportId);
    }
    // Images are deferred until on-device OCR lands.
    return {
      ok: false,
      reason: "ocr_not_supported_phase_1",
      detail:
        "Image OCR is not yet supported on this device. You can still keep the file in your records; we'll add image parsing in a future update.",
    };
  } catch (err) {
    return {
      ok: false,
      reason: "extract_failed",
      detail: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Extract the text layer from a PDF. Returns
 * `{ ok: false, reason: "pdf_has_no_text_layer" }` for scanned PDFs that
 * yield zero (or near-zero) text — these need OCR, which is the Pass 2 gap.
 */
async function extractPdfTextLayer(reportId: string): Promise<ExtractResult> {
  const bytes = await readBlob(reportId);

  // Lazy-load pdfjs-dist. The legacy build runs in plain JS contexts and
  // doesn't require a worker for sequential text extraction.
  //
  // The module path is computed at runtime (via `dynamicImport` below) so
  // TypeScript doesn't fail when pdfjs-dist isn't yet installed. Treating
  // pdfjs-dist as an optional Pass-2 dependency means the rest of the
  // upload pipeline ships even when PDF parsing is opt-in.
  let pdfjs: PdfjsModule;
  try {
    pdfjs = (await dynamicImport("pdfjs-dist/legacy/build/pdf.mjs")) as PdfjsModule;
  } catch (err) {
    void err;
    // The pdf parser isn't installed yet at scaffold time. Surface a clear
    // error so the UI can prompt "PDF parsing is being set up" — the
    // operator can install pdfjs-dist as a Pass 2 follow-up.
    return {
      ok: false,
      reason: "extract_failed",
      detail:
        "PDF parser not installed. Install pdfjs-dist or use a text-only export.",
    };
  }

  const loadingTask = pdfjs.getDocument({
    data: bytes,
    // No worker / no font / no canvas — text extraction only.
    disableFontFace: true,
    isEvalSupported: false,
  });
  const doc = await loadingTask.promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .map((item) => ("str" in item && typeof item.str === "string" ? item.str : ""))
      .filter((s: string) => s.length > 0)
      .join(" ");
    if (pageText.length > 0) pages.push(pageText);
  }

  const text = pages.join("\n\n").trim();
  if (text.length < 16) {
    // A near-empty extraction strongly suggests a scanned PDF.
    return { ok: false, reason: "pdf_has_no_text_layer" };
  }
  return { ok: true, text, method: "pdf-text-layer" };
}

// ── Optional-dependency dynamic import ───────────────────────────────────
//
// TypeScript's static `import()` requires the module to be resolvable at
// compile time. pdfjs-dist is an optional Pass-2 install, so we hide the
// path behind a runtime-evaluated function. This same pattern is used in
// `app/src/app/api/diabetes/insights/route.ts` (the `await import()` call
// to `@/lib/fhir/transforms`) — but for non-resolvable optional deps the
// indirection below is necessary.

function dynamicImport(modulePath: string): Promise<unknown> {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
  const importer = new Function(
    "p",
    "return import(p);",
  ) as (p: string) => Promise<unknown>;
  return importer(modulePath);
}

// ── pdfjs-dist type subset ───────────────────────────────────────────────
//
// We type only what we use. Avoids forcing pdfjs-dist's @types into the
// project and keeps the lazy-import boundary explicit.

interface PdfjsModule {
  getDocument(params: {
    data: Uint8Array;
    disableFontFace?: boolean;
    isEvalSupported?: boolean;
  }): { promise: Promise<PdfDocument> };
}

interface PdfDocument {
  numPages: number;
  getPage(pageNumber: number): Promise<PdfPage>;
}

interface PdfPage {
  getTextContent(): Promise<{ items: Array<{ str?: string }> }>;
}

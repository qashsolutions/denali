/**
 * Phase 1 mobile — on-device text extraction (Wave 2; STEP 2 pivot to
 * `expo-pdf-text-extract` after the pdfjs-dist + Hermes + New-Arch dead end).
 *
 * Contract (unchanged from the Wave-2 design — UploadScreen.tsx is the sole
 * consumer and must not need edits):
 *
 *   `extractText(file: PickedFile, reportId: string): Promise<ExtractResult>`
 *
 * Phase 1 capability matrix:
 *
 *   | Source     | Platform | Status                                     |
 *   |------------|----------|--------------------------------------------|
 *   | PDF text   | iOS+And  | SUPPORTED via expo-pdf-text-extract — a    |
 *   |            |          | native bridge (PDFKit on iOS / PDFBox on   |
 *   |            |          | Android). Zero JS-engine dependency, so    |
 *   |            |          | Hermes + New Architecture safe. Requires a |
 *   |            |          | custom dev build (Denali already ships     |
 *   |            |          | one via expo-sqlite + expo-secure-store).  |
 *   | PDF scan   | iOS+And  | DEFERRED — needs OCR; surface gap          |
 *   |            |          | (`pdf_has_no_text_layer`).                 |
 *   | Image      | iOS+And  | DEFERRED — needs OCR; surface gap          |
 *   |            |          | (`ocr_not_supported_phase_1`).             |
 *
 * Why the native bridge (vs pdfjs-dist):
 *
 *   pdfjs-dist + Hermes + New Architecture + RN 0.85 has no documented
 *   working text-extraction reference as of 2026 (mozilla/pdf.js#18732 is
 *   still open). The earlier Wave-2 design used a `new Function(...)`
 *   lazy-load to defer the install — but that pattern is incompatible with
 *   Metro's static module resolution, so the PDF path always short-circuited
 *   to `extract_failed`. `expo-pdf-text-extract` v1.1.0 (zero npm deps,
 *   SDK 49+) bridges to PDFKit / PDFBox; both are platform-standard text
 *   APIs with no JS-engine dependency, sidestepping both issues. See
 *   `docs/history/phase-1-mobile-decisions.md` § D12 + § D13 for the full
 *   decision record.
 *
 *   The native call accepts a `file://` URI. We decrypt the blob in-memory
 *   via `blobStore.readBlob()` and write the plaintext to a temp file in
 *   `Paths.cache` just long enough for the native call to read it, then
 *   delete it (best-effort `finally`). The plaintext never persists across
 *   the function boundary.
 *
 * OCR gap rationale (per § D12):
 *
 *   At work date 2026-06-05, no on-device OCR library is broadly validated
 *   against the New Architecture + Expo SDK 56 + RN 0.85.3 stack:
 *     - @react-native-ml-kit/text-recognition (latest 2024-Q4) has no
 *       documented New-Arch support; install would require turbo-module-only
 *       interop work outside Wave 2 scope.
 *     - expo-text-recognition does not exist in SDK 56.
 *     - VisionKit text recognition via expo-modules-core requires a custom
 *       native module — not landed.
 *
 *   Per the upload-parse builder agent's hard rule ("On-device OCR or
 *   nothing. No cloud OCR fallback in Phase 1.") we ship PDF text-layer
 *   support only and surface a clear "OCR not yet supported on this device"
 *   message in the UI for scanned PDFs and image uploads. The reports row
 *   is still created (so the file is preserved encrypted on-device); the
 *   parse step is gated with a `reason` field downstream code can render.
 */

import { Directory, File, Paths } from "expo-file-system";
import * as PdfTextExtract from "expo-pdf-text-extract";

import { readBlob } from "./blobStore";
import type { PickedFile } from "./picker";

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
 * `blobStore.readBlob(reportId)`, decrypts in memory, hands the plaintext
 * to the native PDF bridge, and returns the extracted text.
 *
 * The plaintext bytes touch disk only inside `Paths.cache` and are deleted
 * before this function returns (best-effort).
 */
export async function extractText(
  file: PickedFile,
  reportId: string,
): Promise<ExtractResult> {
  try {
    if (file.kind === "pdf") {
      return await extractPdfTextLayer(reportId);
    }
    // Images are deferred until on-device OCR lands (§ D12).
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
 * Extract the text layer from a PDF via the native bridge. Maps the bridge's
 * outputs to the existing `ExtractResult` contract:
 *
 *   - Empty / near-empty text     → `{ ok: false, reason: "pdf_has_no_text_layer" }`
 *   - Throw (corrupt / bridge OK) → `{ ok: false, reason: "extract_failed",
 *                                       detail: <error message> }`
 *   - `isAvailable()` false       → `{ ok: false, reason: "extract_failed",
 *                                       detail: "Native PDF parser not available
 *                                                — install a dev build." }`
 *   - Success                     → `{ ok: true, text, method: "pdf-text-layer" }`
 */
async function extractPdfTextLayer(reportId: string): Promise<ExtractResult> {
  if (!PdfTextExtract.isAvailable()) {
    return {
      ok: false,
      reason: "extract_failed",
      detail:
        "Native PDF parser not available on this device. Run a development build (`npx expo run:ios` / `npx expo run:android`) — Expo Go cannot load native modules.",
    };
  }

  const bytes = await readBlob(reportId);

  // Stage the plaintext into a temp file the native bridge can open by URI.
  // The native module accepts a `file://` URI; we write into `Paths.cache`
  // (OS-managed, not Documents) and unlink in `finally`.
  const tmpDir = new Directory(Paths.cache, "pdf-extract-tmp");
  if (!tmpDir.exists) tmpDir.create({ intermediates: true });
  const tmpFile = new File(tmpDir, `${reportId}.pdf`);
  if (tmpFile.exists) tmpFile.delete();
  tmpFile.create();
  tmpFile.write(bytes);

  try {
    const text = await PdfTextExtract.extractText(tmpFile.uri);
    const trimmed = (text ?? "").trim();
    if (trimmed.length < 16) {
      // A near-empty extraction strongly suggests a scanned PDF — PDFKit /
      // PDFBox both return an empty string when no text layer exists.
      return { ok: false, reason: "pdf_has_no_text_layer" };
    }
    return { ok: true, text: trimmed, method: "pdf-text-layer" };
  } catch (err) {
    // The native bridge surfaces specific error codes (PASSWORD_REQUIRED,
    // INCORRECT_PASSWORD, FILE_NOT_FOUND, CORRUPT_PDF, UNKNOWN). We don't
    // surface those codes individually in Phase 1 — `extract_failed` with a
    // short message is enough for the UI. The detail message intentionally
    // carries no raw bytes / file contents.
    const detail = err instanceof Error ? err.message : String(err);
    return { ok: false, reason: "extract_failed", detail };
  } finally {
    // Best-effort cleanup — keep the temp directory but unlink the file. If
    // unlink fails the OS will reclaim the cache directory eventually.
    try {
      if (tmpFile.exists) tmpFile.delete();
    } catch {
      // ignore
    }
  }
}

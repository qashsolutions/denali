/**
 * Phase 1 mobile — file picker for upload pipeline (Wave 2).
 *
 * Wraps `expo-document-picker` (PDF) and `expo-image-picker` (JPG / PNG) so
 * the rest of the upload flow only sees a uniform `PickedFile`. Honors OS
 * permission prompts and the 15-MB size cap (mirrors the web's server-action
 * body limit; mobile has a separate request path but UX is parallel).
 *
 * Contracts consumed: none — this module is pre-DAL, pre-API.
 *
 * Invariants this module helps uphold:
 *   - The picked file's `uri` is a local file:// reference. We hand it off
 *     to `blobStore.storeBlob()` which encrypts it before any persistent
 *     write. No plaintext temp file should exist after the encryption step.
 */

import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

/** Max file size accepted by the picker (15 MB). */
export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

export type PickedFileKind = "pdf" | "image";

/**
 * Uniform shape returned by both picker variants. Downstream code (blob
 * store, extractor) consumes this and never reaches back into Expo's
 * heterogeneous result types.
 */
export interface PickedFile {
  kind: PickedFileKind;
  uri: string;
  /** Best-effort MIME type. May be undefined when the OS doesn't provide one. */
  mimeType: string | undefined;
  /** Original filename if known (often missing for image-library picks). */
  name: string;
  /** Size in bytes. -1 when the OS doesn't expose it (rare). */
  size: number;
}

export type PickerOutcome =
  | { ok: true; file: PickedFile }
  | { ok: false; canceled: true }
  | { ok: false; canceled: false; reason: PickerError };

export type PickerError =
  | "permission_denied"
  | "file_too_large"
  | "unsupported_type"
  | "no_asset";

// ── PDF picker ───────────────────────────────────────────────────────────

/**
 * Pick a PDF document. Returns canceled=true if the user dismisses, else
 * a `PickedFile` of kind `"pdf"`.
 */
export async function pickPdf(): Promise<PickerOutcome> {
  const result = await DocumentPicker.getDocumentAsync({
    type: "application/pdf",
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return { ok: false, canceled: true };
  }

  const asset = result.assets[0];
  const size = typeof asset.size === "number" ? asset.size : -1;
  if (size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, canceled: false, reason: "file_too_large" };
  }

  const mimeType = asset.mimeType;
  if (mimeType && !/^application\/pdf$/i.test(mimeType)) {
    return { ok: false, canceled: false, reason: "unsupported_type" };
  }

  return {
    ok: true,
    file: {
      kind: "pdf",
      uri: asset.uri,
      mimeType: mimeType,
      name: asset.name,
      size,
    },
  };
}

// ── Image picker ─────────────────────────────────────────────────────────

/**
 * Pick a single still image (JPG / PNG / HEIC). Requests media-library
 * permission first; returns `permission_denied` if the user declines.
 *
 * Phase 1 note: image OCR is deferred (see `extract.ts`). We still allow the
 * pick + encrypted blob storage so the report row exists; the parse step
 * surfaces a "image OCR not yet supported on this platform" message in the
 * UI. When OCR lands in Pass 2, no upstream code changes.
 */
export async function pickImage(): Promise<PickerOutcome> {
  // The library permission is required for the picker UI to enumerate assets.
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    return { ok: false, canceled: false, reason: "permission_denied" };
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    // Use the documented enum value rather than the literal so SDK upgrades
    // don't silently drift.
    mediaTypes: ["images"],
    allowsMultipleSelection: false,
    quality: 1,
  });

  if (result.canceled || !result.assets || result.assets.length === 0) {
    return { ok: false, canceled: true };
  }

  const asset = result.assets[0];
  const size = typeof asset.fileSize === "number" ? asset.fileSize : -1;
  if (size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, canceled: false, reason: "file_too_large" };
  }

  if (asset.type && asset.type !== "image") {
    return { ok: false, canceled: false, reason: "unsupported_type" };
  }

  // mimeType isn't directly on the asset; infer from extension when possible.
  const inferred = inferImageMime(asset.fileName ?? asset.uri);

  return {
    ok: true,
    file: {
      kind: "image",
      uri: asset.uri,
      mimeType: inferred,
      name: asset.fileName ?? deriveNameFromUri(asset.uri, ".jpg"),
      size,
    },
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function inferImageMime(nameOrUri: string): string | undefined {
  const ext = nameOrUri.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "heic":
    case "heif":
      return "image/heic";
    case "webp":
      return "image/webp";
    default:
      return undefined;
  }
}

function deriveNameFromUri(uri: string, fallbackExt: string): string {
  const tail = uri.split("/").pop();
  if (tail && tail.length > 0) return tail;
  return `image${fallbackExt}`;
}

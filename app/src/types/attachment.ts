/**
 * File Attachment Types
 *
 * Shared types for document upload in chat.
 * Supports PDF, PNG, and JPEG files.
 */

export type AttachmentMediaType = "image/png" | "image/jpeg" | "application/pdf";

export interface FileAttachment {
  fileName: string;
  mediaType: AttachmentMediaType;
  /** Base64-encoded file data (no data URL prefix) */
  base64Data: string;
  /** Original file size in bytes (pre-encoding) */
  sizeBytes: number;
}

export const ALLOWED_MEDIA_TYPES: AttachmentMediaType[] = [
  "image/png",
  "image/jpeg",
  "application/pdf",
];

export const FILE_INPUT_ACCEPT = ".pdf,.png,.jpg,.jpeg";

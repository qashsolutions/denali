"use client";

import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";
import type { FileAttachment, AttachmentMediaType } from "@/types/attachment";
import { ALLOWED_MEDIA_TYPES, FILE_INPUT_ACCEPT } from "@/types/attachment";
import { formatFileSize } from "@/config/pricing";

export interface ChatInputProps {
  onSend: (message: string, attachment?: FileAttachment) => void;
  disabled?: boolean;
  placeholder?: string;
  externalValue?: string;
  onExternalValueUsed?: () => void;
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
  /** Max file size in bytes. 0 = upload disabled (anon). -1 = unlimited (admin). undefined = upload hidden. */
  maxFileSizeBytes?: number;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Type your message...",
  externalValue,
  onExternalValueUsed,
  suggestions = [],
  onSuggestionClick,
  maxFileSizeBytes,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const [attachment, setAttachment] = useState<FileAttachment | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadsAllowed = maxFileSizeBytes !== undefined && maxFileSizeBytes !== 0;

  // Handle external value (e.g., from suggestion click)
  useEffect(() => {
    if (externalValue) {
      setValue(externalValue);
      onExternalValueUsed?.();
      // Focus the textarea
      textareaRef.current?.focus();
    }
  }, [externalValue, onExternalValueUsed]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
    }
  }, [value]);

  // Auto-clear file error after 5s
  useEffect(() => {
    if (!fileError) return;
    const timer = setTimeout(() => setFileError(null), 5000);
    return () => clearTimeout(timer);
  }, [fileError]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if ((value.trim() || attachment) && !disabled) {
      onSend(value.trim(), attachment || undefined);
      setValue("");
      setAttachment(null);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    if (onSuggestionClick) {
      onSuggestionClick(suggestion);
    } else {
      setValue(suggestion);
      textareaRef.current?.focus();
    }
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset the input so the same file can be re-selected
    e.target.value = "";

    // Validate type
    if (!ALLOWED_MEDIA_TYPES.includes(file.type as AttachmentMediaType)) {
      setFileError("Only PDF, PNG, and JPEG files are supported.");
      return;
    }

    // Validate size (-1 = unlimited, skip check)
    if (maxFileSizeBytes && maxFileSizeBytes > 0 && file.size > maxFileSizeBytes) {
      setFileError(`File too large. Your plan allows up to ${formatFileSize(maxFileSizeBytes)}.`);
      return;
    }

    // Read file as base64
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URL prefix (e.g., "data:application/pdf;base64,")
      const base64Data = result.split(",")[1];
      if (!base64Data) {
        setFileError("Failed to read file.");
        return;
      }
      setAttachment({
        fileName: file.name,
        mediaType: file.type as AttachmentMediaType,
        base64Data,
        sizeBytes: file.size,
      });
      setFileError(null);
    };
    reader.onerror = () => {
      setFileError("Failed to read file.");
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = () => {
    setAttachment(null);
  };

  const canSend = (value.trim() || attachment) && !disabled;

  return (
    <form onSubmit={handleSubmit} className="chat-input w-full">
      <div className="bg-[var(--input-bg)] rounded-2xl border border-[var(--input-border)] overflow-hidden">
        {/* Suggestions inside input area */}
        {suggestions.length > 0 && !disabled && (
          <div className="flex flex-wrap items-center gap-2 px-4 pt-3 pb-2">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className={cn(
                  "px-4 py-2 rounded-full",
                  "text-base font-bold",
                  "text-white",
                  "bg-[var(--accent-primary)] hover:bg-[var(--accent-primary)]/80",
                  "transition-colors",
                  "whitespace-nowrap"
                )}
              >
                {suggestion}
              </button>
            ))}
            <span className="text-base text-[var(--text-muted)] ml-1">
              or type below
            </span>
          </div>
        )}

        {/* File error message */}
        {fileError && (
          <div className="px-4 pt-2 text-sm text-red-500">
            {fileError}
          </div>
        )}

        {/* Attachment preview chip */}
        {attachment && (
          <div className="px-4 pt-3">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-sm">
              {attachment.mediaType === "application/pdf" ? (
                <FileDocumentIcon className="w-4 h-4 text-red-500 flex-shrink-0" />
              ) : (
                <FileImageIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />
              )}
              <span className="truncate max-w-[200px] text-[var(--text-primary)]">
                {attachment.fileName}
              </span>
              <span className="text-[var(--text-muted)] text-xs">
                {formatFileSize(attachment.sizeBytes)}
              </span>
              <button
                type="button"
                onClick={removeAttachment}
                className="ml-1 p-0.5 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                aria-label="Remove attachment"
              >
                <XIcon className="w-3.5 h-3.5" />
              </button>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-1.5 flex items-center gap-1">
              <LockIcon className="w-3 h-3 flex-shrink-0" />
              Your file is not stored. It is used only for this message and then discarded.
            </p>
          </div>
        )}

        {/* Text input row */}
        <div className="flex items-end gap-2 p-3">
          {/* Paperclip button (only when uploads are allowed) */}
          {uploadsAllowed && (
            <button
              type="button"
              onClick={handleFileSelect}
              disabled={disabled}
              className={cn(
                "flex-shrink-0 w-10 h-10 rounded-xl",
                "flex items-center justify-center",
                "text-[var(--text-muted)] hover:text-[var(--text-primary)]",
                "hover:bg-[var(--bg-tertiary)]",
                "transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              aria-label="Attach file"
              title="Attach PDF, PNG, or JPEG"
            >
              <PaperclipIcon className="w-5 h-5" />
            </button>
          )}

          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className={cn(
              "flex-1 resize-none bg-transparent px-2 py-2",
              "text-lg text-[var(--text-primary)] placeholder:text-[var(--text-muted)]",
              "focus:outline-none",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "min-h-[48px] max-h-[150px]"
            )}
            aria-label="Type your message"
          />
          <button
            type="submit"
            disabled={!canSend}
            className={cn(
              "flex-shrink-0 w-12 h-12 rounded-xl",
              "flex items-center justify-center",
              "bg-gradient-to-r from-[var(--user-bubble-from)] to-[var(--user-bubble-to)]",
              "text-white transition-opacity",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              "hover:opacity-90"
            )}
            aria-label="Send message"
          >
            <SendIcon className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={FILE_INPUT_ACCEPT}
        onChange={handleFileChange}
        className="hidden"
        aria-hidden="true"
      />
    </form>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}

function PaperclipIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
    </svg>
  );
}

function FileDocumentIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function FileImageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function LockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  );
}

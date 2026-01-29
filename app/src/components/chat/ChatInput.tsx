"use client";

import { useState, useRef, useEffect, type FormEvent, type KeyboardEvent } from "react";
import { cn } from "@/lib/utils";

export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  externalValue?: string;
  onExternalValueUsed?: () => void;
  suggestions?: string[];
  onSuggestionClick?: (suggestion: string) => void;
}

export function ChatInput({
  onSend,
  disabled = false,
  placeholder = "Type your message...",
  externalValue,
  onExternalValueUsed,
  suggestions = [],
  onSuggestionClick,
}: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim() && !disabled) {
      onSend(value.trim());
      setValue("");
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

        {/* Text input row */}
        <div className="flex items-end gap-2 p-3">
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
            disabled={disabled || !value.trim()}
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

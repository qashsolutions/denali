"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/utils";
import { MarkdownContent } from "./MarkdownContent";

export interface MessageProps {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp?: Date | string;
  showFeedback?: boolean;
  onFeedback?: (rating: "up" | "down") => void;
  feedbackGiven?: "up" | "down" | null;
  onCopy?: () => void;
}

export function Message({
  role,
  content,
  timestamp,
  showFeedback = false,
  onFeedback,
  feedbackGiven: initialFeedback = null,
  onCopy,
}: MessageProps) {
  const isUser = role === "user";
  const [feedbackGiven, setFeedbackGiven] = useState<"up" | "down" | null>(initialFeedback);
  const [copied, setCopied] = useState(false);

  const handleFeedback = (rating: "up" | "down") => {
    setFeedbackGiven(rating);
    onFeedback?.(rating);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement("textarea");
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      onCopy?.();
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={cn(
        "flex w-full mb-4",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3",
          isUser
            ? "bg-gradient-to-r from-[var(--user-bubble-from)] to-[var(--user-bubble-to)] text-white rounded-br-md"
            : "bg-[var(--assistant-bubble)] text-[var(--text-primary)] rounded-bl-md border border-[var(--border)]"
        )}
      >
        {isUser ? (
          <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
            {content}
          </div>
        ) : (
          <MarkdownContent content={content} />
        )}

        {timestamp && (
          <div
            className={cn(
              "text-xs mt-2",
              isUser ? "text-white/70" : "text-[var(--text-muted)]"
            )}
          >
            {formatTime(timestamp)}
          </div>
        )}

        {!isUser && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
            <button
              onClick={handleCopy}
              className={cn(
                "p-1.5 rounded-md transition-colors",
                copied
                  ? "bg-green-500/20 text-green-500"
                  : "hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
              )}
              aria-label="Copy message"
            >
              {copied ? (
                <CheckIcon className="w-4 h-4" />
              ) : (
                <CopyIcon className="w-4 h-4" />
              )}
            </button>
            {copied && (
              <span className="text-xs text-green-500">Copied!</span>
            )}
            {showFeedback && onFeedback && (
              <>
                <div className="w-px h-4 bg-[var(--border)] mx-0.5" />
                <button
                  onClick={() => handleFeedback("up")}
                  disabled={feedbackGiven !== null}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    feedbackGiven === "up"
                      ? "bg-green-500/20 text-green-500"
                      : feedbackGiven === null
                      ? "hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                      : "text-[var(--text-muted)] opacity-40"
                  )}
                  aria-label="Helpful"
                >
                  <ThumbsUpIcon className={cn("w-4 h-4", feedbackGiven === "up" && "fill-current")} />
                </button>
                <button
                  onClick={() => handleFeedback("down")}
                  disabled={feedbackGiven !== null}
                  className={cn(
                    "p-1.5 rounded-md transition-colors",
                    feedbackGiven === "down"
                      ? "bg-red-500/20 text-red-500"
                      : feedbackGiven === null
                      ? "hover:bg-[var(--bg-tertiary)] text-[var(--text-muted)]"
                      : "text-[var(--text-muted)] opacity-40"
                  )}
                  aria-label="Not helpful"
                >
                  <ThumbsDownIcon className={cn("w-4 h-4", feedbackGiven === "down" && "fill-current")} />
                </button>
                {feedbackGiven && (
                  <span className="text-xs text-[var(--text-muted)] ml-2">Thanks for feedback!</span>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ThumbsUpIcon({ className }: { className?: string }) {
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
        d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14zm-9 11H4a2 2 0 01-2-2v-7a2 2 0 012-2h1"
      />
    </svg>
  );
}

function CopyIcon({ className }: { className?: string }) {
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
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
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
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

function ThumbsDownIcon({ className }: { className?: string }) {
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
        d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10zm9-13h1a2 2 0 012 2v7a2 2 0 01-2 2h-1"
      />
    </svg>
  );
}

export function LoadingMessage() {
  return (
    <div className="flex w-full mb-4 justify-start">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md px-4 py-3 bg-[var(--assistant-bubble)] border border-[var(--border)]">
        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
          <LoadingDots />
          <span className="text-sm">Thinking...</span>
        </div>
      </div>
    </div>
  );
}

function LoadingDots() {
  return (
    <span className="flex gap-1">
      <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)] animate-pulse" />
      <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)] animate-pulse [animation-delay:150ms]" />
      <span className="h-2 w-2 rounded-full bg-[var(--accent-primary)] animate-pulse [animation-delay:300ms]" />
    </span>
  );
}

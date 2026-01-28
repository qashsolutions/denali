"use client";

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
}

export function Message({
  role,
  content,
  timestamp,
  showFeedback = false,
  onFeedback,
}: MessageProps) {
  const isUser = role === "user";

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

        {!isUser && showFeedback && onFeedback && (
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--border)]">
            <button
              onClick={() => onFeedback("up")}
              className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors"
              aria-label="Helpful"
            >
              <ThumbsUpIcon className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
            <button
              onClick={() => onFeedback("down")}
              className="p-1.5 rounded-md hover:bg-[var(--bg-tertiary)] transition-colors"
              aria-label="Not helpful"
            >
              <ThumbsDownIcon className="w-4 h-4 text-[var(--text-muted)]" />
            </button>
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

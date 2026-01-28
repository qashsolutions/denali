"use client";

import { useMemo } from "react";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Simple markdown renderer for chat messages
 * Supports: **bold**, *italic*, checkboxes (□/✓), line breaks
 */
export function MarkdownContent({ content, className = "" }: MarkdownContentProps) {
  const rendered = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div
      className={`prose-chat ${className}`}
      dangerouslySetInnerHTML={{ __html: rendered }}
    />
  );
}

function parseMarkdown(text: string): string {
  // Split by double newlines to create paragraphs
  const paragraphs = text.split(/\n\n+/);

  return paragraphs
    .map((para) => {
      // Process each paragraph
      let html = para
        // Escape HTML entities first
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        // Bold: **text**
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        // Italic: *text*
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        // Checkbox unchecked: □
        .replace(/□/g, '<span class="checkbox checkbox--unchecked">☐</span>')
        // Checkbox checked: ✓ or ✔
        .replace(/[✓✔]/g, '<span class="checkbox checkbox--checked">✓</span>')
        // Line breaks
        .replace(/\n/g, "<br />");

      // Check if this is a checklist item (starts with checkbox)
      if (html.startsWith('<span class="checkbox')) {
        return `<div class="checklist-item">${html}</div>`;
      }

      return `<p>${html}</p>`;
    })
    .join("");
}

/**
 * Checklist component for printable guidance
 */
export interface ChecklistItem {
  text: string;
  checked?: boolean;
}

interface ChecklistProps {
  title?: string;
  items: ChecklistItem[];
  className?: string;
}

export function Checklist({ title, items, className = "" }: ChecklistProps) {
  return (
    <div className={`checklist ${className}`}>
      {title && (
        <h3 className="text-[var(--text-primary)] font-semibold mb-3">
          {title}
        </h3>
      )}
      <ul className="space-y-2">
        {items.map((item, index) => (
          <li
            key={index}
            className="flex items-start gap-3 text-[var(--text-primary)]"
          >
            <span
              className={`flex-shrink-0 w-5 h-5 rounded border flex items-center justify-center text-sm ${
                item.checked
                  ? "bg-[var(--success)] border-[var(--success)] text-white"
                  : "border-[var(--border)]"
              }`}
            >
              {item.checked ? "✓" : ""}
            </span>
            <span className={item.checked ? "line-through opacity-60" : ""}>
              {item.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

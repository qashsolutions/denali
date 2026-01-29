"use client";

import { useMemo } from "react";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Simple markdown renderer for chat messages
 * Supports: **bold**, *italic*, checkboxes (□/✓), line breaks, tables
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
  // First, extract and process tables
  const tableRegex = /\|(.+)\|\n\|[-:\s|]+\|\n((?:\|.+\|\n?)+)/g;
  let processedText = text;

  // Find all tables and replace with HTML
  const tables: string[] = [];
  processedText = processedText.replace(tableRegex, (match, headerRow, bodyRows) => {
    const tableHtml = parseTable(headerRow, bodyRows);
    tables.push(tableHtml);
    return `__TABLE_${tables.length - 1}__`;
  });

  // Split by double newlines to create paragraphs
  const paragraphs = processedText.split(/\n\n+/);

  const result = paragraphs
    .map((para) => {
      // Check if this is a table placeholder
      const tableMatch = para.match(/^__TABLE_(\d+)__$/);
      if (tableMatch) {
        return tables[parseInt(tableMatch[1])];
      }

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

  return result;
}

/**
 * Parse a markdown table into HTML
 */
function parseTable(headerRow: string, bodyRows: string): string {
  // Parse header cells
  const headers = headerRow
    .split("|")
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0);

  // Parse body rows
  const rows = bodyRows
    .trim()
    .split("\n")
    .map((row) =>
      row
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell) => cell.length > 0)
    )
    .filter((row) => row.length > 0);

  // Build HTML table with inline styles for proper rendering
  let html = `<div class="table-wrapper" style="overflow-x: auto; margin: 0.75rem 0;">`;
  html += `<table style="width: 100%; border-collapse: collapse; font-size: 0.875rem;">`;

  // Header
  html += `<thead><tr style="border-bottom: 2px solid var(--border);">`;
  headers.forEach((header) => {
    // Process bold in header
    const processedHeader = header.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    html += `<th style="padding: 0.5rem 0.75rem; text-align: left; font-weight: 600; color: var(--text-secondary);">${processedHeader}</th>`;
  });
  html += `</tr></thead>`;

  // Body
  html += `<tbody>`;
  rows.forEach((row, rowIndex) => {
    const bgColor = rowIndex % 2 === 0 ? "transparent" : "rgba(255,255,255,0.03)";
    html += `<tr style="border-bottom: 1px solid var(--border); background: ${bgColor};">`;
    row.forEach((cell, cellIndex) => {
      // Process bold in cells
      let processedCell = cell.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
      // First column (usually doctor name) - make it stand out
      const fontWeight = cellIndex === 0 ? "500" : "400";
      html += `<td style="padding: 0.5rem 0.75rem; color: var(--text-primary); font-weight: ${fontWeight};">${processedCell}</td>`;
    });
    html += `</tr>`;
  });
  html += `</tbody>`;

  html += `</table></div>`;

  return html;
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

"use client";

import { useState, useCallback, useMemo } from "react";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/Button";
import { AppealGate } from "./AppealGate";
import { MarkdownContent } from "@/components/chat/MarkdownContent";
import { BRAND } from "@/config";
import type { AppealLetterData } from "@/hooks/useChat";

/**
 * Extract the formal letter portion from Claude's full response.
 * Returns content from "MEDICARE APPEAL REQUEST" through the signature block,
 * with markdown intact (for modal display).
 */
function extractLetterContent(content: string): string {
  const lines = content.split("\n");
  let startIdx = -1;
  let endIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (startIdx === -1 && lines[i].includes("MEDICARE APPEAL REQUEST")) {
      startIdx = i;
    }
    if (startIdx !== -1 && /sincerely,?/i.test(lines[i])) {
      endIdx = i;
      // Include up to 3 lines after Sincerely for signature block
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        if (lines[j].trim() === "") continue;
        if (lines[j].startsWith("---") || lines[j].startsWith("##") || lines[j].startsWith("**")) break;
        endIdx = j;
      }
      break;
    }
  }

  if (startIdx !== -1 && endIdx !== -1) {
    return lines.slice(startIdx, endIdx + 1).join("\n").trim();
  }
  return content; // fallback: return everything
}

/**
 * Plain-text version of the letter for copy and PDF.
 * Strips markdown formatting.
 */
function getCleanLetter(content: string): string {
  return extractLetterContent(content)
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold
    .replace(/#{1,6}\s*/g, "") // headings
    .replace(/`([^`]+)`/g, "$1") // inline code
    .trim();
}

/**
 * Generate a PDF document from the clean letter text.
 */
function buildPDF(cleanText: string): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 72; // 1 inch
  const pageWidth = doc.internal.pageSize.getWidth();
  const lineWidth = pageWidth - margin * 2;

  doc.setFont("helvetica");
  doc.setFontSize(11);

  const lines = doc.splitTextToSize(cleanText, lineWidth);
  let y = margin;
  const lineHeight = 14;

  for (const line of lines) {
    if (y + lineHeight > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  }

  return doc;
}

interface AppealLetterModalProps {
  data: AppealLetterData;
  onClose: () => void;
  onReportOutcome?: () => void;
}

export function AppealLetterModal({
  data,
  onClose,
  onReportOutcome,
}: AppealLetterModalProps) {
  const [accessGranted, setAccessGranted] = useState(false);
  const [copied, setCopied] = useState(false);

  // Extract only the formal letter (no Claude commentary)
  const letterMarkdown = useMemo(
    () => extractLetterContent(data.letterContent),
    [data.letterContent]
  );

  const handleAccessGranted = useCallback(() => {
    setAccessGranted(true);
  }, []);

  const handleCopy = useCallback(async () => {
    const cleanText = getCleanLetter(data.letterContent);
    try {
      await navigator.clipboard.writeText(cleanText);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = cleanText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [data.letterContent]);

  const handleDownload = useCallback(() => {
    const cleanText = getCleanLetter(data.letterContent);
    const doc = buildPDF(cleanText);
    doc.save(`appeal-letter-${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [data.letterContent]);

  const handlePrint = useCallback(() => {
    const cleanText = getCleanLetter(data.letterContent);
    const doc = buildPDF(cleanText);
    // Open PDF in new tab for native print
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.addEventListener("load", () => {
        win.print();
      });
    }
  }, [data.letterContent]);

  const handleReportOutcome = useCallback(() => {
    onClose();
    onReportOutcome?.();
  }, [onClose, onReportOutcome]);

  // Format deadline for display
  const deadlineDisplay = data.appealDeadline
    ? new Date(data.appealDeadline).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white text-black max-w-2xl w-full max-h-[90vh] overflow-auto rounded-lg shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Appeal Letter</h2>
          <div className="flex gap-2">
            {accessGranted && (
              <>
                <Button variant="secondary" size="sm" onClick={handleCopy}>
                  {copied ? "Copied!" : "Copy"}
                </Button>
                <Button variant="secondary" size="sm" onClick={handleDownload}>
                  Download PDF
                </Button>
                <Button variant="primary" size="sm" onClick={handlePrint}>
                  Print
                </Button>
              </>
            )}
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {/* Deadline banner */}
        {deadlineDisplay && (
          <div className="bg-red-50 border-b border-red-200 px-4 py-3 text-red-800 text-sm font-medium">
            Appeal deadline: {deadlineDisplay} (120 days from denial date)
          </div>
        )}

        {/* Letter content only (no Claude commentary) */}
        <div className="p-8">
          <AppealGate onAccessGranted={handleAccessGranted}>
            <MarkdownContent content={letterMarkdown} />
          </AppealGate>
        </div>

        {/* Footer - policy references + outcome link */}
        <div className="border-t p-4">
          {data.policyReferences.length > 0 && (
            <p className="text-xs text-gray-500 mb-2">
              Policy references: {data.policyReferences.join(", ")}
            </p>
          )}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              Generated by {BRAND.DOMAIN}
            </p>
            {accessGranted && onReportOutcome && (
              <button
                onClick={handleReportOutcome}
                className="text-xs text-blue-600 hover:text-blue-800 underline"
              >
                Report appeal outcome
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

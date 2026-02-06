"use client";

import { useState, useCallback } from "react";
import jsPDF from "jspdf";
import { Button } from "@/components/ui/Button";
import { AppealGate } from "./AppealGate";
import { MarkdownContent } from "@/components/chat/MarkdownContent";
import { BRAND } from "@/config";
import type { AppealLetterData } from "@/hooks/useChat";

/**
 * Extract the formal letter from Claude's full response.
 * The letter runs from "MEDICARE APPEAL REQUEST" through the line containing "[ADDRESS]".
 * Strips markdown formatting for plain-text use in copy/PDF.
 */
function getCleanLetter(content: string): string {
  const lines = content.split("\n");
  let startIdx = -1;
  let endIdx = -1;

  for (let i = 0; i < lines.length; i++) {
    if (startIdx === -1 && lines[i].includes("MEDICARE APPEAL REQUEST")) {
      startIdx = i;
    }
    if (startIdx !== -1 && lines[i].includes("[ADDRESS]")) {
      endIdx = i;
      break;
    }
  }

  const letterLines =
    startIdx !== -1 && endIdx !== -1
      ? lines.slice(startIdx, endIdx + 1)
      : lines;

  return letterLines
    .join("\n")
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold
    .replace(/#{1,6}\s*/g, "") // headings
    .replace(/`([^`]+)`/g, "$1") // inline code
    .trim();
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

  const handleAccessGranted = useCallback(() => {
    setAccessGranted(true);
  }, []);

  const handleCopy = useCallback(async () => {
    const cleanText = getCleanLetter(data.letterContent);
    try {
      await navigator.clipboard.writeText(cleanText);
    } catch {
      // Fallback for older browsers
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
    const doc = new jsPDF({ unit: "pt", format: "letter" });
    const cleanText = getCleanLetter(data.letterContent);
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

    doc.save(`appeal-letter-${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [data.letterContent]);

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

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
        {/* Header - always visible */}
        <div className="no-print sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Appeal Letter</h2>
          <div className="flex gap-2">
            {accessGranted && (
              <>
                <Button variant="secondary" size="sm" onClick={handleCopy}>
                  {copied ? "Copied!" : "Copy"}
                </Button>
                <Button variant="secondary" size="sm" onClick={handleDownload}>
                  Download
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
          <div className="no-print bg-red-50 border-b border-red-200 px-4 py-3 text-red-800 text-sm font-medium">
            Appeal deadline: {deadlineDisplay} (120 days from denial date)
          </div>
        )}

        {/* Content wrapped in AppealGate */}
        <div className="p-8 print:p-4">
          <AppealGate onAccessGranted={handleAccessGranted}>
            <MarkdownContent content={data.letterContent} />
          </AppealGate>
        </div>

        {/* Instructions - visible in modal only, not in copy/download/print */}
        {accessGranted && (
          <div className="no-print border-t border-gray-200 mx-8 pb-6 pt-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">
              Before you mail it
            </h3>
            <ul className="text-sm text-gray-600 space-y-1.5">
              <li className="flex gap-2">
                <span className="text-gray-400">1.</span>
                Fill in the bracketed fields with your information
              </li>
              <li className="flex gap-2">
                <span className="text-gray-400">2.</span>
                Attach a copy of the denial notice
              </li>
              <li className="flex gap-2">
                <span className="text-gray-400">3.</span>
                Include relevant medical records
              </li>
              <li className="flex gap-2">
                <span className="text-gray-400">4.</span>
                Sign the letter (or have your authorized representative sign)
              </li>
              <li className="flex gap-2">
                <span className="text-gray-400">5.</span>
                Mail to the address on your denial notice
                {deadlineDisplay && (
                  <span className="font-medium text-red-700">
                    {" "}
                    by {deadlineDisplay}
                  </span>
                )}
              </li>
            </ul>
          </div>
        )}

        {/* Footer - policy references + outcome link */}
        <div className="no-print border-t p-4">
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

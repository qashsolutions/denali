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
 * Generate a PDF with the formal letter on page 1 and instructions on page 2.
 */
function buildPDF(
  cleanText: string,
  deadlineInfo: { display: string; daysRemaining: number; expired: boolean } | null
): jsPDF {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const margin = 72; // 1 inch
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const lineWidth = pageWidth - margin * 2;

  // --- Page 1: Formal Appeal Letter ---
  doc.setFont("helvetica");
  doc.setFontSize(11);

  const lines = doc.splitTextToSize(cleanText, lineWidth);
  let y = margin;
  const lineHeight = 14;

  for (const line of lines) {
    if (y + lineHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  }

  // --- Page 2: Instructions for the User ---
  doc.addPage();
  y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("Before You Mail This Letter", margin, y);
  y += 28;

  // Deadline
  if (deadlineInfo) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    if (deadlineInfo.expired) {
      doc.text(
        `DEADLINE PASSED: ${Math.abs(deadlineInfo.daysRemaining)} days ago (${deadlineInfo.display})`,
        margin, y
      );
    } else {
      doc.text(
        `DEADLINE: ${deadlineInfo.daysRemaining} days remaining - mail by ${deadlineInfo.display}`,
        margin, y
      );
    }
    y += 24;
  }

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);

  const instructions = [
    "1. Fill in the blank lines on the letter:",
    "     - Your last name",
    "     - Medicare number (from your red, white & blue card)",
    "     - Claim number (on the denial letter)",
    "",
    "2. Sign and date the letter",
    "",
    "3. Add your phone number and mailing address below your signature",
    "",
    "4. Attach the following documents:",
    "     - Copy of the denial notice",
    "     - Relevant medical records",
    "     - Physician's order or referral",
    "     - Any supporting documentation (PT records, imaging, etc.)",
    "",
    "5. Mail everything to the address on your denial notice",
    "",
    "",
    "Tips for a stronger appeal:",
    "  - Send by certified mail with return receipt",
    "  - Keep a copy of everything you send",
    "  - Ask your doctor's office for a letter of medical necessity",
    "  - Include records showing failed conservative treatments",
  ];

  for (const line of instructions) {
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

  // Format deadline for display with days remaining
  const deadlineInfo = useMemo(() => {
    if (!data.appealDeadline) return null;
    const deadline = new Date(data.appealDeadline);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);
    const daysRemaining = Math.ceil(
      (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );
    const display = new Date(data.appealDeadline).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    return { display, daysRemaining, expired: daysRemaining < 0 };
  }, [data.appealDeadline]);

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
    const doc = buildPDF(cleanText, deadlineInfo);
    doc.save(`appeal-letter-${new Date().toISOString().slice(0, 10)}.pdf`);
  }, [data.letterContent, deadlineInfo]);

  const handlePrint = useCallback(() => {
    const cleanText = getCleanLetter(data.letterContent);
    const doc = buildPDF(cleanText, deadlineInfo);
    // Open PDF in new tab for native print
    const blob = doc.output("blob");
    const url = URL.createObjectURL(blob);
    const win = window.open(url, "_blank");
    if (win) {
      win.addEventListener("load", () => {
        win.print();
      });
    }
  }, [data.letterContent, deadlineInfo]);

  const handleReportOutcome = useCallback(() => {
    onClose();
    onReportOutcome?.();
  }, [onClose, onReportOutcome]);

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

        {/* Deadline banner with days remaining */}
        {deadlineInfo && (
          <div
            className={`border-b px-4 py-3 text-sm font-medium ${
              deadlineInfo.expired
                ? "bg-gray-100 border-gray-300 text-gray-700"
                : deadlineInfo.daysRemaining <= 14
                  ? "bg-red-100 border-red-300 text-red-900"
                  : "bg-amber-50 border-amber-200 text-amber-900"
            }`}
          >
            {deadlineInfo.expired ? (
              <>
                Deadline passed {Math.abs(deadlineInfo.daysRemaining)} days ago
                ({deadlineInfo.display}). Late filing may still be possible
                with good cause.
              </>
            ) : (
              <>
                {deadlineInfo.daysRemaining} days left to file — deadline{" "}
                {deadlineInfo.display}
              </>
            )}
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

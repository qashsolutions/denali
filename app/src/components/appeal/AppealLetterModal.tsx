"use client";

import { useState, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { AppealGate } from "./AppealGate";
import { MarkdownContent } from "@/components/chat/MarkdownContent";
import { BRAND } from "@/config";
import { extractLetterContent, getCleanLetter, buildPDF, calculateDeadlineInfo } from "@/lib/appeal-pdf";
import type { AppealLetterData } from "@/hooks/useChat";

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
    return calculateDeadlineInfo(data.appealDeadline);
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

  // Informational mode for Levels 4-5 (no letter, just guidance)
  if (data.isInformational) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white text-black max-w-2xl w-full max-h-[90vh] overflow-auto rounded-lg shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              Level {data.appealLevel} — {data.levelName || (data.appealLevel === 4 ? "Medicare Appeals Council" : "Federal District Court")}
            </h2>
            <Button variant="ghost" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>

          {/* Guidance content */}
          <div className="p-6 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-medium text-amber-900 mb-1">Guidance Only</p>
              <p className="text-sm text-amber-800">
                Levels 4-5 are complex legal proceedings. We strongly recommend working with a Medicare rights attorney or SHIP counselor.
              </p>
            </div>

            {/* Claude's response is in letterContent (which is data.content for informational) */}
            <div className="prose prose-sm max-w-none">
              <MarkdownContent content={data.letterContent} />
            </div>

            {data.nextSteps && data.nextSteps.length > 0 && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-sm font-semibold text-gray-800 mb-2">Next Steps</p>
                <ul className="text-sm text-gray-700 space-y-1.5 list-disc list-inside">
                  {data.nextSteps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900">Free Help Available</p>
              <p className="text-sm text-blue-800 mt-1">
                Contact your State Health Insurance Assistance Program (SHIP) for free, unbiased Medicare counseling: <strong>1-877-839-2675</strong>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t p-4 space-y-1">
            <p className="text-xs text-gray-400">
              Generated by {BRAND.DOMAIN}
            </p>
            <p className="text-xs text-gray-400">
              This product uses the Blue Button APIs but is not endorsed or certified by the Centers for Medicare &amp; Medicaid Services or the U.S. Department of Health and Human Services.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Level label for header
  const levelLabel = data.appealLevel === 1
    ? "Appeal Letter"
    : `Level ${data.appealLevel} Appeal Letter`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white text-black max-w-2xl w-full max-h-[90vh] overflow-auto rounded-lg shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{levelLabel}</h2>
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

        {/* Free escalation banner for Level 2+ */}
        {data.appealLevel >= 2 && accessGranted && (
          <div className="border-b px-4 py-2 bg-green-50 border-green-200">
            <p className="text-xs font-medium text-green-800">
              Level {data.appealLevel} escalation — no additional credit used
            </p>
          </div>
        )}

        {/* Review checklist banner */}
        {accessGranted && (
          <div className="border-b px-4 py-3 bg-blue-50 border-blue-200">
            <p className="text-sm font-medium text-blue-900">Before submitting:</p>
            <ul className="text-xs text-blue-800 mt-1 space-y-0.5 list-disc list-inside">
              <li>Fill in your Medicare number, claim number, and date of service</li>
              <li>Sign and date the letter</li>
              <li>Attach your denial notice and medical records</li>
              {data.appealLevel >= 2 && (
                <li>Include copies of all prior appeal denial letters</li>
              )}
              <li>Review all details with your healthcare provider</li>
            </ul>
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
          <p className="text-xs text-gray-400">
            This product uses the Blue Button APIs but is not endorsed or certified by the Centers for Medicare &amp; Medicaid Services or the U.S. Department of Health and Human Services.
          </p>
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

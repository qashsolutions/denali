/**
 * Appeal PDF Utilities
 *
 * Shared functions for extracting letter content, cleaning markdown,
 * and generating PDFs. Used by both AppealCard (direct download) and
 * AppealLetterModal (modal display).
 */

import jsPDF from "jspdf";

/**
 * Extract the formal letter portion from Claude's full response.
 * Returns content from "MEDICARE APPEAL REQUEST" through the signature block,
 * with markdown intact (for modal display).
 */
export function extractLetterContent(content: string): string {
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
export function getCleanLetter(content: string): string {
  return extractLetterContent(content)
    .replace(/\*\*(.*?)\*\*/g, "$1") // bold
    .replace(/#{1,6}\s*/g, "") // headings
    .replace(/`([^`]+)`/g, "$1") // inline code
    .trim();
}

export interface DeadlineInfo {
  display: string;
  daysRemaining: number;
  expired: boolean;
}

/**
 * Calculate deadline info from an appeal deadline date string.
 */
export function calculateDeadlineInfo(appealDeadline: string): DeadlineInfo {
  const deadline = new Date(appealDeadline);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  deadline.setHours(0, 0, 0, 0);
  const daysRemaining = Math.ceil(
    (deadline.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  );
  const display = new Date(appealDeadline).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return { display, daysRemaining, expired: daysRemaining < 0 };
}

/**
 * Generate a PDF with the formal letter on page 1 and instructions on page 2.
 */
export function buildPDF(
  cleanText: string,
  deadlineInfo: DeadlineInfo | null
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

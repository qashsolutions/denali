"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { calculateDeadlineInfo } from "@/lib/appeal-pdf";
import type { AppealLetterData } from "@/hooks/useChat";

interface AppealCardProps {
  data: AppealLetterData;
  onView: () => void;
}

export function AppealCard({ data, onView }: AppealCardProps) {
  const deadlineInfo = useMemo(() => {
    if (!data.appealDeadline) return null;
    return calculateDeadlineInfo(data.appealDeadline);
  }, [data.appealDeadline]);

  // Build subtitle: denial code + deadline
  const subtitle = useMemo(() => {
    const parts: string[] = [];
    if (data.denialCodes.length > 0) {
      parts.push(`Denial: ${data.denialCodes.join(", ")}`);
    }
    if (deadlineInfo) {
      if (deadlineInfo.expired) {
        parts.push(`Deadline passed`);
      } else {
        parts.push(`${deadlineInfo.daysRemaining} days to file`);
      }
    }
    return parts.join(" · ");
  }, [data.denialCodes, deadlineInfo]);

  return (
    <div className="max-w-[85%] bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-4">
      <div className="flex items-center gap-3">
        {/* PDF Icon */}
        <div className="flex-shrink-0 w-11 h-11 rounded-lg bg-red-50 flex items-center justify-center">
          <PdfIcon className="w-6 h-6 text-red-600" />
        </div>

        {/* Title + subtitle */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-[var(--text-primary)]">
            Appeal Letter
          </p>
          {subtitle && (
            <p className="text-xs text-[var(--text-muted)] truncate mt-0.5">
              {subtitle}
            </p>
          )}
        </div>

        {/* Action button — download available inside the gated modal */}
        <div className="flex-shrink-0">
          <Button variant="primary" size="sm" onClick={onView}>
            View
          </Button>
        </div>
      </div>
    </div>
  );
}

function PdfIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
      />
    </svg>
  );
}

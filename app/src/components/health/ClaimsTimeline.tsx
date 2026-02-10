"use client";

import { useState } from "react";
import type { ClaimSummary } from "@/lib/fhir/transforms";
import type { MonthlyClaimGroup } from "@/lib/health-analytics";
import { ClaimDetail } from "./ClaimDetail";

interface ClaimsTimelineProps {
  claimsByMonth: MonthlyClaimGroup[];
}

const INITIAL_MONTHS = 3;
const LOAD_MORE_COUNT = 3;

export function ClaimsTimeline({ claimsByMonth }: ClaimsTimelineProps) {
  const [visibleMonths, setVisibleMonths] = useState(INITIAL_MONTHS);
  const [selectedClaim, setSelectedClaim] = useState<ClaimSummary | null>(null);
  // Most recent month expanded by default
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(
    () => new Set(claimsByMonth.length > 0 ? [claimsByMonth[0].month] : [])
  );

  const toggleMonth = (month: string) => {
    setExpandedMonths((prev) => {
      const next = new Set(prev);
      if (next.has(month)) {
        next.delete(month);
      } else {
        next.add(month);
      }
      return next;
    });
  };

  if (claimsByMonth.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-[var(--text-muted)]">No claims found.</p>
      </div>
    );
  }

  const shownMonths = claimsByMonth.slice(0, visibleMonths);
  const hasMore = visibleMonths < claimsByMonth.length;

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
        Claims
      </h3>

      <div className="space-y-2">
        {shownMonths.map((group) => {
          const isExpanded = expandedMonths.has(group.month);
          const hasDenied = group.claims.some((c) => c.status === "Denied");

          return (
            <div key={group.month}>
              {/* Month header — clickable toggle */}
              <button
                onClick={() => toggleMonth(group.month)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
              >
                <div className="flex items-center gap-2">
                  <svg
                    className={`w-4 h-4 text-[var(--text-muted)] transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {group.month}
                  </span>
                  {hasDenied && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-red-500/15 text-red-500">
                      Denied
                    </span>
                  )}
                </div>
                <span className="text-xs text-[var(--text-muted)]">
                  {group.count} claim{group.count !== 1 ? "s" : ""} &middot; Medicare paid {formatCurrency(group.paid)}
                </span>
              </button>

              {/* Claim rows — collapsible */}
              {isExpanded && (
                <div className="space-y-1.5 mt-1 ml-6">
                  {group.claims.map((claim) => (
                    <ClaimRow
                      key={claim.id}
                      claim={claim}
                      onSelect={() => setSelectedClaim(claim)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {hasMore && (
        <button
          onClick={() => setVisibleMonths((v) => v + LOAD_MORE_COUNT)}
          className="w-full mt-4 py-2.5 text-sm font-medium text-[var(--accent-primary)] hover:bg-[var(--bg-tertiary)] rounded-xl transition-colors"
        >
          Show earlier claims
        </button>
      )}

      {selectedClaim && (
        <ClaimDetail claim={selectedClaim} onClose={() => setSelectedClaim(null)} />
      )}
    </div>
  );
}

function ClaimRow({ claim, onSelect }: { claim: ClaimSummary; onSelect: () => void }) {
  const procedureName = claim.procedures[0] ?? claim.diagnosis[0] ?? "Medical service";
  const isDenied = claim.status === "Denied";
  const isPartial = claim.status === "Partially Paid";

  const borderColor = isDenied
    ? "border-l-red-500"
    : isPartial
      ? "border-l-amber-500"
      : "border-l-green-500";

  const bgClass = isDenied ? "bg-red-500/5" : "bg-[var(--bg-secondary)]";

  return (
    <button
      onClick={onSelect}
      className={`w-full text-left rounded-lg border border-[var(--border)] border-l-[3px] ${borderColor} ${bgClass} px-3 py-2.5 hover:bg-[var(--bg-tertiary)] transition-colors`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)] text-[var(--text-muted)]">
              {claim.type}
            </span>
            {isDenied && (
              <span className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-red-500/15 text-red-500">
                Denied
              </span>
            )}
            <span className="text-sm font-medium text-[var(--text-primary)] truncate">
              {procedureName}
            </span>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-0.5">
            {claim.serviceDate} &middot; {claim.provider}
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          {claim.youOwe !== "$0.00" && (
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              {claim.youOwe}
            </p>
          )}
          <p className="text-xs text-[var(--text-muted)]">
            {claim.medicarePaid}
          </p>
        </div>
      </div>

      {isDenied && (
        <div className="flex items-center justify-between mt-1.5">
          {claim.denialReasons?.[0] && (
            <p className="text-xs text-red-500 truncate flex-1 mr-2">
              {claim.denialReasons[0]}
            </p>
          )}
          <a
            href={`/app/chat?message=${encodeURIComponent(`Help me appeal ${procedureName} denied on ${claim.serviceDate}`)}`}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-medium text-[var(--accent-primary)] hover:underline whitespace-nowrap"
          >
            Get Help
          </a>
        </div>
      )}
    </button>
  );
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

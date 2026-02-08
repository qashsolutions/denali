"use client";

import { useState } from "react";
import type { ClaimSummary } from "@/lib/fhir/transforms";
import { ClaimDetail } from "./ClaimDetail";

interface ClaimsListProps {
  claims: ClaimSummary[];
}

const PAGE_SIZE = 10;

export function ClaimsList({ claims }: ClaimsListProps) {
  const [page, setPage] = useState(0);
  const [selectedClaim, setSelectedClaim] = useState<ClaimSummary | null>(null);

  if (claims.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-sm text-[var(--text-muted)]">No claims found.</p>
      </div>
    );
  }

  const totalPages = Math.ceil(claims.length / PAGE_SIZE);
  const paginated = claims.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Recent Claims
        </h3>
        <span className="text-xs text-[var(--text-muted)]">
          {claims.length} total
        </span>
      </div>

      <div className="space-y-2">
        {paginated.map((claim) => (
          <button
            key={claim.id}
            onClick={() => setSelectedClaim(claim)}
            className="w-full text-left bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] p-4 hover:bg-[var(--bg-tertiary)] transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)]">
                    {claim.type}
                  </span>
                  {claim.status === "Denied" && (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/15 text-red-500">
                      Denied
                    </span>
                  )}
                </div>
                <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                  {claim.procedures[0] ?? claim.diagnosis[0] ?? "Medical service"}
                </p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">
                  {claim.serviceDate} · {claim.provider}
                </p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-sm font-semibold text-[var(--text-primary)]">
                  {claim.medicarePaid}
                </p>
                {claim.youOwe !== "$0.00" && (
                  <p className="text-xs text-[var(--text-secondary)]">
                    You owe {claim.youOwe}
                  </p>
                )}
              </div>
            </div>

            {claim.status === "Denied" && claim.denialReasons && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 bg-red-500/10 rounded-lg px-3 py-1.5">
                  <p className="text-xs text-red-500">
                    {claim.denialReasons[0]}
                  </p>
                </div>
                <a
                  href="/app/chat"
                  onClick={(e) => e.stopPropagation()}
                  className="text-xs font-medium text-[var(--accent-primary)] hover:underline whitespace-nowrap"
                >
                  Get Help
                </a>
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            className="text-xs font-medium text-[var(--text-secondary)] disabled:text-[var(--text-muted)] disabled:cursor-not-allowed px-3 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]"
          >
            Previous
          </button>
          <span className="text-xs text-[var(--text-muted)]">
            {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            className="text-xs font-medium text-[var(--text-secondary)] disabled:text-[var(--text-muted)] disabled:cursor-not-allowed px-3 py-1.5 rounded-lg hover:bg-[var(--bg-tertiary)]"
          >
            Next
          </button>
        </div>
      )}

      {/* Detail modal */}
      {selectedClaim && (
        <ClaimDetail
          claim={selectedClaim}
          onClose={() => setSelectedClaim(null)}
        />
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import type { HealthDashboardMetrics } from "@/lib/health-analytics";
import type { ClaimSummary } from "@/lib/fhir/transforms";
import { ClaimDetail } from "./ClaimDetail";

interface AlertsSectionProps {
  metrics: HealthDashboardMetrics;
}

export function AlertsSection({ metrics }: AlertsSectionProps) {
  const { deniedClaims, highCostClaims, partiallyPaidClaims, alertCount } = metrics;
  const [selectedClaim, setSelectedClaim] = useState<ClaimSummary | null>(null);

  if (alertCount === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider">
          Needs Your Attention
        </h3>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-500/15 text-red-500">
          {alertCount}
        </span>
      </div>

      <div className="space-y-2">
        {/* Denied claims (red) */}
        {deniedClaims
          .filter((d) => d.isAppealable)
          .map((claim) => {
            const procedureName = claim.procedures[0] ?? claim.diagnosis[0] ?? "Medical service";
            const urgencyColor =
              claim.daysUntilDeadline < 30
                ? "text-red-600 dark:text-red-400"
                : claim.daysUntilDeadline < 90
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-green-600 dark:text-green-400";

            return (
              <div
                key={claim.id}
                className="bg-red-500/5 border border-red-500/15 rounded-xl p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                      Denied: {procedureName}
                    </p>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">
                      {claim.serviceDate} &middot; {claim.provider}
                    </p>
                    {claim.denialReasons?.[0] && (
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        {claim.denialReasons[0]}
                      </p>
                    )}
                    <p className={`text-xs font-medium mt-1.5 ${urgencyColor}`}>
                      {claim.daysUntilDeadline} days left to appeal
                    </p>
                  </div>
                  <a
                    href={`/app/chat?message=${encodeURIComponent(`Help me appeal ${procedureName} denied on ${claim.serviceDate}`)}`}
                    className="flex-shrink-0 text-xs font-semibold text-white bg-red-500 hover:bg-red-600 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Get Help
                  </a>
                </div>
              </div>
            );
          })}

        {/* High cost claims (amber) */}
        {highCostClaims.map((claim) => {
          const procedureName = claim.procedures[0] ?? claim.diagnosis[0] ?? "Medical service";
          return (
            <div
              key={claim.id}
              className="bg-amber-500/5 border border-amber-500/15 rounded-xl p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                    High cost: {procedureName}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    You owe {claim.youOwe}
                  </p>
                </div>
                <a
                  href={`/app/chat?message=${encodeURIComponent(`Why do I owe ${claim.youOwe} for ${procedureName}`)}`}
                  className="flex-shrink-0 text-xs font-medium text-[var(--accent-primary)] hover:underline px-2 py-1"
                >
                  Ask Denali
                </a>
              </div>
            </div>
          );
        })}

        {/* Partially paid (amber) */}
        {partiallyPaidClaims.map((claim) => {
          const procedureName = claim.procedures[0] ?? claim.diagnosis[0] ?? "Medical service";
          return (
            <button
              key={claim.id}
              onClick={() => setSelectedClaim(claim)}
              className="w-full text-left bg-amber-500/5 border border-amber-500/15 rounded-xl p-4 hover:bg-amber-500/10 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-600 dark:text-amber-400">
                    Partially paid: {procedureName}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    Medicare paid {claim.medicarePaid} &middot; You owe {claim.youOwe}
                  </p>
                </div>
                <span className="flex-shrink-0 text-xs font-medium text-[var(--text-muted)]">
                  Details &rarr;
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {selectedClaim && (
        <ClaimDetail claim={selectedClaim} onClose={() => setSelectedClaim(null)} />
      )}
    </div>
  );
}

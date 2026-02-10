"use client";

import type { HealthDashboardMetrics } from "@/lib/health-analytics";

interface FinancialSummaryProps {
  metrics: HealthDashboardMetrics;
}

export function FinancialSummary({ metrics }: FinancialSummaryProps) {
  const { totalMedicarePaid, totalYouOwe, claimCount, medicarePaidPercent } = metrics;
  const currentYear = new Date().getFullYear();

  // Color coding for "you owe"
  const youOweColor =
    totalYouOwe >= 1000
      ? "text-red-600 dark:text-red-400"
      : totalYouOwe >= 200
        ? "text-amber-600 dark:text-amber-400"
        : "text-green-600 dark:text-green-400";

  const youPatientPercent = 100 - medicarePaidPercent;

  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] p-5">
      <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-4">
        {currentYear} Year-to-Date
      </p>

      {/* 3-column grid */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="text-center">
          <p className="text-xs text-[var(--text-muted)] mb-1">Medicare Paid</p>
          <p className="text-lg font-bold text-green-600 dark:text-green-400">
            {formatCompact(totalMedicarePaid)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[var(--text-muted)] mb-1">You Paid</p>
          <p className={`text-lg font-bold ${youOweColor}`}>
            {formatCompact(totalYouOwe)}
          </p>
        </div>
        <div className="text-center">
          <p className="text-xs text-[var(--text-muted)] mb-1">Claims</p>
          <p className="text-lg font-bold text-[var(--text-primary)]">{claimCount}</p>
        </div>
      </div>

      {/* Ratio bar */}
      {claimCount > 0 && (
        <div>
          <div className="h-3 rounded-full overflow-hidden bg-[var(--bg-tertiary)] flex">
            <div
              className="bg-green-500 rounded-l-full transition-all"
              style={{ width: `${medicarePaidPercent}%` }}
            />
            <div
              className="bg-amber-500 rounded-r-full transition-all"
              style={{ width: `${youPatientPercent}%` }}
            />
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1.5 text-center">
            {medicarePaidPercent}% Medicare &middot; {youPatientPercent}% You
          </p>
        </div>
      )}
    </div>
  );
}

function formatCompact(amount: number): string {
  if (amount >= 10000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}

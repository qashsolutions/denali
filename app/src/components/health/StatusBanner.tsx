"use client";

import type { HealthDashboardMetrics } from "@/lib/health-analytics";

interface StatusBannerProps {
  metrics: HealthDashboardMetrics;
  onRefresh: () => Promise<void>;
}

export function StatusBanner({ metrics, onRefresh }: StatusBannerProps) {
  const { status, statusMessage } = metrics;

  const config = {
    green: {
      bg: "bg-green-500/5 border-green-500/20",
      icon: <CheckCircleIcon />,
      iconColor: "text-green-600 dark:text-green-400",
      textColor: "text-green-700 dark:text-green-300",
    },
    amber: {
      bg: "bg-amber-500/5 border-amber-500/20",
      icon: <ExclamationIcon />,
      iconColor: "text-amber-600 dark:text-amber-400",
      textColor: "text-amber-700 dark:text-amber-300",
    },
    red: {
      bg: "bg-red-500/5 border-red-500/20",
      icon: <AlertIcon />,
      iconColor: "text-red-600 dark:text-red-400",
      textColor: "text-red-700 dark:text-red-300",
    },
  }[status];

  return (
    <div className={`rounded-2xl border p-4 ${config.bg}`}>
      <div className="flex items-start gap-3">
        <div className={`flex-shrink-0 mt-0.5 ${config.iconColor}`}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-base font-semibold ${config.textColor}`}>
            {statusMessage}
          </p>
          {status === "red" && metrics.deniedClaims.some((d) => d.isAppealable) && (
            <a
              href={`/app/chat?message=${encodeURIComponent("Help me appeal a denied claim")}`}
              className="inline-block mt-2 text-sm font-medium text-[var(--accent-primary)] hover:underline"
            >
              Get Help Appealing &rarr;
            </a>
          )}
        </div>
        <button
          onClick={onRefresh}
          className="flex-shrink-0 text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] px-2 py-1 rounded-lg hover:bg-[var(--bg-tertiary)]"
          aria-label="Refresh health data"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

function ExclamationIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="12" />
      <line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  );
}

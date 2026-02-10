"use client";

import type { ProviderAggregate } from "@/lib/health-analytics";

interface ProviderSummaryProps {
  providers: ProviderAggregate[];
}

export function ProviderSummary({ providers }: ProviderSummaryProps) {
  if (providers.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-3">
        Your Providers
      </h3>
      <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] divide-y divide-[var(--border)]">
        {providers.map((prov, i) => (
          <div key={i} className="px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                {prov.name}
              </p>
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-xs text-[var(--text-muted)]">
                {prov.visits} visit{prov.visits !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-[var(--text-muted)]">
                Last: {prov.lastSeen}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

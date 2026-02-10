"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { HeartPulseIcon } from "@/components/icons";
import { useHealthData } from "@/hooks/useHealthData";
import {
  ConnectMedicare,
  AIDisclaimer,
  StatusBanner,
  FinancialSummary,
  AlertsSection,
  CoverageCards,
  ClaimsTimeline,
  DiagnosisSummaryCard,
  ProviderSummary,
  AccountSection,
} from "@/components/health";

export default function HealthPage() {
  return (
    <Suspense>
      <HealthPageInner />
    </Suspense>
  );
}

function HealthPageInner() {
  const searchParams = useSearchParams();
  const {
    patient,
    coverage,
    metrics,
    isConnected,
    isLoading,
    lastSynced,
    error,
    connect,
    disconnect,
    refresh,
  } = useHealthData();

  // Handle OAuth callback params
  const oauthError = searchParams.get("error");
  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      refresh();
    }
  }, [searchParams, refresh]);

  // OAuth error messages
  const oauthErrorMessage = oauthError ? ({
    denied: "You chose not to connect. You can try again anytime.",
    missing_params: "Something went wrong with the connection. Please try again.",
    invalid_state: "The connection request expired. Please try again.",
    not_authenticated: "Please sign in first, then connect Medicare.",
    token_exchange: "Medicare connection failed. Please try again.",
    save_failed: "Could not save the connection. Please try again.",
    config: "Medicare connection is not configured. Please contact support.",
  } as Record<string, string>)[oauthError] ?? "Something went wrong. Please try again." : null;

  // Loading state
  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <PageHeader />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] p-6 animate-pulse"
            >
              <div className="h-4 bg-[var(--bg-tertiary)] rounded w-1/3 mb-3" />
              <div className="h-3 bg-[var(--bg-tertiary)] rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state (not connected)
  if (error && !isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <PageHeader />
        <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-6 text-center">
          <p className="text-sm text-red-600 dark:text-red-400 mb-3">{error}</p>
          <button
            onClick={() => refresh()}
            className="text-sm font-medium text-[var(--accent-primary)] hover:underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Not connected
  if (!isConnected) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-xl bg-[var(--health-red)]/15 flex items-center justify-center">
            <HeartPulseIcon className="w-5 h-5 text-[var(--health-red)]" />
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">My Health</h1>
        </div>
        {oauthErrorMessage && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 mb-6 text-center">
            <p className="text-sm text-amber-600 dark:text-amber-400">{oauthErrorMessage}</p>
          </div>
        )}
        <ConnectMedicare onConnect={connect} />
      </div>
    );
  }

  // Connected — new health dashboard
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader />

      <div className="space-y-6">
        {/* 0. AI Disclaimer */}
        <AIDisclaimer />

        {/* 1. Status Banner */}
        <StatusBanner metrics={metrics} onRefresh={refresh} />

        {/* 2. Financial Summary */}
        {metrics.claimCount > 0 && <FinancialSummary metrics={metrics} />}

        {/* 3. Issues & Alerts */}
        <AlertsSection metrics={metrics} />

        {/* 4. Coverage */}
        <CoverageCards coverage={coverage} />

        {/* 5. Claims Timeline */}
        <ClaimsTimeline claimsByMonth={metrics.claimsByMonth} />

        {/* 6. Conditions from Claims */}
        <DiagnosisSummaryCard diagnoses={metrics.topDiagnoses} />

        {/* 7. Providers */}
        <ProviderSummary providers={metrics.topProviders} />

        {/* 8. Medicare Account (collapsible) */}
        <AccountSection
          patient={patient}
          lastSynced={lastSynced}
          onRefresh={refresh}
          onDisconnect={disconnect}
        />

        {/* Inline error */}
        {error && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
            <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function PageHeader() {
  return (
    <div className="flex items-center gap-3 mb-6">
      <div className="w-10 h-10 rounded-xl bg-[var(--health-red)]/15 flex items-center justify-center">
        <HeartPulseIcon className="w-5 h-5 text-[var(--health-red)]" />
      </div>
      <h1 className="text-xl font-bold text-[var(--text-primary)]">My Health</h1>
    </div>
  );
}

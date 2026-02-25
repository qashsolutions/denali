"use client";

import { Suspense, useEffect, useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { HeartPulseIcon, DiabetesIcon } from "@/components/icons";
import { useHealthData } from "@/hooks/useHealthData";
import { getSeverityConfig } from "@/components/health/DiagnosisSummaryCard";
import {
  ConnectMedicare,
  AIDisclaimer,
  FinancialSummary,
  AlertsSection,
  HealthAlertsBanner,
  CoverageCards,
  ClaimsTimeline,
  DiagnosisSummaryCard,
  ProviderSummary,
  AccountSection,
} from "@/components/health";
import type { DiagnosisSummary, ScreeningHistory, MedicationSummary } from "@/lib/fhir/transforms";

export default function HealthPage() {
  return (
    <Suspense>
      <HealthPageInner />
    </Suspense>
  );
}

// --- Status dot colors ---
type DotColor = "red" | "amber" | "green";

const DOT_CLASSES: Record<DotColor, string> = {
  red: "bg-red-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
};

// --- Accordion card ---
function HealthHubCard({
  id,
  title,
  status,
  summary,
  isExpanded,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  status: DotColor;
  summary: string;
  isExpanded: boolean;
  onToggle: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <div className="bg-[var(--bg-secondary)] rounded-2xl border border-[var(--border)] overflow-hidden">
      <button
        onClick={() => onToggle(id)}
        className="w-full flex items-center gap-3 p-4 text-left min-h-[56px] hover:bg-[var(--bg-tertiary)]/50 transition-colors"
        aria-expanded={isExpanded}
        aria-controls={`card-${id}`}
      >
        {/* Status dot */}
        <span
          className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT_CLASSES[status]}`}
          aria-label={`Status: ${status}`}
        />
        {/* Title + summary */}
        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-[var(--text-primary)]">
            {title}
          </span>
          <span className="text-xs text-[var(--text-secondary)] ml-2">
            {summary}
          </span>
        </div>
        {/* Chevron */}
        <svg
          className={`w-4 h-4 shrink-0 text-[var(--text-tertiary)] transition-transform duration-200 ${
            isExpanded ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div
          id={`card-${id}`}
          className="border-t border-[var(--border)] p-4 space-y-4"
        >
          {children}
        </div>
      )}
    </div>
  );
}

// --- Diabetes care expanded content ---
function DiabetesCareExpanded({
  screenings,
  medications,
}: {
  screenings: ScreeningHistory[];
  medications: MedicationSummary[];
}) {
  const overdueScreenings = screenings.filter((s) => s.isOverdue);
  const overdueMeds = medications.filter(
    (m) => m.isDiabetesMed && m.gapDays != null && m.gapDays >= 14
  );

  return (
    <div className="space-y-3">
      {overdueScreenings.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1.5">
            Overdue Screenings
          </p>
          <ul className="space-y-1">
            {overdueScreenings.map((s) => (
              <li
                key={s.screeningType}
                className="text-sm text-[var(--text-primary)] flex items-center gap-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                {s.displayName}
                <span className="text-xs text-[var(--text-tertiary)]">
                  {s.monthsSinceLast}mo ago
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {overdueMeds.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wide mb-1.5">
            Medication Refill Gaps
          </p>
          <ul className="space-y-1">
            {overdueMeds.map((m) => (
              <li
                key={m.name}
                className="text-sm text-[var(--text-primary)] flex items-center gap-2"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                {m.name}
                <span className="text-xs text-[var(--text-tertiary)]">
                  {m.gapDays}d overdue
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {overdueScreenings.length === 0 && overdueMeds.length === 0 && (
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          All diabetes screenings and medications are up to date.
        </p>
      )}

      <Link
        href="/app/diabetes"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-violet-500 hover:underline mt-1"
      >
        <DiabetesIcon className="w-3.5 h-3.5" />
        Open Diabetes Dashboard &rarr;
      </Link>
    </div>
  );
}

// --- Time ago utility ---
function formatTimeAgo(date: Date | string | null): string {
  if (!date) return "Unknown";
  const ms = Date.now() - new Date(date).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// --- Status computation ---
interface CardStatus {
  dot: DotColor;
  summary: string;
  visible: boolean;
}

function computeCardStatuses(
  metrics: ReturnType<typeof useHealthData>["metrics"],
  coverage: ReturnType<typeof useHealthData>["coverage"],
  conditions: DiagnosisSummary[],
  screenings: ScreeningHistory[],
  medications: MedicationSummary[],
  hospitalizations: ReturnType<typeof useHealthData>["hospitalizations"],
  providers: ReturnType<typeof useHealthData>["providers"],
  lastSynced: Date | string | null
): Record<string, CardStatus> {
  // --- Needs Attention ---
  const deniedCount = metrics.deniedClaims.length;
  const recentDischarges = hospitalizations.filter((h) => h.needsFollowUp);
  const overdueScreenings = screenings.filter((s) => s.isOverdue);
  const overdueMeds = medications.filter(
    (m) => m.isDiabetesMed && m.gapDays != null && m.gapDays >= 14
  );

  const attentionParts: string[] = [];
  if (deniedCount > 0)
    attentionParts.push(`${deniedCount} denied claim${deniedCount !== 1 ? "s" : ""}`);
  if (recentDischarges.length > 0)
    attentionParts.push(`${recentDischarges.length} recent discharge${recentDischarges.length !== 1 ? "s" : ""}`);
  if (overdueScreenings.length > 0)
    attentionParts.push(`${overdueScreenings.length} screening${overdueScreenings.length !== 1 ? "s" : ""} overdue`);
  if (overdueMeds.length > 0)
    attentionParts.push(`${overdueMeds.length} med refill${overdueMeds.length !== 1 ? "s" : ""} overdue`);

  const hasAttention = attentionParts.length > 0;
  const attentionDot: DotColor =
    deniedCount > 0 || recentDischarges.length > 0 ? "red" : "amber";

  // --- Coverage ---
  const activeCoverage = coverage.filter((c) => c.status === "Active");
  const coverageDot: DotColor =
    coverage.length === 0
      ? "red"
      : activeCoverage.length === coverage.length
      ? "green"
      : "amber";
  const coverageParts = activeCoverage.map((c) => c.type.replace("Medicare ", ""));
  const coverageSummary =
    coverageParts.length > 0
      ? coverageParts.join(" & ") + " active"
      : "No active coverage";

  // --- Diabetes ---
  const hasDiabetes = conditions.some(
    (c) =>
      c.category === "type1" ||
      c.category === "type2" ||
      c.category === "pre-diabetic" ||
      c.category === "other-diabetes"
  );
  const diabetesScreenings = screenings.filter(
    (s) => s.screeningType === "a1c" || s.screeningType === "eye-exam" || s.screeningType === "kidney"
  );
  const diabetesOverdueScreenings = diabetesScreenings.filter((s) => s.isOverdue);
  const diabetesOverdueMeds = medications.filter(
    (m) => m.isDiabetesMed && m.gapDays != null && m.gapDays >= 14
  );

  let diabetesDot: DotColor = "green";
  let diabetesSummary = "All up to date";
  if (diabetesOverdueMeds.length > 0) {
    diabetesDot = "red";
    diabetesSummary = `${diabetesOverdueMeds.length} med refill${diabetesOverdueMeds.length !== 1 ? "s" : ""} overdue`;
  } else if (diabetesOverdueScreenings.length > 0) {
    diabetesDot = "amber";
    diabetesSummary = `${diabetesOverdueScreenings.length} screening${diabetesOverdueScreenings.length !== 1 ? "s" : ""} overdue`;
  }

  // --- Conditions ---
  const hasConditions = metrics.topDiagnoses.length > 0;
  let conditionsRedCount = 0;
  let conditionsAmberCount = 0;
  for (const dx of metrics.topDiagnoses) {
    const sev = getSeverityConfig(dx.name, conditions);
    if (sev.level === "red") conditionsRedCount++;
    else if (sev.level === "amber") conditionsAmberCount++;
  }
  let conditionsDot: DotColor = "green";
  if (conditionsRedCount > 0) conditionsDot = "red";
  else if (conditionsAmberCount > 0) conditionsDot = "amber";
  const conditionsSummary = `${metrics.topDiagnoses.length} condition${metrics.topDiagnoses.length !== 1 ? "s" : ""} from claims`;

  // --- Claims & Providers ---
  let claimsDot: DotColor = "green";
  if (metrics.deniedClaims.length > 0) claimsDot = "red";
  else if (metrics.highCostClaims.length > 0) claimsDot = "amber";
  const claimsSummary = `${metrics.claimCount} claim${metrics.claimCount !== 1 ? "s" : ""} \u00B7 ${providers.length} provider${providers.length !== 1 ? "s" : ""}`;

  // --- Account ---
  const syncAge = lastSynced
    ? Date.now() - new Date(lastSynced).getTime()
    : Infinity;
  const accountDot: DotColor = syncAge < 24 * 60 * 60 * 1000 ? "green" : "amber";
  const accountSummary = lastSynced
    ? `Synced ${formatTimeAgo(lastSynced)}`
    : "Not synced";

  return {
    "needs-attention": {
      dot: attentionDot,
      summary: attentionParts.join(", ") || "",
      visible: hasAttention,
    },
    coverage: { dot: coverageDot, summary: coverageSummary, visible: true },
    diabetes: { dot: diabetesDot, summary: diabetesSummary, visible: hasDiabetes },
    conditions: {
      dot: conditionsDot,
      summary: conditionsSummary,
      visible: hasConditions,
    },
    "claims-providers": { dot: claimsDot, summary: claimsSummary, visible: true },
    account: { dot: accountDot, summary: accountSummary, visible: true },
  };
}

// --- Main page ---
function HealthPageInner() {
  const searchParams = useSearchParams();
  const {
    patient,
    coverage,
    conditions,
    medications,
    screenings,
    providers,
    hospitalizations,
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

  // Status computation for all cards
  const cardStatuses = useMemo(
    () =>
      computeCardStatuses(
        metrics,
        coverage,
        conditions,
        screenings,
        medications,
        hospitalizations,
        providers,
        lastSynced
      ),
    [metrics, coverage, conditions, screenings, medications, hospitalizations, providers, lastSynced]
  );

  // Expand state — "needs-attention" auto-expanded when visible
  const [expandedCards, setExpandedCards] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    // Will be corrected once cardStatuses is computed — see effect below
    return initial;
  });

  // Auto-expand "needs-attention" when it first appears
  useEffect(() => {
    if (cardStatuses["needs-attention"].visible) {
      setExpandedCards((prev) => {
        if (prev.has("needs-attention")) return prev;
        const next = new Set(prev);
        next.add("needs-attention");
        return next;
      });
    }
  }, [cardStatuses]);

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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

  // Connected — accordion hub
  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader />

      <div className="space-y-3">
        <AIDisclaimer />

        {/* 1. Needs Attention */}
        {cardStatuses["needs-attention"].visible && (
          <HealthHubCard
            id="needs-attention"
            title="Needs Attention"
            status={cardStatuses["needs-attention"].dot}
            summary={cardStatuses["needs-attention"].summary}
            isExpanded={expandedCards.has("needs-attention")}
            onToggle={toggleCard}
          >
            <HealthAlertsBanner
              screenings={screenings}
              medications={medications}
              conditions={conditions}
              providers={providers}
              hospitalizations={hospitalizations}
            />
            <AlertsSection metrics={metrics} />
          </HealthHubCard>
        )}

        {/* 2. Coverage Status */}
        <HealthHubCard
          id="coverage"
          title="Coverage Status"
          status={cardStatuses.coverage.dot}
          summary={cardStatuses.coverage.summary}
          isExpanded={expandedCards.has("coverage")}
          onToggle={toggleCard}
        >
          <CoverageCards coverage={coverage} />
        </HealthHubCard>

        {/* 3. Diabetes Care */}
        {cardStatuses.diabetes.visible && (
          <HealthHubCard
            id="diabetes"
            title="Diabetes Care"
            status={cardStatuses.diabetes.dot}
            summary={cardStatuses.diabetes.summary}
            isExpanded={expandedCards.has("diabetes")}
            onToggle={toggleCard}
          >
            <DiabetesCareExpanded
              screenings={screenings.filter(
                (s) =>
                  s.screeningType === "a1c" ||
                  s.screeningType === "eye-exam" ||
                  s.screeningType === "kidney"
              )}
              medications={medications.filter((m) => m.isDiabetesMed)}
            />
          </HealthHubCard>
        )}

        {/* 4. Health Conditions */}
        {cardStatuses.conditions.visible && (
          <HealthHubCard
            id="conditions"
            title="Health Conditions"
            status={cardStatuses.conditions.dot}
            summary={cardStatuses.conditions.summary}
            isExpanded={expandedCards.has("conditions")}
            onToggle={toggleCard}
          >
            <DiagnosisSummaryCard diagnoses={metrics.topDiagnoses} conditions={conditions} />
          </HealthHubCard>
        )}

        {/* 5. Claims & Providers */}
        <HealthHubCard
          id="claims-providers"
          title="Claims & Providers"
          status={cardStatuses["claims-providers"].dot}
          summary={cardStatuses["claims-providers"].summary}
          isExpanded={expandedCards.has("claims-providers")}
          onToggle={toggleCard}
        >
          {metrics.claimCount > 0 && <FinancialSummary metrics={metrics} />}
          <ClaimsTimeline claimsByMonth={metrics.claimsByMonth} />
          <ProviderSummary providers={metrics.topProviders} providerDetails={providers} />
        </HealthHubCard>

        {/* 6. Medicare Account */}
        <HealthHubCard
          id="account"
          title="Medicare Account"
          status={cardStatuses.account.dot}
          summary={cardStatuses.account.summary}
          isExpanded={expandedCards.has("account")}
          onToggle={toggleCard}
        >
          <AccountSection
            patient={patient}
            lastSynced={lastSynced}
            onRefresh={refresh}
            onDisconnect={disconnect}
          />
        </HealthHubCard>

        {/* Inline error */}
        {error && (
          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
            <p className="text-xs text-amber-600 dark:text-amber-400">{error}</p>
          </div>
        )}
      </div>

      <p className="text-xs text-[var(--text-muted)] text-center mt-6 px-4">
        This product uses the Blue Button APIs but is not endorsed or certified by the Centers for Medicare &amp; Medicaid Services or the U.S. Department of Health and Human Services.
      </p>
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

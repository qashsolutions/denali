/**
 * Health Dashboard Analytics
 *
 * Pure computation module. Takes ClaimSummary[] + CoverageSummary[],
 * returns dashboard metrics for the health page redesign.
 *
 * No side effects, no API calls — just math and aggregation.
 */

import type { ClaimSummary, CoverageSummary } from "@/lib/fhir/transforms";
import { MEDICARE_CONSTANTS } from "@/config/ui";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DeniedClaimAlert extends ClaimSummary {
  daysUntilDeadline: number;
  isAppealable: boolean;
}

export interface MonthlyClaimGroup {
  month: string; // "January 2026"
  claims: ClaimSummary[];
  count: number;
  paid: number;
  owed: number;
}

export interface DiagnosisAggregate {
  name: string;
  count: number;
  lastSeen: string;
}

export interface ProviderAggregate {
  name: string;
  visits: number;
  lastSeen: string;
}

export interface HealthDashboardMetrics {
  // Financial (current year)
  totalCharged: number;
  totalMedicarePaid: number;
  totalYouOwe: number;
  claimCount: number;
  medicarePaidPercent: number;

  // Alerts
  deniedClaims: DeniedClaimAlert[];
  highCostClaims: ClaimSummary[];
  partiallyPaidClaims: ClaimSummary[];
  alertCount: number;

  // Aggregations
  claimsByMonth: MonthlyClaimGroup[];
  topDiagnoses: DiagnosisAggregate[];
  topProviders: ProviderAggregate[];

  // Overall status
  status: "green" | "amber" | "red";
  statusMessage: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const APPEAL_DEADLINE_DAYS = MEDICARE_CONSTANTS.APPEAL_DEADLINE_DAYS;
const HIGH_COST_THRESHOLD = 200;
const HIGH_ANNUAL_OWE_THRESHOLD = 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Main computation
// ─────────────────────────────────────────────────────────────────────────────

export function computeDashboardMetrics(
  claims: ClaimSummary[],
  coverage: CoverageSummary[]
): HealthDashboardMetrics {
  const currentYear = new Date().getFullYear();

  // Filter to current year claims for financial summary
  const currentYearClaims = claims.filter((c) => {
    const year = parseServiceYear(c.serviceDate);
    return year === currentYear;
  });

  // Financial totals
  const totalCharged = sumCurrency(currentYearClaims, "totalCharged");
  const totalMedicarePaid = sumCurrency(currentYearClaims, "medicarePaid");
  const totalYouOwe = sumCurrency(currentYearClaims, "youOwe");
  const total = totalMedicarePaid + totalYouOwe;
  const medicarePaidPercent = total > 0 ? Math.round((totalMedicarePaid / total) * 100) : 100;

  // Denied claims with deadline tracking
  const deniedClaims = claims
    .filter((c) => c.status === "Denied")
    .map((c) => {
      const daysUntilDeadline = computeDaysUntilDeadline(c.serviceDate);
      return {
        ...c,
        daysUntilDeadline,
        isAppealable: daysUntilDeadline > 0,
      };
    })
    .sort((a, b) => a.daysUntilDeadline - b.daysUntilDeadline); // Most urgent first

  // High cost claims (you owe > $200)
  const highCostClaims = currentYearClaims.filter(
    (c) => parseCurrency(c.youOwe) > HIGH_COST_THRESHOLD
  );

  // Partially paid
  const partiallyPaidClaims = currentYearClaims.filter(
    (c) => c.status === "Partially Paid"
  );

  const alertCount =
    deniedClaims.filter((d) => d.isAppealable).length +
    highCostClaims.length +
    partiallyPaidClaims.length;

  // Month groups (all claims, not just current year)
  const claimsByMonth = groupClaimsByMonth(claims);

  // Diagnosis aggregation
  const topDiagnoses = aggregateDiagnoses(claims);

  // Provider aggregation
  const topProviders = aggregateProviders(claims);

  // Overall status
  const { status, statusMessage } = computeStatus(
    deniedClaims,
    highCostClaims,
    partiallyPaidClaims,
    totalYouOwe
  );

  return {
    totalCharged,
    totalMedicarePaid,
    totalYouOwe,
    claimCount: currentYearClaims.length,
    medicarePaidPercent,
    deniedClaims,
    highCostClaims,
    partiallyPaidClaims,
    alertCount,
    claimsByMonth,
    topDiagnoses,
    topProviders,
    status,
    statusMessage,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function parseCurrency(formatted: string): number {
  return parseFloat(formatted.replace(/[^0-9.-]/g, "")) || 0;
}

function sumCurrency(
  claims: ClaimSummary[],
  field: "totalCharged" | "medicarePaid" | "youOwe"
): number {
  return claims.reduce((sum, c) => sum + parseCurrency(c[field]), 0);
}

function parseServiceYear(dateStr: string): number {
  // dateStr format: "January 15, 2026" (from formatDate in transforms.ts)
  const match = dateStr.match(/\d{4}/);
  return match ? parseInt(match[0], 10) : 0;
}

function parseServiceDate(dateStr: string): Date {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? new Date(0) : d;
}

function computeDaysUntilDeadline(serviceDate: string): number {
  const date = parseServiceDate(serviceDate);
  const deadline = new Date(date);
  deadline.setDate(deadline.getDate() + APPEAL_DEADLINE_DAYS);
  const now = new Date();
  return Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function groupClaimsByMonth(claims: ClaimSummary[]): MonthlyClaimGroup[] {
  const groups = new Map<string, ClaimSummary[]>();

  // Sort claims by date descending
  const sorted = [...claims].sort(
    (a, b) => parseServiceDate(b.serviceDate).getTime() - parseServiceDate(a.serviceDate).getTime()
  );

  for (const claim of sorted) {
    const date = parseServiceDate(claim.serviceDate);
    const key = `${date.toLocaleString("en-US", { month: "long" })} ${date.getFullYear()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(claim);
  }

  return Array.from(groups.entries()).map(([month, monthClaims]) => ({
    month,
    claims: monthClaims,
    count: monthClaims.length,
    paid: sumCurrency(monthClaims, "medicarePaid"),
    owed: sumCurrency(monthClaims, "youOwe"),
  }));
}

function aggregateDiagnoses(claims: ClaimSummary[]): DiagnosisAggregate[] {
  const map = new Map<string, { count: number; lastSeen: Date }>();

  for (const claim of claims) {
    const claimDate = parseServiceDate(claim.serviceDate);
    for (const dx of claim.diagnosis) {
      const lower = dx.toLowerCase();
      const existing = map.get(lower);
      if (existing) {
        existing.count++;
        if (claimDate > existing.lastSeen) existing.lastSeen = claimDate;
      } else {
        map.set(lower, { count: 1, lastSeen: claimDate });
      }
    }
  }

  return Array.from(map.entries())
    .map(([name, { count, lastSeen }]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      count,
      lastSeen: lastSeen.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}

function aggregateProviders(claims: ClaimSummary[]): ProviderAggregate[] {
  const map = new Map<string, { visits: number; lastSeen: Date }>();

  for (const claim of claims) {
    if (claim.provider === "Unknown provider") continue;
    const claimDate = parseServiceDate(claim.serviceDate);
    const existing = map.get(claim.provider);
    if (existing) {
      existing.visits++;
      if (claimDate > existing.lastSeen) existing.lastSeen = claimDate;
    } else {
      map.set(claim.provider, { visits: 1, lastSeen: claimDate });
    }
  }

  return Array.from(map.entries())
    .map(([name, { visits, lastSeen }]) => ({
      name,
      visits,
      lastSeen: lastSeen.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    }))
    .sort((a, b) => b.visits - a.visits);
}

function computeStatus(
  deniedClaims: DeniedClaimAlert[],
  highCostClaims: ClaimSummary[],
  partiallyPaidClaims: ClaimSummary[],
  totalYouOwe: number
): { status: "green" | "amber" | "red"; statusMessage: string } {
  // Red: any denied claim within appeal window
  const appealable = deniedClaims.filter((d) => d.isAppealable);
  if (appealable.length > 0) {
    const count = appealable.length;
    return {
      status: "red",
      statusMessage:
        count === 1
          ? "1 claim was denied — you can appeal"
          : `${count} claims were denied — you can appeal`,
    };
  }

  // Amber: partially paid, high cost, or high annual owed
  if (highCostClaims.length > 0) {
    return {
      status: "amber",
      statusMessage:
        highCostClaims.length === 1
          ? "1 claim has high costs"
          : `${highCostClaims.length} claims have high costs`,
    };
  }
  if (partiallyPaidClaims.length > 0) {
    return {
      status: "amber",
      statusMessage:
        partiallyPaidClaims.length === 1
          ? "1 claim was partially paid"
          : `${partiallyPaidClaims.length} claims were partially paid`,
    };
  }
  if (totalYouOwe >= HIGH_ANNUAL_OWE_THRESHOLD) {
    return {
      status: "amber",
      statusMessage: `You owe $${Math.round(totalYouOwe).toLocaleString()} this year`,
    };
  }

  // Green
  return {
    status: "green",
    statusMessage: "All claims are paid. No action needed.",
  };
}

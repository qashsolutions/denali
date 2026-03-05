/**
 * Dashboard personalization context.
 *
 * All data consumed by the authenticated home page is shaped here.
 * `buildDashboardContext()` constructs context from real hook data
 * (useAuth + useHealthData). No mock data in production rendering.
 */

import type { AuthState } from "@/hooks/useAuth";
import type {
  DiagnosisSummary,
  MedicationSummary,
  ScreeningHistory,
  CoverageSummary,
  ClaimSummary,
} from "@/lib/fhir/transforms";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardUser {
  firstName: string;
  lastLogin: string; // ISO 8601
  hasCompletedWalkthrough: boolean;
  plan: "trial" | "starter" | "plus" | "unlimited";
}

export interface DashboardCoverage {
  hasRecentResult: boolean;
  resultStatus: "approved" | "pending" | "denied" | null;
  procedureName: string | null; // e.g. "knee replacement"
}

export interface DashboardMedicare {
  blueButtonConnected: boolean;
  unreviewedClaimsCount: number;
  lastSyncDate: string | null; // ISO 8601
}

export interface DashboardDiabetes {
  latestA1C: number | null; // e.g. 6.5
  nextScreeningDate: string | null; // ISO 8601
  hasMedReminders: boolean;
  daysUntilScreening: number | null;
  hasContext: boolean; // whether diabetes context exists at all
}

export interface DashboardObesity {
  classification: "obese" | "at-risk" | "none";
  hasActiveMedication: boolean;
  medicationName: string | null;
  hasOverdueScreening: boolean;
}

export interface DashboardAppeals {
  activeAppealsCount: number;
  nearestDeadline: string | null; // ISO 8601
  pendingActions: number;
  daysUntilDeadline: number | null;
}

export interface DashboardContext {
  user: DashboardUser;
  coverage: DashboardCoverage;
  dashboard: DashboardMedicare;
  diabetes: DashboardDiabetes;
  obesity: DashboardObesity;
  appeals: DashboardAppeals;
}

// ---------------------------------------------------------------------------
// Time-of-day helpers
// ---------------------------------------------------------------------------

export type TimeOfDay = "morning" | "afternoon" | "evening";

export function getTimeOfDay(): TimeOfDay {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  return "evening";
}

export function getPersonalizedGreeting(firstName: string): string {
  const tod = getTimeOfDay();
  if (tod === "morning") return `Good morning, ${firstName}`;
  if (tod === "afternoon") return `Good afternoon, ${firstName}`;
  return `Good evening, ${firstName}`;
}

// ---------------------------------------------------------------------------
// Build context from real data (useAuth + useHealthData)
// ---------------------------------------------------------------------------

interface BuildContextInput {
  authState: AuthState;
  isConnected: boolean;
  lastSynced: Date | null;
  conditions: DiagnosisSummary[];
  medications: MedicationSummary[];
  screenings: ScreeningHistory[];
  coverage: CoverageSummary[];
  claims: ClaimSummary[];
}

export function buildDashboardContext(input: BuildContextInput): DashboardContext {
  const {
    authState,
    isConnected,
    lastSynced,
    conditions,
    medications,
    screenings,
    claims,
  } = input;

  // Extract first name from email (before @) — best effort without full name
  const email = authState.email ?? "";
  const firstName = email.split("@")[0] || "there";

  // Diabetes context
  const hasDiabetesCondition = conditions.some(
    (c) => c.category === "type1" || c.category === "type2" || c.category === "other-diabetes" || c.category === "pre-diabetic"
  );
  const hasDiabetesMed = medications.some((m) => m.isDiabetesMed);
  const hasDiabetesContext = hasDiabetesCondition || hasDiabetesMed;

  const a1cScreening = screenings.find((s) => s.screeningType === "a1c");
  let daysUntilA1C: number | null = null;
  let nextA1CDate: string | null = null;
  if (a1cScreening?.lastDate) {
    // A1C due every 3 months for diabetics, 6 months for pre-diabetic
    const intervalMonths = hasDiabetesCondition ? 3 : 6;
    const lastDate = new Date(a1cScreening.lastDate);
    const nextDue = new Date(lastDate);
    nextDue.setMonth(nextDue.getMonth() + intervalMonths);
    daysUntilA1C = Math.ceil((nextDue.getTime() - Date.now()) / 86400000);
    nextA1CDate = nextDue.toISOString();
  }

  // Obesity context
  const obesityDx = conditions.find((c) => c.category === "obesity");
  const activeObesityMed = medications.find((m) => m.isObesityMed && m.status === "Active");
  const obesityClassification: "obese" | "at-risk" | "none" = obesityDx || activeObesityMed
    ? "obese"
    : conditions.find((c) => c.category === "pre-diabetic")
      ? "at-risk"
      : "none";

  const obesityScreenings = screenings.filter((s) => s.screeningType === "obesity-counseling");
  const hasOverdueObesityScreening = obesityScreenings.some((s) => s.isOverdue);

  // Claims — count recent (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const recentClaims = claims.filter((c) => {
    const d = new Date(c.serviceDate);
    return d >= thirtyDaysAgo;
  });

  // Denied claims
  const deniedClaims = claims.filter((c) => c.status === "denied");

  return {
    user: {
      firstName,
      lastLogin: new Date().toISOString(),
      hasCompletedWalkthrough: false, // TODO: read from user profile API
      plan: authState.plan,
    },
    coverage: {
      hasRecentResult: false, // Coverage check results live in chat, not dashboard data
      resultStatus: null,
      procedureName: null,
    },
    dashboard: {
      blueButtonConnected: isConnected,
      unreviewedClaimsCount: recentClaims.length,
      lastSyncDate: lastSynced?.toISOString() ?? null,
    },
    diabetes: {
      latestA1C: null, // Blue Button doesn't provide actual lab values
      nextScreeningDate: nextA1CDate,
      hasMedReminders: hasDiabetesMed,
      daysUntilScreening: daysUntilA1C,
      hasContext: hasDiabetesContext,
    },
    obesity: {
      classification: obesityClassification,
      hasActiveMedication: !!activeObesityMed,
      medicationName: activeObesityMed?.name ?? null,
      hasOverdueScreening: hasOverdueObesityScreening,
    },
    appeals: {
      activeAppealsCount: deniedClaims.length,
      nearestDeadline: null, // Would need appeal tracking data
      pendingActions: deniedClaims.length,
      daysUntilDeadline: null,
    },
  };
}

// ---------------------------------------------------------------------------
// Status summary builder  (Enhancement 1)
// ---------------------------------------------------------------------------

export function buildStatusSummary(ctx: DashboardContext): string {
  const parts: string[] = [];

  // Coverage result ready
  if (ctx.coverage.hasRecentResult && ctx.coverage.procedureName) {
    parts.push(
      `Your coverage check for ${ctx.coverage.procedureName} is ready`
    );
  }

  // Claims
  if (ctx.dashboard.unreviewedClaimsCount > 0) {
    const n = ctx.dashboard.unreviewedClaimsCount;
    parts.push(`${n} new claim${n === 1 ? "" : "s"} processed`);
  }

  // Blue Button not connected
  if (!ctx.dashboard.blueButtonConnected) {
    parts.push("Connect Medicare to see your claims");
  }

  // Diabetes screening
  if (
    ctx.diabetes.nextScreeningDate &&
    ctx.diabetes.daysUntilScreening !== null &&
    ctx.diabetes.daysUntilScreening <= 30
  ) {
    const d = new Date(ctx.diabetes.nextScreeningDate);
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    parts.push(`A1C screening due ${label}`);
  }

  // Appeals
  if (ctx.appeals.pendingActions > 0) {
    parts.push(
      `${ctx.appeals.pendingActions} denied claim${ctx.appeals.pendingActions === 1 ? "" : "s"} to review`
    );
  }

  return parts.length > 0 ? parts.join(" \u00B7 ") : "";
}

// ---------------------------------------------------------------------------
// Nudge strip logic  (Enhancement 3)
// ---------------------------------------------------------------------------

export interface Nudge {
  message: string;
  cta: string;
  href: string;
  priority: number; // lower = higher priority
}

export function selectNudge(ctx: DashboardContext): Nudge | null {
  const candidates: Nudge[] = [];

  // P1 — Health action needed
  if (
    ctx.diabetes.daysUntilScreening !== null &&
    ctx.diabetes.daysUntilScreening <= 30 &&
    ctx.diabetes.daysUntilScreening > 0
  ) {
    candidates.push({
      message: `Your next A1C screening is due in ${ctx.diabetes.daysUntilScreening} days \u2014 staying on schedule matters.`,
      cta: "View Schedule",
      href: "/app/health",
      priority: 1,
    });
  }

  // P1 — Appeal deadline
  if (
    ctx.appeals.pendingActions > 0 &&
    ctx.appeals.daysUntilDeadline !== null &&
    ctx.appeals.daysUntilDeadline <= 14
  ) {
    candidates.push({
      message: `You have an appeal deadline in ${ctx.appeals.daysUntilDeadline} days \u2014 don\u2019t miss your window.`,
      cta: "Review Appeal",
      href: "/app/chat?topic=appeal",
      priority: 0,
    });
  }

  // P2 — New claims
  if (ctx.dashboard.unreviewedClaimsCount > 0) {
    const n = ctx.dashboard.unreviewedClaimsCount;
    candidates.push({
      message: `You have ${n} new claim${n === 1 ? "" : "s"} to review in your Medicare Dashboard.`,
      cta: "Review Claims",
      href: "/app/health",
      priority: 2,
    });
  }

  // P2.5 — Obesity management nudge
  if (ctx.obesity.classification === "obese" && ctx.obesity.hasOverdueScreening) {
    candidates.push({
      message: "Your obesity counseling visit may be overdue \u2014 Medicare covers this at no cost.",
      cta: "Learn More",
      href: "/app/chat?topic=obesity",
      priority: 2,
    });
  }

  // P3 — Feature discovery
  if (!ctx.dashboard.blueButtonConnected) {
    candidates.push({
      message:
        "Connect your Medicare account to see your claims, medications, and screening schedule.",
      cta: "Connect Now",
      href: "/app/health",
      priority: 3,
    });
  }

  // P5 — General tip
  candidates.push({
    message:
      "Did you know? Denali can auto-generate appeal letters with the right Medicare codes.",
    cta: "Learn More",
    href: "/app/chat",
    priority: 5,
  });

  candidates.sort((a, b) => a.priority - b.priority);
  return candidates[0] ?? null;
}

// ---------------------------------------------------------------------------
// Badge logic  (Enhancement 2)
// ---------------------------------------------------------------------------

export interface Badge {
  label: string;
  color: string; // hex
  variant: "solid" | "outline";
}

export function getCoverageBadge(c: DashboardCoverage): Badge | null {
  if (c.hasRecentResult) {
    return { label: "Result Ready", color: "#2ECC71", variant: "solid" };
  }
  return null;
}

export function getDashboardBadge(d: DashboardMedicare): Badge | null {
  if (d.unreviewedClaimsCount > 0) {
    return {
      label: `${d.unreviewedClaimsCount} New Claims`,
      color: "#E74C5A",
      variant: "solid",
    };
  }
  if (d.lastSyncDate) {
    return { label: "Updated", color: "#2ECC71", variant: "solid" };
  }
  if (!d.blueButtonConnected) {
    return { label: "Connect Medicare", color: "#3B82F6", variant: "outline" };
  }
  return null;
}

export function getDiabetesBadge(d: DashboardDiabetes): Badge | null {
  if (!d.hasContext) return null;

  if (
    d.daysUntilScreening !== null &&
    d.daysUntilScreening > 0 &&
    d.daysUntilScreening <= 30
  ) {
    return {
      label: `A1C Due in ${d.daysUntilScreening}d`,
      color: "#3B82F6",
      variant: "solid",
    };
  }
  if (d.hasMedReminders) {
    return { label: "Active", color: "#2ECC71", variant: "solid" };
  }
  return {
    label: "Start Tracking",
    color: "#3B82F6",
    variant: "outline",
  };
}

export function getObesityBadge(o: DashboardObesity): Badge | null {
  if (o.classification === "none") return null;

  if (o.hasOverdueScreening) {
    return { label: "Screening Due", color: "#E74C5A", variant: "solid" };
  }
  if (o.hasActiveMedication) {
    return { label: "Active", color: "#2ECC71", variant: "solid" };
  }
  if (o.classification === "obese") {
    return { label: "Review Benefits", color: "#F59E0B", variant: "outline" };
  }
  if (o.classification === "at-risk") {
    return { label: "At Risk", color: "#F59E0B", variant: "outline" };
  }
  return null;
}

export function getAppealsBadge(a: DashboardAppeals): Badge | null {
  if (a.pendingActions > 0) {
    return { label: "Action Needed", color: "#E74C5A", variant: "solid" };
  }
  if (a.nearestDeadline && a.daysUntilDeadline !== null) {
    const d = new Date(a.nearestDeadline);
    const label = d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
    return { label: `Deadline: ${label}`, color: "#E74C5A", variant: "solid" };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Mock data (ONLY for unit tests and Storybook — never production rendering)
// ---------------------------------------------------------------------------

export function getMockDashboardContext(
  overrides?: Partial<DashboardContext>
): DashboardContext {
  const now = new Date();
  const screeningDate = new Date(now);
  screeningDate.setDate(screeningDate.getDate() + 12);

  return {
    user: {
      firstName: "TestUser",
      lastLogin: new Date(now.getTime() - 86400000).toISOString(),
      hasCompletedWalkthrough: false,
      plan: "trial",
    },
    coverage: {
      hasRecentResult: true,
      resultStatus: "approved",
      procedureName: "knee replacement",
    },
    dashboard: {
      blueButtonConnected: true,
      unreviewedClaimsCount: 3,
      lastSyncDate: new Date(now.getTime() - 3600000).toISOString(),
    },
    diabetes: {
      latestA1C: 6.5,
      nextScreeningDate: screeningDate.toISOString(),
      hasMedReminders: true,
      daysUntilScreening: 12,
      hasContext: true,
    },
    obesity: {
      classification: "none",
      hasActiveMedication: false,
      medicationName: null,
      hasOverdueScreening: false,
    },
    appeals: {
      activeAppealsCount: 1,
      nearestDeadline: new Date(
        now.getTime() + 6 * 86400000
      ).toISOString(),
      pendingActions: 1,
      daysUntilDeadline: 6,
    },
    ...overrides,
  };
}

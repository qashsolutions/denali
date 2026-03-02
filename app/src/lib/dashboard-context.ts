/**
 * Dashboard personalization context.
 *
 * All data consumed by the authenticated home page is shaped here.
 * In the prototype/demo phase the mock factory produces realistic
 * values; swap to real API data later by populating from
 * useAuth + useHealthData + useConversationHistory.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DashboardUser {
  firstName: string;
  lastLogin: string; // ISO 8601
  hasCompletedWalkthrough: boolean;
  plan: "trial" | "per_appeal" | "monthly";
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
      `${ctx.appeals.pendingActions} appeal deadline${ctx.appeals.pendingActions === 1 ? "" : "s"} this week`
    );
  } else {
    parts.push("No pending appeals");
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
      message: `Your next A1C screening is due in ${ctx.diabetes.daysUntilScreening} days — staying on schedule matters.`,
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
      message: `You have an appeal deadline in ${ctx.appeals.daysUntilDeadline} days — don\u2019t miss your window.`,
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

  // P4 — A1C improvement
  if (ctx.diabetes.latestA1C !== null && ctx.diabetes.latestA1C < 7) {
    candidates.push({
      message: `Your A1C is at ${ctx.diabetes.latestA1C}% — great progress. Keep it up.`,
      cta: "View Details",
      href: "/app/chat?topic=diabetes",
      priority: 4,
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
  if (d.latestA1C !== null) {
    return { label: "A1C Logged", color: "#2ECC71", variant: "solid" };
  }
  return {
    label: "Start Tracking",
    color: "#3B82F6",
    variant: "outline",
  };
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
// Mock data (swap for real API later)
// ---------------------------------------------------------------------------

export function getMockDashboardContext(
  overrides?: Partial<DashboardContext>
): DashboardContext {
  const now = new Date();
  const screeningDate = new Date(now);
  screeningDate.setDate(screeningDate.getDate() + 12);

  return {
    user: {
      firstName: "Venkata",
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

/** Empty context for brand-new users */
export function getNewUserDashboardContext(): DashboardContext {
  return {
    user: {
      firstName: "Venkata",
      lastLogin: new Date().toISOString(),
      hasCompletedWalkthrough: false,
      plan: "trial",
    },
    coverage: {
      hasRecentResult: false,
      resultStatus: null,
      procedureName: null,
    },
    dashboard: {
      blueButtonConnected: false,
      unreviewedClaimsCount: 0,
      lastSyncDate: null,
    },
    diabetes: {
      latestA1C: null,
      nextScreeningDate: null,
      hasMedReminders: false,
      daysUntilScreening: null,
    },
    appeals: {
      activeAppealsCount: 0,
      nearestDeadline: null,
      pendingActions: 0,
      daysUntilDeadline: null,
    },
  };
}

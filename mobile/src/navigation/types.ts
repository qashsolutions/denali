/**
 * Navigation type map — Phase 1 mobile.
 *
 * Mirrors the web app's IA where reasonable:
 *   - Pre-auth: SignIn
 *   - Post-auth interstitials: CohortOnboarding → Intake → Instruments
 *   - Main tabs: Timeline, Chat, Upload, Settings (mirrors
 *     app/src/components/layout/BottomTabs.tsx: Home/MyHealth/Ask Denali/Settings)
 *   - Upload review is a stack screen pushed from Upload.
 *
 * Surface ownership for each screen is documented in
 * `.claude/agents/mobile-app-shell.md` Pass 1, step 4.
 */

import type { NavigatorScreenParams } from "@react-navigation/native";

import type { DomainId } from "@/screens/timeline/domains/registry";

/** The four enterable intake sections (excludes the "menu" picker). */
export type IntakeSection = "complaint" | "history" | "family" | "lifestyle";

export type RootStackParamList = {
  SignIn: undefined;
  /**
   * PrivacyNotice — plain-language data-locality notice surfaced before any
   * data is collected (Wave 2, mobile-onboarding-builder). The user must
   * acknowledge before reaching CohortOnboarding.
   */
  PrivacyNotice: undefined;
  CohortOnboarding: undefined;
  /**
   * No params = onboarding flow (starts at the section menu, "Finish intake"
   * → Instruments). `section` = standalone re-entry from the main app's
   * "+ Add" capture flow: opens directly into that section and returns to
   * the caller on save/skip (no menu, no Instruments hand-off).
   */
  Intake: { section?: IntakeSection } | undefined;
  /**
   * Onboarding battery (no params — byte-identical legacy behavior) OR a
   * repeat check-in scoped to one domain (Step 4): `focus` renders only
   * that domain's instrument and returns to the caller when it completes.
   */
  Instruments: { focus?: DomainId } | undefined;
  // NavigatorScreenParams lets callers deep-link a specific tab, e.g.
  // navigate("MainTabs", { screen: "Upload" }) from a pushed stack screen.
  MainTabs: NavigatorScreenParams<MainTabsParamList> | undefined;
  UploadReview: { reportId: string };
  /**
   * Read-only detail of a saved uploaded report (its values + the report's own
   * flags). Reached by tapping a report in the list on the Upload tab.
   */
  ReportDetail: { reportId: string };
  /**
   * Phase-3 increment 1: per-domain detail screen reached by tapping a
   * DomainCard on HealthDashboardScreen. Renders the domain's history
   * (reusing TimelineCardView) and a header. Chart lands in
   * increment 2.
   */
  DomainDetail: { domainId: DomainId };
  /**
   * Phase-3 (D28): per-MARKER history drill-down reached by tapping a
   * "Latest readings" card on the Health-markers DomainDetail. `code` is the
   * LOINC code of the marker. Renders that marker's trend chart + all
   * readings; this is where the full reading history (collapsed to latest on
   * the domain screen, D27) is surfaced.
   */
  MarkerDetail: { code: string };
  /**
   * Phase-3 (D30): per-instrument-domain check-in history drill-down, reached
   * by tapping the "Latest check-in" card on an instrument DomainDetail. Shows
   * every past check-in session (the date-bucketed list moved off the domain
   * screen when it consolidated to latest-card + chart). Mirrors MarkerDetail.
   */
  InstrumentHistory: { domainId: DomainId };
  /**
   * Manual marker entry ("Log a value"). Optional `markerKey` pre-selects a
   * marker; absent → the marker picker. Reached from the "+ Add" sheet and
   * the empty Health-markers detail screen.
   */
  LogMarker: { markerKey?: string } | undefined;
  /**
   * Phase-3 — the ported chronological "All activity" view of every
   * observation. Gated behind `EXPO_PUBLIC_LEGACY_TIMELINE` during
   * the transition; surfaced as a de-emphasized footer entry on the
   * dashboard.
   */
  LegacyTimeline: undefined;
  /**
   * Restore the on-device health record from the BIP39 recovery phrase
   * (zero-knowledge backup, D16). Reached from the Settings backup card on a
   * device that has no local recovery key.
   */
  RestoreBackup: undefined;
};

export type MainTabsParamList = {
  Timeline: undefined;
  Chat: undefined;
  Upload: undefined;
  Settings: undefined;
};

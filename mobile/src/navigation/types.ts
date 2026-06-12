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
   * Phase-3 increment 1: per-domain detail screen reached by tapping a
   * DomainCard on HealthDashboardScreen. Renders the domain's history
   * (reusing TimelineCardView) and a header. Chart lands in
   * increment 2.
   */
  DomainDetail: { domainId: DomainId };
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
};

export type MainTabsParamList = {
  Timeline: undefined;
  Chat: undefined;
  Upload: undefined;
  Settings: undefined;
};

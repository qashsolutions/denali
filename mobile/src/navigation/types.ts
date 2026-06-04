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

export type RootStackParamList = {
  SignIn: undefined;
  CohortOnboarding: undefined;
  Intake: undefined;
  Instruments: undefined;
  MainTabs: undefined;
  UploadReview: { reportId: string };
};

export type MainTabsParamList = {
  Timeline: undefined;
  Chat: undefined;
  Upload: undefined;
  Settings: undefined;
};

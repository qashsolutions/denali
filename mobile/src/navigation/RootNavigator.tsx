/**
 * Root native-stack — Phase 1 mobile.
 *
 * Pre-auth: SignIn.
 * Post-auth interstitials (in order): CohortOnboarding → Intake → Instruments.
 * Then MainTabs (Timeline/Upload/Chat/Settings).
 * UploadReview is pushed from inside the Upload tab.
 *
 * Pass 1 leaves the initial route at SignIn for visual smoke. Pass 2 wires
 * the real gating (LocalDataDAL.getProfile() — no profile → onboarding;
 * profile present → MainTabs).
 */

import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { useApiClient } from "@/auth";
import { useDalState } from "@/db/DalProvider";
import { PrivacyNoticeScreen } from "@/onboarding/PrivacyNoticeScreen";
import { CohortOnboardingScreen } from "@/screens/CohortOnboardingScreen";
import { DomainDetailScreen } from "@/screens/DomainDetailScreen";
import { InstrumentsScreen } from "@/screens/InstrumentsScreen";
import { IntakeOnboardingScreen } from "@/screens/IntakeOnboardingScreen";
import { LogMarkerScreen } from "@/screens/markers/LogMarkerScreen";
import { SignInScreen } from "@/screens/SignInScreen";
import { TimelineScreen } from "@/screens/TimelineScreen";
import { UploadReviewScreen } from "@/screens/UploadReviewScreen";
import { useTheme } from "@/theme/useTheme";

import { MainTabs } from "./MainTabs";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const api = useApiClient();
  const { dal, ready } = useDalState();
  const { active } = useTheme();
  const [decided, setDecided] = useState(false);
  const [initialRoute, setInitialRoute] =
    useState<keyof RootStackParamList>("SignIn");

  // Cold-launch session restore (operator review 2026-06-12): a valid stored
  // session must survive an app restart instead of forcing re-OTP. Wait for
  // the SQLCipher DB to finish opening, read the local profile for identity,
  // then ask the ApiClient to restore the session — it enforces the 7-day
  // NIST cap and clears stale tokens. A returning user lands on MainTabs;
  // first launch / expired cap / DB-open failure falls through to SignIn.
  // New sign-ins still go through OTP via SignInScreen.
  useEffect(() => {
    if (!ready || decided) return;
    let cancelled = false;
    void (async () => {
      try {
        if (dal != null) {
          const profile = await dal.getProfile();
          if (profile != null) {
            const restored = await api.restoreSession({
              userId: profile.id,
              email: profile.email,
            });
            if (!cancelled && restored) setInitialRoute("MainTabs");
          }
        }
      } catch {
        // Any failure leaves the default SignIn route.
      } finally {
        if (!cancelled) setDecided(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, dal, api, decided]);

  if (!ready || !decided) {
    return (
      <View
        testID="root_boot_splash"
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: active.bgPrimary,
        }}
      >
        <ActivityIndicator color={active.accentPrimary} />
      </View>
    );
  }

  return (
    // Hide the native stack header by default — every screen renders its
    // own visual hierarchy (OneItemScreen for onboarding; bespoke layouts
    // for SignIn / PrivacyNotice; tab bar for MainTabs). The native
    // header was previously leaking route names ("SignIn",
    // "CohortOnboarding") as titles. UploadReview is the one screen with
    // no in-body Back affordance, so it opts back into the native header
    // with a human-readable title.
    <Stack.Navigator
      initialRouteName={initialRoute}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen name="PrivacyNotice" component={PrivacyNoticeScreen} />
      <Stack.Screen name="CohortOnboarding" component={CohortOnboardingScreen} />
      <Stack.Screen name="Intake" component={IntakeOnboardingScreen} />
      <Stack.Screen name="Instruments" component={InstrumentsScreen} />
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen
        name="UploadReview"
        component={UploadReviewScreen}
        options={{ headerShown: true, title: "Review" }}
      />
      {/*
       * Phase-3 increment 1: the dashboard is the new Timeline-tab landing.
       * Tapping a DomainCard navigates here with a {domainId} param. The
       * detail screen renders its own back affordance since the stack is
       * headerless. Chart lands in increment 2.
       */}
      <Stack.Screen name="DomainDetail" component={DomainDetailScreen} />
      <Stack.Screen name="LogMarker" component={LogMarkerScreen} />
      {/*
       * The legacy chronological feed remains reachable via a footer entry
       * on the dashboard, gated behind `EXPO_PUBLIC_LEGACY_TIMELINE=true`.
       * Same screen as before — just rerouted from the tab to its own
       * stack entry while the new dashboard occupies the Timeline tab.
       */}
      <Stack.Screen name="LegacyTimeline" component={TimelineScreen} />
    </Stack.Navigator>
  );
}

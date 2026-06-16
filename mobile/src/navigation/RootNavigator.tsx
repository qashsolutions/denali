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
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

import { runBiometricGate, useApiClient } from "@/auth";
import { useDalState } from "@/db/DalProvider";
import { PrivacyNoticeScreen } from "@/onboarding/PrivacyNoticeScreen";
import { CohortOnboardingScreen } from "@/screens/CohortOnboardingScreen";
import { DomainDetailScreen } from "@/screens/DomainDetailScreen";
import { InstrumentsScreen } from "@/screens/InstrumentsScreen";
import { IntakeOnboardingScreen } from "@/screens/IntakeOnboardingScreen";
import { LockScreen } from "@/screens/LockScreen";
import { LogMarkerScreen } from "@/screens/markers/LogMarkerScreen";
import { MarkerDetailScreen } from "@/screens/MarkerDetailScreen";
import { RestoreBackupScreen } from "@/screens/RestoreBackupScreen";
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
  // Launch phases: "deciding" (splash while we restore + gate) → "locked"
  // (valid session held behind a failed biometric gate) → "ready" (render
  // the navigator at `initialRoute`).
  const [phase, setPhase] = useState<"deciding" | "locked" | "ready">(
    "deciding",
  );
  const [initialRoute, setInitialRoute] =
    useState<keyof RootStackParamList>("SignIn");
  const [gateBusy, setGateBusy] = useState(false);

  // Cold-launch session restore + biometric gate (decisions D14 + D15).
  // After the SQLCipher DB is ready, read the local profile and ask the
  // ApiClient to restore the session (30-day NIST cap; clears stale tokens).
  // A restored session is then held behind a device-presence check: passed
  // or unavailable → MainTabs; failed → the locked screen. First launch /
  // expired cap / DB-open failure → SignIn. New sign-ins still OTP.
  useEffect(() => {
    if (!ready || phase !== "deciding") return;
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
            if (restored) {
              const verdict = await runBiometricGate();
              if (cancelled) return;
              if (verdict === "failed") {
                setPhase("locked");
                return;
              }
              // passed | unavailable → enter the app.
              setInitialRoute("MainTabs");
            }
          }
        }
      } catch {
        // Any failure leaves the default SignIn route.
      } finally {
        // Don't override a "locked" verdict set above.
        if (!cancelled) setPhase((p) => (p === "deciding" ? "ready" : p));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, phase, dal, api]);

  // Locked-screen actions: retry the gate, or abandon the session → OTP.
  const onUnlock = useCallback(() => {
    setGateBusy(true);
    void (async () => {
      try {
        const verdict = await runBiometricGate();
        if (verdict === "passed" || verdict === "unavailable") {
          setInitialRoute("MainTabs");
          setPhase("ready");
        }
        // failed → stay locked; the user can retry or sign out.
      } finally {
        setGateBusy(false);
      }
    })();
  }, []);

  const onSignOut = useCallback(() => {
    setGateBusy(true);
    void (async () => {
      try {
        await api.signOut();
      } catch {
        // Route to SignIn regardless — the session is being abandoned.
      } finally {
        setInitialRoute("SignIn");
        setPhase("ready");
        setGateBusy(false);
      }
    })();
  }, [api]);

  if (phase === "deciding") {
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

  if (phase === "locked") {
    return (
      <LockScreen onUnlock={onUnlock} onSignOut={onSignOut} busy={gateBusy} />
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
      {/* D28: per-marker history drill-down (tap a Latest-readings card). */}
      <Stack.Screen name="MarkerDetail" component={MarkerDetailScreen} />
      <Stack.Screen name="LogMarker" component={LogMarkerScreen} />
      {/*
       * The legacy chronological feed remains reachable via a footer entry
       * on the dashboard, gated behind `EXPO_PUBLIC_LEGACY_TIMELINE=true`.
       * Same screen as before — just rerouted from the tab to its own
       * stack entry while the new dashboard occupies the Timeline tab.
       */}
      <Stack.Screen name="LegacyTimeline" component={TimelineScreen} />
      <Stack.Screen name="RestoreBackup" component={RestoreBackupScreen} />
    </Stack.Navigator>
  );
}

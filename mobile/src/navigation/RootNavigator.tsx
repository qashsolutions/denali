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

import { PrivacyNoticeScreen } from "@/onboarding/PrivacyNoticeScreen";
import { CohortOnboardingScreen } from "@/screens/CohortOnboardingScreen";
import { InstrumentsScreen } from "@/screens/InstrumentsScreen";
import { IntakeOnboardingScreen } from "@/screens/IntakeOnboardingScreen";
import { SignInScreen } from "@/screens/SignInScreen";
import { UploadReviewScreen } from "@/screens/UploadReviewScreen";

import { MainTabs } from "./MainTabs";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  return (
    // Hide the native stack header by default — every screen renders its
    // own visual hierarchy (OneItemScreen for onboarding; bespoke layouts
    // for SignIn / PrivacyNotice; tab bar for MainTabs). The native
    // header was previously leaking route names ("SignIn",
    // "CohortOnboarding") as titles. UploadReview is the one screen with
    // no in-body Back affordance, so it opts back into the native header
    // with a human-readable title.
    <Stack.Navigator
      initialRouteName="SignIn"
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
    </Stack.Navigator>
  );
}

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
    <Stack.Navigator initialRouteName="SignIn">
      <Stack.Screen name="SignIn" component={SignInScreen} />
      <Stack.Screen
        name="PrivacyNotice"
        component={PrivacyNoticeScreen}
        options={{ headerBackVisible: false }}
      />
      <Stack.Screen name="CohortOnboarding" component={CohortOnboardingScreen} />
      <Stack.Screen name="Intake" component={IntakeOnboardingScreen} />
      <Stack.Screen name="Instruments" component={InstrumentsScreen} />
      <Stack.Screen
        name="MainTabs"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="UploadReview" component={UploadReviewScreen} />
    </Stack.Navigator>
  );
}

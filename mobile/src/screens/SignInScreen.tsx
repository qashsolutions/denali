// TODO(mobile-auth-wirer): implement
//
// Wave 1 — owns email OTP sign-in flow against the Next.js backend.
// Uses ApiClient.sendOtp + verifyOtp; on success, navigates to
// CohortOnboarding (if no local ProfileRow) or MainTabs (if profile present).
//
// Contracts consumed: ApiClient (from src/contracts).

import { Text, View } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ApiClient } from "@/contracts";

export function SignInScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text>TODO(mobile-auth-wirer): implement SignInScreen</Text>
    </View>
  );
}

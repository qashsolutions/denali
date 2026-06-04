// TODO(mobile-onboarding-builder): implement
//
// Wave 2 — cohort interstitial (Medicare / age / sex-at-birth / gender-identity).
// Persists to local ProfileRow via LocalDataDAL.upsertProfile and PATCHes
// the backend profile via ApiClient.apiPatch("/api/profile", ...) for the
// cohort-gate cookie. Uses Theme tokens for all styling.
//
// Contracts consumed: ApiClient, LocalDataDAL, Theme,
// USCDI value sets SexAtBirth + GenderIdentity (all from src/contracts).

import { Text, View } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type {
  ApiClient,
  GenderIdentity,
  LocalDataDAL,
  SexAtBirth,
  Theme,
} from "@/contracts";

export function CohortOnboardingScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text>TODO(mobile-onboarding-builder): implement CohortOnboardingScreen</Text>
    </View>
  );
}

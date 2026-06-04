// TODO(mobile-onboarding-builder): implement
//
// Wave 2 — symptom / history intake. Writes observations (questionnaire +
// self_reported categories) to LocalDataDAL.insertObservation. Honors the
// append-only invariant — corrections insert new rows with supersedes_id,
// never UPDATE.
//
// Contracts consumed: ApiClient, LocalDataDAL, Theme,
// USCDI value sets (from src/contracts).

import { Text, View } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type {
  ApiClient,
  GenderIdentity,
  LocalDataDAL,
  SexAtBirth,
  Theme,
} from "@/contracts";

export function IntakeOnboardingScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text>TODO(mobile-onboarding-builder): implement IntakeOnboardingScreen</Text>
    </View>
  );
}

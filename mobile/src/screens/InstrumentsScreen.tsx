// TODO(mobile-onboarding-builder): implement
//
// Wave 2 — validated instruments (PHQ-2/9, GAD-7, etc.) with 988 surface for
// PHQ-9 item 9 affirmative responses. Scores persisted as questionnaire
// observations on LocalDataDAL.
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

export function InstrumentsScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text>TODO(mobile-onboarding-builder): implement InstrumentsScreen</Text>
    </View>
  );
}

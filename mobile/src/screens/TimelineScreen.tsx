// TODO(mobile-app-shell Pass 2): implement
//
// Wave 3 — chronological list of observations (LOINC labs, vitals,
// anthropometrics, questionnaire scores, etc.) via
// LocalDataDAL.listObservations({ latest_only: true, limit: <page> }).
// Tap a row to see the supersede chain (history walk via getObservation
// on supersedes_id).
//
// Contracts consumed: LocalDataDAL, Theme (from src/contracts).

import { Text, View } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { LocalDataDAL, Theme } from "@/contracts";

export function TimelineScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text>TODO(mobile-app-shell Pass 2): implement TimelineScreen</Text>
    </View>
  );
}

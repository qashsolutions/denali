// TODO(mobile-app-shell Pass 2): implement
//
// Wave 3 — surfaces the three consent_preferences toggles (health_data_ai,
// health_data_storage, analytics) via ApiClient.apiPatch("/api/consent", ...).
// Also shows current plan and a sign-out action (ApiClient.signOut).
//
// Contracts consumed: ApiClient, Theme (from src/contracts).

import { Text, View } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ApiClient, Theme } from "@/contracts";

export function SettingsScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text>TODO(mobile-app-shell Pass 2): implement SettingsScreen</Text>
    </View>
  );
}

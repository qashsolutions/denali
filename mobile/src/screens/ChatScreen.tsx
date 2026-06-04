// TODO(mobile-app-shell Pass 2): implement
//
// Wave 3 — chat via ApiClient.chat({ noPersist: true, ... }). Local-only
// history via LocalDataDAL.insertChatMessage / listChatMessages. No rows
// written to the server-side conversations/messages tables.
//
// Contracts consumed: ApiClient, LocalDataDAL, Theme (from src/contracts).

import { Text, View } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ApiClient, LocalDataDAL, Theme } from "@/contracts";

export function ChatScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text>TODO(mobile-app-shell Pass 2): implement ChatScreen</Text>
    </View>
  );
}

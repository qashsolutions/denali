// TODO(mobile-upload-parse-builder): implement
//
// Wave 2 — file picker + encrypted on-device blob storage + POST to the
// net-new /api/parse-report route (transient analysis, no server persistence).
// Writes a ReportRow via LocalDataDAL.insertReport with parse_status="pending",
// then pushes UploadReviewScreen on parse completion.
//
// Contracts consumed: ApiClient, LocalDataDAL, Theme, ReportType (from src/contracts).

import { Text, View } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ApiClient, LocalDataDAL, ReportType, Theme } from "@/contracts";

export function UploadScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text>TODO(mobile-upload-parse-builder): implement UploadScreen</Text>
    </View>
  );
}

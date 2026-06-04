// TODO(mobile-upload-parse-builder): implement
//
// Wave 2 — review screen showing parsed observations attached to a report
// (LocalDataDAL.listObservations with report_id filter). User confirms,
// rejects, or edits before observations are marked confirmed.
//
// Contracts consumed: ApiClient, LocalDataDAL, Theme, ReportType (from src/contracts).

import { Text, View } from "react-native";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
import type { ApiClient, LocalDataDAL, ReportType, Theme } from "@/contracts";

export function UploadReviewScreen() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text>TODO(mobile-upload-parse-builder): implement UploadReviewScreen</Text>
    </View>
  );
}

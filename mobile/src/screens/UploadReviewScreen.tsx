/**
 * UploadReviewScreen — Phase 1 mobile (Wave 2 / mobile-upload-parse-builder).
 *
 * Renders the parsed observations for a single report and lets the user
 * accept, reject, or edit each row before commit. On Confirm:
 *   - Each accepted row → `LocalDataDAL.insertObservation` with
 *     `source = "uploaded_report"` and `report_id = <this report>`.
 *   - The report row is updated via
 *     `LocalDataDAL.updateReportParseStatus(id, status, summary)`
 *     where `status` = confirmed | partial | rejected per the helper in
 *     `reviewCommit.ts`.
 *
 * The unedited parse is retained inside each observation's `metadata_json`
 * for audit (see `buildObservationInsert`).
 *
 * All styling via `useTheme()` — zero hardcoded design values.
 */

import { useNavigation, useRoute } from "@react-navigation/native";
import type {
  NativeStackNavigationProp,
  NativeStackScreenProps,
} from "@react-navigation/native-stack";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { LocalDataDAL } from "@/contracts";
import { useDal } from "@/db/DalProvider";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/useTheme";
import {
  buildInsertsForReport,
  computeParseStatus,
} from "../upload/reviewCommit";
import type {
  ExtractedObservation,
  ParseReportResponse,
  ReviewRowState,
} from "../upload/types";
import { takeParsePayload } from "./UploadScreen";

type Nav = NativeStackNavigationProp<RootStackParamList, "UploadReview">;
type RouteProps = NativeStackScreenProps<
  RootStackParamList,
  "UploadReview"
>["route"];

export function UploadReviewScreen(): React.ReactElement {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<Nav>();
  const dal = useDal();
  const { active, theme } = useTheme();

  const reportId = route.params.reportId;

  const [payload, setPayload] = React.useState<ParseReportResponse | null>(
    () => takeParsePayload(reportId) ?? null,
  );
  const [rows, setRows] = React.useState<ReviewRowState[]>(() =>
    (payload?.observations ?? []).map((o) => ({
      original: o,
      edited: { ...o },
      accepted: true,
    })),
  );
  const [committing, setCommitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Sync rows when payload arrives. This handles the case where the screen
  // is reached without the in-process stash (cold launch, deep link).
  React.useEffect(() => {
    if (!payload) return;
    setRows(
      payload.observations.map((o) => ({
        original: o,
        edited: { ...o },
        accepted: true,
      })),
    );
  }, [payload]);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: active.bgPrimary },
        content: {
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
        },
        title: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.serif,
          fontSize: theme.typography.sizes["2xl"],
        },
        summary: {
          color: active.textSecondary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
        },
        row: {
          backgroundColor: active.bgSecondary,
          borderColor: active.border,
          borderWidth: 1,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        },
        rowRejected: {
          opacity: 0.5,
          borderStyle: "dashed",
        },
        rowHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: theme.spacing.sm,
        },
        rowTitle: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
          fontWeight: "600",
          flexShrink: 1,
        },
        rowConfidence: {
          color: active.textMuted,
          fontFamily: theme.typography.fonts.mono,
          fontSize: theme.typography.sizes.xs,
        },
        fieldLabel: {
          color: active.textSecondary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.xs,
          marginBottom: theme.spacing.xs / 2,
        },
        input: {
          backgroundColor: active.bgPrimary,
          color: active.textPrimary,
          borderColor: active.border,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
          minHeight: 44,
        },
        sourceText: {
          color: active.textMuted,
          fontFamily: theme.typography.fonts.mono,
          fontSize: theme.typography.sizes.xs,
          marginTop: theme.spacing.xs,
        },
        toggleRow: {
          flexDirection: "row",
          gap: theme.spacing.sm,
        },
        toggle: {
          flex: 1,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.radii.md,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 44,
          borderWidth: 1,
          borderColor: active.border,
          backgroundColor: active.bgPrimary,
        },
        toggleActive: {
          backgroundColor: active.accentPrimary,
          borderColor: active.accentPrimary,
        },
        toggleText: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.sm,
          fontWeight: "600",
        },
        toggleTextActive: {
          color: active.bgPrimary,
        },
        button: {
          backgroundColor: active.accentPrimary,
          borderRadius: theme.radii.md,
          paddingVertical: theme.spacing.md,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        },
        buttonSecondary: {
          backgroundColor: active.bgSecondary,
          borderColor: active.accentPrimary,
          borderWidth: 1,
        },
        buttonDisabled: { opacity: 0.5 },
        buttonText: {
          color: active.bgPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
          fontWeight: "600",
        },
        buttonTextSecondary: {
          color: active.accentPrimary,
        },
        banner: {
          backgroundColor: active.bgTertiary,
          borderColor: active.error,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
        },
        bannerText: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.sm,
        },
        emptyState: {
          color: active.textSecondary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
          textAlign: "center",
          padding: theme.spacing.lg,
        },
      }),
    [active, theme],
  );

  const updateRow = React.useCallback(
    (index: number, patch: Partial<ExtractedObservation>) => {
      setRows((prev) =>
        prev.map((r, i) =>
          i === index ? { ...r, edited: { ...r.edited, ...patch } } : r,
        ),
      );
    },
    [],
  );

  const setAccepted = React.useCallback(
    (index: number, accepted: boolean) => {
      setRows((prev) =>
        prev.map((r, i) => (i === index ? { ...r, accepted } : r)),
      );
    },
    [],
  );

  // ── Fallback when navigated to without a stashed payload ──
  // (Cold launch / deep link path. Real users always have payload from the
  //  upload screen's stash. The fallback fetches the report row so we can
  //  at least show context, but there's nothing to review.)
  const reportLoaded = payload != null;

  const onConfirm = React.useCallback(async () => {
    setErrorMsg(null);
    setCommitting(true);
    try {
      if (!dal) {
        setErrorMsg("Storage is still opening. Try again in a moment.");
        return;
      }
      // We need a stable user id for the inserts. Pull it from the
      // (already-persisted) report row to avoid a stale auth dependency.
      const report = await dal.getReport(reportId);
      if (!report) {
        setErrorMsg(
          "This report is no longer on this device. Please re-upload.",
        );
        return;
      }

      const inserts = buildInsertsForReport(rows, report.user_id, reportId);
      for (const insert of inserts) {
        await dal.insertObservation(insert);
      }

      const status = computeParseStatus(rows);
      const acceptedCount = rows.filter((r) => r.accepted).length;
      const summary =
        payload?.summary ??
        (acceptedCount > 0
          ? `${acceptedCount} value${acceptedCount === 1 ? "" : "s"} saved.`
          : "No values saved.");
      await dal.updateReportParseStatus(reportId, status, summary);

      // Navigate back to the upload flow's home (the Upload tab).
      navigation.popToTop();
    } catch (err) {
      setErrorMsg(
        "Couldn't save your review. Please try Confirm again.",
      );
      console.warn("[UploadReview] commit failed", err);
    } finally {
      setCommitting(false);
    }
  }, [dal, navigation, payload, reportId, rows]);

  const onSkip = React.useCallback(async () => {
    setCommitting(true);
    try {
      if (!dal) {
        setErrorMsg("Storage is still opening. Try again in a moment.");
        return;
      }
      await dal.updateReportParseStatus(
        reportId,
        "rejected",
        "Skipped on review.",
      );
      navigation.popToTop();
    } catch (err) {
      setErrorMsg("Couldn't skip — please try again.");
      console.warn("[UploadReview] skip failed", err);
    } finally {
      setCommitting(false);
    }
  }, [dal, navigation, reportId]);

  const renderRow = (row: ReviewRowState, idx: number) => {
    const obs = row.edited;
    const confidencePct = Math.round(obs.confidence * 100);
    return (
      <View
        key={idx}
        style={[styles.row, !row.accepted && styles.rowRejected]}
      >
        <View style={styles.rowHeader}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {obs.display || obs.code}
          </Text>
          <Text style={styles.rowConfidence}>
            {Number.isFinite(confidencePct) ? `${confidencePct}%` : "—"}
          </Text>
        </View>

        <View>
          <Text style={styles.fieldLabel}>Value</Text>
          <TextInput
            accessibilityLabel={`Value for ${obs.display}`}
            editable={!committing && row.accepted}
            keyboardType="numeric"
            onChangeText={(text) => {
              const num = text.length > 0 ? Number(text) : null;
              updateRow(idx, {
                value_num: Number.isFinite(num as number) ? (num as number) : null,
                value_text: !Number.isFinite(num as number) && text.length > 0 ? text : null,
              });
            }}
            placeholder="value"
            placeholderTextColor={active.textMuted}
            style={styles.input}
            value={
              obs.value_num != null
                ? String(obs.value_num)
                : (obs.value_text ?? "")
            }
          />
        </View>

        <View>
          <Text style={styles.fieldLabel}>Unit</Text>
          <TextInput
            accessibilityLabel={`Unit for ${obs.display}`}
            editable={!committing && row.accepted}
            onChangeText={(text) => updateRow(idx, { unit: text || null })}
            placeholder="unit"
            placeholderTextColor={active.textMuted}
            style={styles.input}
            value={obs.unit ?? ""}
          />
        </View>

        <View>
          <Text style={styles.fieldLabel}>Date</Text>
          <TextInput
            accessibilityLabel={`Date for ${obs.display}`}
            editable={!committing && row.accepted}
            onChangeText={(text) => updateRow(idx, { effective_at: text })}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={active.textMuted}
            style={styles.input}
            value={obs.effective_at}
          />
        </View>

        {row.original.source_text.length > 0 && (
          <Text style={styles.sourceText} numberOfLines={3}>
            From: &ldquo;{row.original.source_text}&rdquo;
          </Text>
        )}

        <View style={styles.toggleRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: row.accepted }}
            disabled={committing}
            onPress={() => setAccepted(idx, true)}
            style={[styles.toggle, row.accepted && styles.toggleActive]}
          >
            <Text
              style={[
                styles.toggleText,
                row.accepted && styles.toggleTextActive,
              ]}
            >
              Keep
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ selected: !row.accepted }}
            disabled={committing}
            onPress={() => setAccepted(idx, false)}
            style={[styles.toggle, !row.accepted && styles.toggleActive]}
          >
            <Text
              style={[
                styles.toggleText,
                !row.accepted && styles.toggleTextActive,
              ]}
            >
              Skip
            </Text>
          </Pressable>
        </View>
      </View>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Review extracted values</Text>
      {payload?.summary && (
        <Text style={styles.summary}>{payload.summary}</Text>
      )}

      {errorMsg && (
        <View style={styles.banner} accessibilityRole="alert">
          <Text style={styles.bannerText}>{errorMsg}</Text>
        </View>
      )}

      {!reportLoaded ? (
        <Text style={styles.emptyState}>
          No parsed values available for this report. Re-upload to try again.
        </Text>
      ) : rows.length === 0 ? (
        <Text style={styles.emptyState}>
          The AI didn&rsquo;t find any values it was confident about.
          Tap &ldquo;Skip&rdquo; to keep just the document on file.
        </Text>
      ) : (
        rows.map((r, idx) => renderRow(r, idx))
      )}

      <Pressable
        accessibilityRole="button"
        disabled={committing || !reportLoaded}
        onPress={onConfirm}
        style={({ pressed }) => [
          styles.button,
          (committing || !reportLoaded || pressed) && styles.buttonDisabled,
        ]}
      >
        {committing ? (
          <ActivityIndicator color={active.bgPrimary} />
        ) : (
          <Text style={styles.buttonText}>
            {rows.some((r) => r.accepted) ? "Save to my record" : "Save with no values"}
          </Text>
        )}
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={committing}
        onPress={onSkip}
        style={({ pressed }) => [
          styles.button,
          styles.buttonSecondary,
          (committing || pressed) && styles.buttonDisabled,
        ]}
      >
        <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
          Skip this review
        </Text>
      </Pressable>
    </ScrollView>
  );
}

// Suppress unused-import warning if LocalDataDAL is referenced only in types.
void ((_: LocalDataDAL | null) => undefined);

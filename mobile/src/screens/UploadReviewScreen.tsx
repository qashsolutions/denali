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

import { PressableScale } from "@/components/PressableScale";
import type { LocalDataDAL } from "@/contracts";
import { useDal } from "@/db/DalProvider";
import type { RootStackParamList } from "@/navigation/types";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";
import {
  buildInsertsForReport,
  computeParseStatus,
} from "../upload/reviewCommit";
import {
  ragForObservation,
  suggestNameFromObservations,
  summarizeReport,
} from "../upload/reportInterpretation";
import type {
  ExtractedObservation,
  ParseReportResponse,
  ReviewRowState,
} from "../upload/types";
import { STANDING_DISCLAIMER } from "./timeline/displayMapping";
import { tintByClass } from "./timeline/pill";
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
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();

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
  // After a successful save we show a results summary (the kept rows) instead
  // of silently popping back — confirmation + a recap of what was stored.
  const [saved, setSaved] = React.useState<ReviewRowState[] | null>(null);
  // How many kept values were already in the record (deduped, not re-saved).
  const [savedSkipped, setSavedSkipped] = React.useState<number>(0);

  // The user names the report HERE, after the parse — pre-filled from the
  // report's own content (its dominant date), editable, persisted on save.
  const [reportName, setReportName] = React.useState<string>("");
  const [nameEdited, setNameEdited] = React.useState<boolean>(false);
  const suggestedName = React.useMemo(
    () =>
      payload
        ? suggestNameFromObservations(payload.observations, new Date())
        : "",
    [payload],
  );
  const nameValue = nameEdited ? reportName : suggestedName;

  const onDone = React.useCallback(() => {
    navigation.popToTop();
  }, [navigation]);

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
        screen: { flex: 1, backgroundColor: redesign.paper },
        content: {
          padding: theme.spacing.space5,
          gap: theme.spacing.space3,
        },
        title: {
          color: redesign.ink,
          fontSize: theme.typography.sizes["2xl"],
          letterSpacing: -0.5,
          ...fontStyle("display", 700, fontsLoaded),
        },
        summary: {
          color: redesign.ink2,
          fontSize: theme.typography.sizes.base,
          lineHeight: theme.typography.sizes.base * 1.5,
          ...fontStyle("body", 400, fontsLoaded),
        },
        // Always-on AI caveat — this screen shows machine-read values.
        caveat: {
          color: redesign.ink3,
          fontSize: theme.typography.sizes.sm,
          lineHeight: theme.typography.sizes.sm * 1.4,
          ...fontStyle("body", 400, fontsLoaded),
        },
        // Post-save confirmation header.
        savedHeader: {
          color: redesign.tealDeep,
          fontSize: theme.typography.sizes["2xl"],
          letterSpacing: -0.5,
          ...fontStyle("display", 700, fontsLoaded),
        },
        savedValue: {
          color: redesign.ink2,
          fontSize: theme.typography.sizes.base,
          ...fontStyle("body", 400, fontsLoaded),
        },
        // Right-aligned header cluster: RAG chip + confidence.
        headerRight: {
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.sm,
          flexShrink: 0,
        },
        // Sourced RAG chip — colors injected from the band tint system.
        ragChip: {
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs / 2,
          borderRadius: theme.radii.lg,
        },
        ragChipText: {
          fontSize: theme.typography.sizes.xs,
          ...fontStyle("body", 600, fontsLoaded),
        },
        // White r-18 surface card per row.
        row: {
          backgroundColor: redesign.surface,
          borderColor: redesign.line,
          borderWidth: 1,
          borderRadius: redesign.rCard,
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
          color: redesign.ink,
          fontSize: theme.typography.sizes.base,
          flexShrink: 1,
          ...fontStyle("body", 600, fontsLoaded),
        },
        // Confidence % — numbers role, tabular.
        rowConfidence: {
          color: redesign.ink3,
          fontSize: theme.typography.sizes.xs,
          fontVariant: ["tabular-nums"],
          ...fontStyle("numbers", 600, fontsLoaded),
        },
        fieldLabel: {
          color: redesign.ink2,
          fontSize: theme.typography.sizes.xs,
          marginBottom: theme.spacing.xs / 2,
          ...fontStyle("body", 400, fontsLoaded),
        },
        input: {
          backgroundColor: redesign.paper,
          color: redesign.ink,
          borderColor: redesign.line,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          fontSize: theme.typography.sizes.base,
          minHeight: 48,
          ...fontStyle("body", 400, fontsLoaded),
        },
        sourceText: {
          color: redesign.ink3,
          fontSize: theme.typography.sizes.xs,
          marginTop: theme.spacing.xs,
          fontStyle: "italic",
          ...fontStyle("body", 400, fontsLoaded),
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
          minHeight: 48,
          borderWidth: 1,
          borderColor: redesign.line,
          backgroundColor: redesign.paper,
        },
        toggleActive: {
          backgroundColor: redesign.teal,
          borderColor: redesign.teal,
        },
        toggleText: {
          color: redesign.ink,
          fontSize: theme.typography.sizes.sm,
          ...fontStyle("body", 600, fontsLoaded),
        },
        toggleTextActive: {
          color: redesign.surface,
        },
        // Mockup .cta + .cta.ghost.
        button: {
          backgroundColor: redesign.teal,
          borderRadius: theme.radii.xl - 2,
          paddingVertical: theme.spacing.md - 1,
          minHeight: 48,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: redesign.teal,
          shadowOpacity: 0.28,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        },
        buttonSecondary: {
          backgroundColor: redesign.surface,
          borderColor: redesign.tealWash,
          borderWidth: 1,
          shadowOpacity: 0,
          elevation: 0,
        },
        buttonDisabled: { opacity: 0.5 },
        buttonText: {
          color: redesign.surface,
          fontSize: theme.typography.sizes.base,
          ...fontStyle("body", 600, fontsLoaded),
        },
        buttonTextSecondary: {
          color: redesign.tealDeep,
        },
        banner: {
          backgroundColor: redesign.alarmWash,
          borderColor: redesign.alarm,
          borderWidth: 1,
          borderRadius: redesign.rCard,
          padding: theme.spacing.md,
        },
        bannerText: {
          color: redesign.ink,
          fontSize: theme.typography.sizes.sm,
          ...fontStyle("body", 400, fontsLoaded),
        },
        emptyState: {
          color: redesign.ink2,
          fontSize: theme.typography.sizes.base,
          textAlign: "center",
          padding: theme.spacing.lg,
          ...fontStyle("body", 400, fontsLoaded),
        },
      }),
    [theme, redesign, fontsLoaded],
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

      const acceptedRows = rows.filter((r) => r.accepted);
      const inserts = buildInsertsForReport(rows, report.user_id, reportId);
      // Track which rows ACTUALLY inserted. A value already in the record
      // (same code + effective_at) is a no-op (inserted:false) — it isn't
      // linked to this report, so it must not be counted as newly saved.
      const savedRows: ReviewRowState[] = [];
      for (let i = 0; i < inserts.length; i += 1) {
        const res = await dal.insertObservation(inserts[i]);
        if (res.inserted) savedRows.push(acceptedRows[i]);
      }

      // Persist the name the user gave the report (metadata only).
      const finalName = nameValue.trim();
      if (finalName.length > 0) {
        await dal.renameReport(reportId, finalName);
      }

      const status = computeParseStatus(rows);
      // Store a FACTUAL summary — the count of values ACTUALLY saved to this
      // report (matches what its detail will list), never the model's text.
      const summary =
        savedRows.length > 0
          ? `${savedRows.length} value${savedRows.length === 1 ? "" : "s"} saved.`
          : "No new values saved.";
      await dal.updateReportParseStatus(reportId, status, summary);

      // Recap only the rows that actually landed in the record; note any that
      // were already present (deduped).
      setSavedSkipped(acceptedRows.length - savedRows.length);
      setSaved(savedRows);
    } catch (err) {
      setErrorMsg(
        "Couldn't save your review. Please try Confirm again.",
      );
      console.warn("[UploadReview] commit failed", err);
    } finally {
      setCommitting(false);
    }
  }, [dal, reportId, rows, nameValue]);

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
    // RAG reflects the REPORT'S OWN flag (from row.original — editing a value
    // doesn't change what the report printed). null = report stated no flag.
    const rag = ragForObservation(row.original);
    const ragColors = rag ? tintByClass(redesign, rag.tint) : null;
    return (
      <View
        key={idx}
        style={[styles.row, !row.accepted && styles.rowRejected]}
      >
        <View style={styles.rowHeader}>
          <Text style={styles.rowTitle} numberOfLines={2}>
            {obs.display || obs.code}
          </Text>
          <View style={styles.headerRight}>
            {rag && ragColors && (
              <View style={[styles.ragChip, { backgroundColor: ragColors.bg }]}>
                <Text style={[styles.ragChipText, { color: ragColors.fg }]}>
                  {rag.label}
                </Text>
              </View>
            )}
            <Text style={styles.rowConfidence}>
              {Number.isFinite(confidencePct) ? `${confidencePct}%` : "—"}
            </Text>
          </View>
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
            placeholderTextColor={redesign.ink3}
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
            placeholderTextColor={redesign.ink3}
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
            placeholderTextColor={redesign.ink3}
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

  if (saved != null) {
    return (
      <ScrollView
        contentContainerStyle={styles.content}
        style={styles.screen}
      >
        <Text style={styles.savedHeader}>✓ Saved to your record</Text>
        {nameValue.trim().length > 0 && (
          <Text style={styles.rowTitle}>{nameValue.trim()}</Text>
        )}
        <Text style={styles.summary}>
          {`${saved.length} value${saved.length === 1 ? "" : "s"} added to your health record.`}
        </Text>
        {savedSkipped > 0 && (
          <Text style={styles.caveat}>
            {`${savedSkipped} ${savedSkipped === 1 ? "value was" : "values were"} already in your record.`}
          </Text>
        )}
        <Text style={styles.caveat}>
          {`AI-generated from your report. ${STANDING_DISCLAIMER} Check with your doctor.`}
        </Text>
        {saved.map((r, i) => {
          const obs = r.edited;
          const rag = ragForObservation(r.original);
          const ragColors = rag ? tintByClass(redesign, rag.tint) : null;
          const value =
            obs.value_num != null
              ? String(obs.value_num)
              : (obs.value_text ?? "");
          return (
            <View key={i} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {obs.display || obs.code}
                </Text>
                {rag && ragColors && (
                  <View
                    style={[styles.ragChip, { backgroundColor: ragColors.bg }]}
                  >
                    <Text
                      style={[styles.ragChipText, { color: ragColors.fg }]}
                    >
                      {rag.label}
                    </Text>
                  </View>
                )}
              </View>
              {value.length > 0 && (
                <Text style={styles.savedValue} numberOfLines={2}>
                  {obs.unit ? `${value} ${obs.unit}` : value}
                </Text>
              )}
            </View>
          );
        })}
        <PressableScale
          haptic
          accessibilityRole="button"
          onPress={onDone}
          style={styles.button}
        >
          <Text style={styles.buttonText}>Done</Text>
        </PressableScale>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Review extracted values</Text>
      {payload && payload.observations.length > 0 && (
        <Text style={styles.summary}>
          {summarizeReport(payload.observations)}
        </Text>
      )}
      <Text style={styles.caveat}>
        {`AI-generated from your report. ${STANDING_DISCLAIMER} Check with your doctor.`}
      </Text>

      {payload && payload.observations.length > 0 && (
        <View>
          <Text style={styles.fieldLabel}>Name this report</Text>
          <TextInput
            accessibilityLabel="Report name"
            editable={!committing}
            maxLength={120}
            onChangeText={(text) => {
              setReportName(text);
              setNameEdited(true);
            }}
            placeholder="Name this report"
            placeholderTextColor={redesign.ink3}
            style={styles.input}
            value={nameValue}
          />
        </View>
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

      <PressableScale
        haptic
        accessibilityRole="button"
        disabled={committing || !reportLoaded}
        onPress={onConfirm}
        style={[
          styles.button,
          (committing || !reportLoaded) && styles.buttonDisabled,
        ]}
      >
        {committing ? (
          <ActivityIndicator color={redesign.surface} />
        ) : (
          <Text style={styles.buttonText}>
            {rows.some((r) => r.accepted) ? "Save to my record" : "Save with no values"}
          </Text>
        )}
      </PressableScale>

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

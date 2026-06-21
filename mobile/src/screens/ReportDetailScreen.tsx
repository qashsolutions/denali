/**
 * ReportDetailScreen — read-only view of one saved uploaded report.
 *
 * Shows the report's name + date and the values that were saved to the record,
 * each with the report's OWN red/amber/green flag (recovered from the saved
 * observation's audit metadata — same sourced RAG as the review screen). No
 * editing here; corrections happen by re-uploading.
 *
 * The original file stays an encrypted on-device blob; re-opening it needs a
 * PDF-viewer dependency (follow-up). This screen surfaces the saved analysis.
 *
 * All styling via useTheme() — no hardcoded design values.
 */

import { useNavigation, useRoute } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { ObservationRow } from "@/contracts";
import { useDal } from "@/db/DalProvider";
import type { RootStackParamList } from "@/navigation/types";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import { ragForRow } from "../upload/reportInterpretation";
import { TouchTargetLink } from "@/components/TouchTargetLink";

import { removeReport } from "../upload/removeReport";
import { formatMarkerValue } from "./markers/markerCatalog";
import { STANDING_DISCLAIMER } from "./timeline/displayMapping";
import { tintByClass } from "./timeline/pill";

type RouteProps = NativeStackScreenProps<
  RootStackParamList,
  "ReportDetail"
>["route"];
type NavProps = NativeStackScreenProps<
  RootStackParamList,
  "ReportDetail"
>["navigation"];

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ReportDetailScreen(): React.ReactElement {
  const route = useRoute<RouteProps>();
  const navigation = useNavigation<NavProps>();
  const dal = useDal();
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const reportId = route.params.reportId;
  const [deleting, setDeleting] = React.useState<boolean>(false);

  const [name, setName] = React.useState<string>("");
  const [subtitle, setSubtitle] = React.useState<string>("");
  const [rows, setRows] = React.useState<ObservationRow[]>([]);
  const [loading, setLoading] = React.useState<boolean>(true);
  // Inline rename of the report (its filename). Persisted via renameReport;
  // the Upload-tab list refreshes the new name on its next focus.
  const [editing, setEditing] = React.useState<boolean>(false);
  const [draftName, setDraftName] = React.useState<string>("");
  const [renaming, setRenaming] = React.useState<boolean>(false);
  const [renameError, setRenameError] = React.useState<string | null>(null);

  const onSaveName = React.useCallback(async () => {
    const next = draftName.trim();
    if (!dal || next.length === 0) {
      setEditing(false);
      return;
    }
    setRenaming(true);
    setRenameError(null);
    try {
      await dal.renameReport(reportId, next);
      setName(next);
      setEditing(false);
    } catch {
      setRenameError("Couldn't rename — please try again.");
    } finally {
      setRenaming(false);
    }
  }, [dal, draftName, reportId]);

  // UPL-2: remove this document (row + encrypted blob). Native confirm first —
  // irreversible, and any saved values stay in the record (the document is the
  // only thing removed). Uses the same removeReport orchestration as the
  // skip/abandon/failure paths so the blob is never left behind.
  const onDelete = React.useCallback(() => {
    if (!dal || deleting) return;
    Alert.alert(
      "Delete this document?",
      "The uploaded document is removed from this device. Any values already saved to your health record are kept.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            setDeleting(true);
            void removeReport(dal, reportId)
              .then(() => navigation.goBack())
              .catch(() => setDeleting(false));
          },
        },
      ],
    );
  }, [dal, deleting, reportId, navigation]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!dal) return;
      try {
        const report = await dal.getReport(reportId);
        const obs = await dal.listObservations({ report_id: reportId });
        if (cancelled) return;
        if (report) {
          setName(report.original_filename);
          // Date only. The value COUNT is derived from the actual linked
          // observations (below), never the stored summary_text — re-upload
          // dedup can make them disagree.
          setSubtitle(`Added ${formatDate(report.uploaded_at)}`);
        }
        setRows(obs);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dal, reportId]);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: redesign.paper },
        content: { padding: theme.spacing.space5, gap: theme.spacing.space3 },
        title: {
          color: redesign.ink,
          fontSize: theme.typography.sizes["2xl"],
          letterSpacing: -0.5,
          ...fontStyle("display", 700, fontsLoaded),
        },
        subtitle: {
          color: redesign.ink3,
          fontSize: theme.typography.sizes.sm,
          fontStyle: "italic",
          ...fontStyle("body", 400, fontsLoaded),
        },
        renameLink: {
          color: redesign.tealDeep,
          fontSize: theme.typography.sizes.sm,
          ...fontStyle("body", 600, fontsLoaded),
        },
        // The parent column stretches its children; flex-start keeps the ≥48px
        // TouchTargetLink box (and "Rename") hugging the left edge as before.
        renameLinkContainer: {
          alignSelf: "flex-start",
        },
        editBlock: { gap: theme.spacing.sm },
        nameInput: {
          backgroundColor: redesign.surface,
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
        editRow: { flexDirection: "row", gap: theme.spacing.sm },
        editBtn: {
          flex: 1,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.radii.md,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
          borderWidth: 1,
          borderColor: redesign.line,
          backgroundColor: redesign.surface,
        },
        editBtnPrimary: {
          backgroundColor: redesign.tealDeep,
          borderColor: redesign.teal,
        },
        editBtnText: {
          color: redesign.tealDeep,
          fontSize: theme.typography.sizes.sm,
          ...fontStyle("body", 600, fontsLoaded),
        },
        editBtnPrimaryText: {
          color: redesign.surface,
          fontSize: theme.typography.sizes.sm,
          ...fontStyle("body", 600, fontsLoaded),
        },
        renameError: {
          color: redesign.alarm,
          fontSize: theme.typography.sizes.sm,
          ...fontStyle("body", 400, fontsLoaded),
        },
        caveat: {
          color: redesign.ink3,
          fontSize: theme.typography.sizes.sm,
          lineHeight: theme.typography.sizes.sm * 1.4,
          ...fontStyle("body", 400, fontsLoaded),
        },
        row: {
          backgroundColor: redesign.surface,
          borderColor: redesign.line,
          borderWidth: 1,
          borderRadius: redesign.rCard,
          padding: theme.spacing.md,
          gap: theme.spacing.xs,
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
        ragChip: {
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs / 2,
          borderRadius: theme.radii.lg,
          flexShrink: 0,
        },
        ragChipText: {
          fontSize: theme.typography.sizes.xs,
          ...fontStyle("body", 600, fontsLoaded),
        },
        value: {
          color: redesign.ink2,
          fontSize: theme.typography.sizes.base,
          ...fontStyle("body", 400, fontsLoaded),
        },
        empty: {
          color: redesign.ink2,
          fontSize: theme.typography.sizes.base,
          textAlign: "center",
          padding: theme.spacing.lg,
          ...fontStyle("body", 400, fontsLoaded),
        },
        note: {
          color: redesign.ink3,
          fontSize: theme.typography.sizes.xs,
          marginTop: theme.spacing.sm,
          ...fontStyle("body", 400, fontsLoaded),
        },
        deleteButton: {
          minHeight: 48,
          justifyContent: "center",
          alignItems: "center",
          marginTop: theme.spacing.lg,
          paddingHorizontal: theme.spacing.md,
        },
        deleteButtonText: {
          color: redesign.alarmText,
          fontSize: theme.typography.sizes.base,
          ...fontStyle("body", 600, fontsLoaded),
        },
      }),
    [theme, redesign, fontsLoaded],
  );

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Text style={styles.title}>{name || "Report"}</Text>
      {subtitle.length > 0 && (
        <Text style={styles.subtitle}>
          {rows.length > 0
            ? `${subtitle} · ${rows.length} value${rows.length === 1 ? "" : "s"}`
            : subtitle}
        </Text>
      )}

      {editing ? (
        <View style={styles.editBlock}>
          <TextInput
            testID="report_detail_name_input"
            accessibilityLabel="Report name"
            autoFocus
            editable={!renaming}
            maxLength={120}
            onChangeText={setDraftName}
            placeholder="Report name"
            placeholderTextColor={redesign.ink3}
            style={styles.nameInput}
            value={draftName}
          />
          <View style={styles.editRow}>
            <Pressable
              testID="report_detail_rename_save"
              accessibilityRole="button"
              disabled={renaming}
              onPress={onSaveName}
              style={[styles.editBtn, styles.editBtnPrimary]}
            >
              <Text style={styles.editBtnPrimaryText}>Save</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={renaming}
              onPress={() => setEditing(false)}
              style={styles.editBtn}
            >
              <Text style={styles.editBtnText}>Cancel</Text>
            </Pressable>
          </View>
          {renameError && <Text style={styles.renameError}>{renameError}</Text>}
        </View>
      ) : (
        <TouchTargetLink
          testID="report_detail_rename"
          accessibilityLabel="Rename this report"
          label="Rename"
          onPress={() => {
            setDraftName(name);
            setEditing(true);
          }}
          textStyle={styles.renameLink}
          containerStyle={styles.renameLinkContainer}
        />
      )}

      <Text style={styles.caveat}>
        {`AI-generated from your report. ${STANDING_DISCLAIMER} Check with your doctor.`}
      </Text>

      {loading ? (
        <ActivityIndicator color={redesign.teal} />
      ) : rows.length === 0 ? (
        <Text style={styles.empty}>
          No saved values for this report.
        </Text>
      ) : (
        rows.map((obs) => {
          const rag = ragForRow(obs);
          const ragColors = rag ? tintByClass(redesign, rag.tint) : null;
          const value =
            obs.value_num != null
              ? formatMarkerValue(obs.code, obs.value_num)
              : (obs.value_text ?? "");
          return (
            <View key={obs.id} style={styles.row}>
              <View style={styles.rowHeader}>
                <Text style={styles.rowTitle} numberOfLines={2}>
                  {obs.display || obs.code}
                </Text>
                {rag && ragColors && (
                  <View style={[styles.ragChip, { backgroundColor: ragColors.bg }]}>
                    <Text style={[styles.ragChipText, { color: ragColors.fg }]}>
                      {rag.label}
                    </Text>
                  </View>
                )}
              </View>
              {value.length > 0 && (
                <Text style={styles.value} numberOfLines={2}>
                  {obs.unit ? `${value} ${obs.unit}` : value}
                </Text>
              )}
            </View>
          );
        })
      )}

      <Text style={styles.note}>
        Your original file is kept encrypted on this device — nothing is stored
        on our servers.
      </Text>

      <Pressable
        testID="report_detail_delete"
        accessibilityRole="button"
        accessibilityLabel="Delete this document"
        disabled={deleting || !dal}
        onPress={onDelete}
        style={styles.deleteButton}
      >
        <Text style={styles.deleteButtonText}>
          {deleting ? "Deleting…" : "Delete document"}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

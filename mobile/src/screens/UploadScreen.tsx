/**
 * UploadScreen — Phase 1 mobile (Wave 2 / mobile-upload-parse-builder).
 *
 * Flow:
 *   1. Render type picker (lab / ehr / visit) + source picker (PDF / image).
 *   2. On submit:
 *        a) Re-check `health_data_ai` consent. OFF → show banner, abort.
 *        b) Pick file via expo-document-picker / expo-image-picker.
 *        c) Generate report id, insert a `reports` row (parse_status=pending),
 *           encrypt + store the blob, mark parse_status=parsing.
 *        d) Extract text on-device (PDF text layer; image OCR deferred).
 *           If extraction fails or surfaces a known gap (scanned PDF /
 *           image OCR), mark parse_status=rejected with a summary describing
 *           the gap. Stay on this screen.
 *        e) POST extracted text to /api/parse-report.
 *        f) Navigate to UploadReview with the report id; pass the parsed
 *           envelope through navigation params.
 *
 * All styling via `useTheme()` — no hardcoded colors / sizes.
 */

import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import * as Crypto from "expo-crypto";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApiClient } from "@/auth";
import { PressableScale } from "@/components/PressableScale";
import type { LocalDataDAL, ReportRow, ReportType } from "@/contracts";
import { useDal } from "@/db/DalProvider";
import type { RootStackParamList } from "@/navigation/types";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import { storeBlob } from "../upload/blobStore";
import { fetchHealthDataAiConsent } from "../upload/consentClient";
import { extractText } from "../upload/extract";
import { pickImage, pickPdf, type PickedFile } from "../upload/picker";
import { parseReport } from "../upload/parseClient";
import type { ParseReportResponse } from "../upload/types";

type Nav = NativeStackNavigationProp<RootStackParamList, "MainTabs">;

// Free-form upload: the user uploads ANY health report; we read it on-device
// and the parser categorizes every value individually (each observation gets
// its own category: biomarker / vital / condition / …). The report-level type
// (lab/ehr/visit) is invisible metadata, so we default it rather than make the
// user pick — removing all upfront friction. (Auto-classifying the report-level
// type is a follow-up; it needs the row inserted after parse.)
const DEFAULT_REPORT_TYPE: ReportType = "lab";

type SourceKind = "pdf" | "image";

type Phase =
  | "idle"
  | "picking"
  | "storing"
  | "extracting"
  | "parsing"
  | "done"
  | "error";

interface ErrorState {
  message: string;
  /** Set when the gap is OCR-related so we can show a softer affordance. */
  isOcrGap?: boolean;
}

export function UploadScreen(): React.ReactElement {
  const api = useApiClient();
  const dal = useDal();
  const navigation = useNavigation<Nav>();
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const insets = useSafeAreaInsets();

  // Naming happens AFTER the parse, on the review screen (the report is
  // inserted here with its original filename as a placeholder). Keeps the
  // upload step friction-free.
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [error, setError] = React.useState<ErrorState | null>(null);
  const [consentReady, setConsentReady] = React.useState<boolean | null>(null);
  // Saved reports list — loaded on focus so it refreshes after each save.
  const [reports, setReports] = React.useState<ReportRow[]>([]);
  // ACTUAL value count per report (the stored summary_text can be stale after
  // dedup). Keyed by report id.
  const [reportCounts, setReportCounts] = React.useState<Map<string, number>>(
    new Map(),
  );

  // Re-check consent on every screen FOCUS (not just mount). The Upload
  // tab stays mounted in the bottom-tab navigator, so a mount-only effect
  // showed a stale "AI parsing is off" banner after the user enabled the
  // toggle in Settings and returned here. useFocusEffect re-reads on each
  // focus so the banner reflects the current consent. (2026-06-10 fix.)
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        const ok = await fetchHealthDataAiConsent(api);
        if (!cancelled) setConsentReady(ok);
        // Refresh the saved-reports list (so a just-saved report appears).
        const user = api.getCurrentUser();
        if (user && dal) {
          try {
            const list = await dal.listReports(user.userId);
            if (!cancelled) setReports(list);
            // Count the ACTUAL linked observations per report so the list
            // agrees with each report's detail (stored summary can be stale).
            const counts = new Map<string, number>();
            for (const r of list) {
              const obs = await dal.listObservations({ report_id: r.id });
              counts.set(r.id, obs.length);
            }
            if (!cancelled) setReportCounts(counts);
          } catch {
            // Non-fatal: the list just stays as-is.
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [api, dal]),
  );

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: redesign.paper },
        content: {
          padding: theme.spacing.space5,
          paddingTop: insets.top + theme.spacing.space5,
          gap: theme.spacing.space3,
        },
        // Mockup .scr-title: Bricolage display, ink.
        title: {
          color: redesign.ink,
          fontSize: theme.typography.sizes["2xl"],
          letterSpacing: -0.5,
          ...fontStyle("display", 700, fontsLoaded),
        },
        subtitle: {
          color: redesign.ink2,
          fontSize: theme.typography.sizes.base,
          lineHeight: theme.typography.sizes.base * 1.5,
          ...fontStyle("body", 400, fontsLoaded),
        },
        // Eyebrow.
        sectionLabel: {
          color: redesign.ink3,
          fontSize: 11,
          letterSpacing: 11 * 0.15,
          marginBottom: theme.spacing.xs,
          textTransform: "uppercase",
          ...fontStyle("body", 600, fontsLoaded),
        },
        input: {
          backgroundColor: redesign.surface,
          color: redesign.ink,
          borderColor: redesign.line,
          borderWidth: 1,
          borderRadius: theme.radii.lg,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          fontSize: theme.typography.sizes.base,
          minHeight: 48,
          ...fontStyle("body", 400, fontsLoaded),
        },
        // Mockup .cta: teal primary; .cta.ghost: surface + teal border.
        button: {
          backgroundColor: redesign.tealDeep,
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
          backgroundColor: redesign.surface,
          borderColor: redesign.line,
          borderWidth: 1,
          borderRadius: redesign.rCard,
          padding: theme.spacing.md,
        },
        bannerWarning: {
          borderColor: redesign.amber,
          backgroundColor: redesign.amberWash,
        },
        bannerError: {
          borderColor: redesign.alarm,
          backgroundColor: redesign.alarmWash,
        },
        bannerText: {
          color: redesign.ink,
          fontSize: theme.typography.sizes.sm,
          lineHeight: theme.typography.sizes.sm * 1.5,
          ...fontStyle("body", 400, fontsLoaded),
        },
        spinnerRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.sm,
        },
        reportsSection: {
          marginTop: theme.spacing.space3,
          gap: theme.spacing.sm,
        },
        reportCard: {
          backgroundColor: redesign.surface,
          borderColor: redesign.line,
          borderWidth: 1,
          borderRadius: redesign.rCard,
          padding: theme.spacing.md,
          minHeight: 48,
          gap: theme.spacing.xs / 2,
        },
        reportName: {
          color: redesign.ink,
          fontSize: theme.typography.sizes.base,
          ...fontStyle("body", 600, fontsLoaded),
        },
        // Date + summary, grey italics — the "underneath" line.
        reportMeta: {
          color: redesign.ink3,
          fontSize: theme.typography.sizes.sm,
          fontStyle: "italic",
          ...fontStyle("body", 400, fontsLoaded),
        },
      }),
    [theme, redesign, fontsLoaded, insets.top],
  );

  const busy = phase !== "idle" && phase !== "error" && phase !== "done";

  const runPipeline = React.useCallback(
    async (source: SourceKind) => {
      setError(null);

      // a) Consent re-check immediately before any pick. Defends against
      //    "user toggled consent OFF after mount" races.
      const consentOk = await fetchHealthDataAiConsent(api);
      setConsentReady(consentOk);
      if (!consentOk) {
        setError({
          message:
            "AI parsing is off in Settings. Turn on “Use my health data with AI” in Privacy & Data, then come back.",
        });
        return;
      }

      // b) Pick file.
      setPhase("picking");
      const picked = source === "pdf" ? await pickPdf() : await pickImage();
      if (!picked.ok) {
        if (picked.canceled) {
          setPhase("idle");
          return;
        }
        setError({
          message: messageForPickerError(picked.reason),
        });
        setPhase("error");
        return;
      }

      const user = api.getCurrentUser();
      if (!user) {
        setError({ message: "You're signed out. Sign in to upload." });
        setPhase("error");
        return;
      }

      if (!dal) {
        setError({
          message: "Storage is still opening on this device. Try again in a moment.",
        });
        setPhase("error");
        return;
      }

      const reportId = Crypto.randomUUID();
      // Placeholder name (the picked filename); the user names it on review.
      const fileName = picked.file.name;

      // c) Insert reports row (pending), then encrypt + store the blob.
      let blobUri: string;
      try {
        // We can't write the real `file_blob_ref` until storeBlob returns,
        // so we insert with a placeholder and update via parse_status path.
        // Simpler: store the blob FIRST (cheap on disk), then insert the row
        // with the real ref. The DAL contract doesn't expose an update to
        // file_blob_ref, so doing it in this order avoids needing one.
        setPhase("storing");
        blobUri = await storeBlob(reportId, picked.file.uri);
        await dal.insertReport({
          id: reportId,
          user_id: user.userId,
          type: DEFAULT_REPORT_TYPE,
          file_blob_ref: blobUri,
          original_filename: fileName,
          parse_status: "parsing",
        });
      } catch (err) {
        setError({
          message:
            "Couldn't save the file securely on your device. Free up some space and try again.",
        });
        setPhase("error");
        console.warn("[Upload] storeBlob/insertReport failed", err);
        return;
      }

      // d) Extract text on-device.
      setPhase("extracting");
      const extracted = await extractText(picked.file, reportId);
      if (!extracted.ok) {
        const isOcrGap =
          extracted.reason === "ocr_not_supported_phase_1" ||
          extracted.reason === "pdf_has_no_text_layer";
        // Canonical "scanned / image" copy per the STEP 2 UX update — same
        // message for both image picks AND scanned PDFs, since the user-
        // visible problem is identical: no selectable text. § D12 records
        // the deferral; the in-product copy must match this string.
        const scannedOrImageCopy =
          "This file looks like a scanned image or photo. For now, please upload a PDF with selectable text. Image and scan support is coming in a future release.";
        const summary = isOcrGap
          ? scannedOrImageCopy
          : "Couldn't read this file. Please try a different document.";
        await safeUpdateStatus(dal, reportId, "rejected", summary);
        setError({ message: summary, isOcrGap });
        setPhase("error");
        return;
      }

      // e) POST to /api/parse-report.
      setPhase("parsing");
      let parsed: ParseReportResponse;
      try {
        parsed = await parseReport(api, {
          reportType: DEFAULT_REPORT_TYPE,
          extractedText: extracted.text,
        });
      } catch (err) {
        await safeUpdateStatus(
          dal,
          reportId,
          "rejected",
          "Parse failed. Try again later.",
        );
        setError({
          message: "Couldn't parse the report. Please try again in a moment.",
        });
        setPhase("error");
        console.warn("[Upload] parseReport failed", err);
        return;
      }

      // f) Navigate to review. We pass the report id; the review screen
      //    receives the parsed payload via a module-level handoff to keep
      //    nav params small (RN nav warns on large param payloads).
      stashParsePayload(reportId, parsed);
      setPhase("done");
      navigation.navigate("UploadReview", { reportId });
    },
    [api, dal, navigation],
  );

  const renderConsentBanner = () => {
    if (consentReady === null) return null;
    if (consentReady) return null;
    return (
      <View
        accessibilityRole="alert"
        style={[styles.banner, styles.bannerWarning]}
      >
        <Text style={styles.bannerText}>
          AI parsing is off in Settings. Turn on &ldquo;Use my health data with
          AI&rdquo; in Privacy &amp; Data to upload and parse a report.
        </Text>
      </View>
    );
  };

  const renderError = () => {
    if (!error) return null;
    return (
      <View
        accessibilityRole="alert"
        style={[styles.banner, styles.bannerError]}
      >
        <Text style={styles.bannerText}>{error.message}</Text>
      </View>
    );
  };

  const renderProgress = () => {
    if (!busy) return null;
    const label =
      phase === "picking"
        ? "Choosing your file…"
        : phase === "storing"
          ? "Saving securely on your device…"
          : phase === "extracting"
            ? "Reading the document on this device…"
            : phase === "parsing"
              ? "Asking the AI to extract values…"
              : "Working…";
    return (
      <View style={[styles.banner, styles.spinnerRow]}>
        <ActivityIndicator color={redesign.teal} />
        <Text style={styles.bannerText}>{label}</Text>
      </View>
    );
  };

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      style={styles.screen}
      keyboardShouldPersistTaps="handled"
    >
      <Text style={styles.title}>Upload a report</Text>
      <Text style={styles.subtitle}>
        Upload any health report — we read it here and pull out the values.
      </Text>
      <Text style={styles.subtitle}>
        Your file never leaves your phone; only the text is sent for parsing.
      </Text>

      {renderConsentBanner()}

      {renderProgress()}
      {renderError()}

      <PressableScale
        testID="upload_pick_pdf"
        haptic
        accessibilityRole="button"
        disabled={busy || consentReady !== true}
        onPress={() => runPipeline("pdf")}
        style={[
          styles.button,
          (busy || consentReady !== true) && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.buttonText}>Pick a PDF</Text>
      </PressableScale>

      <PressableScale
        testID="upload_pick_image"
        accessibilityRole="button"
        disabled={busy || consentReady !== true}
        onPress={() => runPipeline("image")}
        style={[
          styles.button,
          styles.buttonSecondary,
          (busy || consentReady !== true) && styles.buttonDisabled,
        ]}
      >
        <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
          Pick a photo
        </Text>
      </PressableScale>

      {reports.length > 0 && (
        <View style={styles.reportsSection}>
          <Text style={styles.sectionLabel}>Your reports</Text>
          {reports.map((r) => (
            <Pressable
              key={r.id}
              testID={`upload_report_row_${r.id}`}
              accessibilityRole="button"
              accessibilityLabel={`${r.original_filename}. Open report.`}
              onPress={() =>
                navigation.navigate("ReportDetail", { reportId: r.id })
              }
              style={({ pressed }) => [
                styles.reportCard,
                pressed && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.reportName} numberOfLines={1}>
                {r.original_filename}
              </Text>
              <Text style={styles.reportMeta} numberOfLines={1}>
                {formatReportMeta(r, reportCounts.get(r.id))}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

/**
 * "Added Jun 17, 2026 · 4 values" — the grey-italics list subtitle. The count
 * is the ACTUAL linked-observation count (passed in), not the stored summary,
 * so it always agrees with the report's detail. undefined = still counting.
 */
function formatReportMeta(r: ReportRow, count: number | undefined): string {
  const d = new Date(r.uploaded_at);
  const date = Number.isNaN(d.getTime())
    ? r.uploaded_at
    : d.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
  if (count === undefined) return `Added ${date}`;
  if (count === 0) return `Added ${date} · no values`;
  return `Added ${date} · ${count} value${count === 1 ? "" : "s"}`;
}

// ── Helpers ──────────────────────────────────────────────────────────────

function messageForPickerError(reason: string): string {
  switch (reason) {
    case "permission_denied":
      return "Photo-library permission was denied. Enable it in Settings to pick an image.";
    case "file_too_large":
      return "That file is bigger than 15 MB. Try a smaller export.";
    case "unsupported_type":
      return "That file type isn't supported. Pick a PDF or a photo.";
    default:
      return "Couldn't pick that file. Please try again.";
  }
}

async function safeUpdateStatus(
  dal: LocalDataDAL,
  reportId: string,
  status: "rejected" | "partial" | "confirmed",
  summary: string,
): Promise<void> {
  try {
    await dal.updateReportParseStatus(reportId, status, summary);
  } catch {
    // Best-effort; the report row exists with status='parsing' which the
    // user can resolve by deleting from the timeline.
  }
}

// ── Cross-screen parse payload handoff ───────────────────────────────────
//
// React Navigation discourages large params. We cache the parsed envelope
// here keyed by reportId; UploadReviewScreen reads + clears on mount.

const parsePayloads = new Map<string, ParseReportResponse>();

export function stashParsePayload(
  reportId: string,
  payload: ParseReportResponse,
): void {
  parsePayloads.set(reportId, payload);
}

export function takeParsePayload(
  reportId: string,
): ParseReportResponse | undefined {
  const value = parsePayloads.get(reportId);
  parsePayloads.delete(reportId);
  return value;
}

// suppress unused-import lints for the optional Alert API; surfaces emerge
// in Pass 2 if we need a confirmation modal on cancel.
void Alert;

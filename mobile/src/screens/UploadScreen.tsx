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

import { useNavigation } from "@react-navigation/native";
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

import { useApiClient } from "@/auth";
import type { LocalDataDAL, ReportType } from "@/contracts";
import { useDal } from "@/db/DalProvider";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/useTheme";

import { storeBlob } from "../upload/blobStore";
import { fetchHealthDataAiConsent } from "../upload/consentClient";
import { extractText } from "../upload/extract";
import { pickImage, pickPdf, type PickedFile } from "../upload/picker";
import { parseReport } from "../upload/parseClient";
import type { ParseReportResponse } from "../upload/types";

type Nav = NativeStackNavigationProp<RootStackParamList, "MainTabs">;

const REPORT_TYPES: ReadonlyArray<{ value: ReportType; label: string; hint: string }> = [
  { value: "lab", label: "Lab results", hint: "A1c, glucose, lipid panel, etc." },
  { value: "ehr", label: "EHR export", hint: "Records from your patient portal." },
  { value: "visit", label: "Visit summary", hint: "After-visit summary or discharge papers." },
];

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
  const { active, theme } = useTheme();

  const [reportType, setReportType] = React.useState<ReportType>("lab");
  const [reportName, setReportName] = React.useState<string>("");
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [error, setError] = React.useState<ErrorState | null>(null);
  const [consentReady, setConsentReady] = React.useState<boolean | null>(null);

  // Check consent on mount and whenever the screen is focused. Cheap.
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await fetchHealthDataAiConsent(api);
      if (!cancelled) setConsentReady(ok);
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

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
        subtitle: {
          color: active.textSecondary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
        },
        sectionLabel: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.sm,
          fontWeight: "600",
          marginBottom: theme.spacing.xs,
        },
        typeCard: {
          backgroundColor: active.bgSecondary,
          borderColor: active.border,
          borderWidth: 1,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.md,
          marginBottom: theme.spacing.sm,
          minHeight: 44,
        },
        typeCardActive: {
          borderColor: active.accentPrimary,
          backgroundColor: active.bgTertiary,
        },
        typeLabel: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
          fontWeight: "600",
        },
        typeHint: {
          color: active.textSecondary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.sm,
        },
        input: {
          backgroundColor: active.bgSecondary,
          color: active.textPrimary,
          borderColor: active.border,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
          minHeight: 44,
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
          borderColor: active.border,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
        },
        bannerWarning: {
          borderColor: active.warning,
        },
        bannerError: {
          borderColor: active.error,
        },
        bannerText: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.sm,
          lineHeight: theme.typography.sizes.sm * theme.typography.lineHeights.normal,
        },
        spinnerRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.sm,
        },
      }),
    [active, theme],
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
      const fileName =
        reportName.trim().length > 0
          ? reportName.trim()
          : picked.file.name;

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
          type: reportType,
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
        const summary =
          extracted.reason === "ocr_not_supported_phase_1"
            ? "Image OCR is not yet available on this device. Your file is saved."
            : extracted.reason === "pdf_has_no_text_layer"
              ? "This looks like a scanned PDF. We can't read scans yet. Your file is saved."
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
          reportType,
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
    [api, dal, navigation, reportName, reportType],
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
        <ActivityIndicator color={active.accentPrimary} />
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
        Pick a PDF or photo from your phone. Your file stays on this device
        — only the typed-out text is sent to the AI for parsing, and nothing
        is stored on our servers.
      </Text>

      {renderConsentBanner()}

      <View>
        <Text style={styles.sectionLabel}>What kind of report?</Text>
        {REPORT_TYPES.map((opt) => {
          const isActive = opt.value === reportType;
          return (
            <Pressable
              key={opt.value}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              disabled={busy}
              onPress={() => setReportType(opt.value)}
              style={({ pressed }) => [
                styles.typeCard,
                isActive && styles.typeCardActive,
                pressed && styles.buttonDisabled,
              ]}
            >
              <Text style={styles.typeLabel}>{opt.label}</Text>
              <Text style={styles.typeHint}>{opt.hint}</Text>
            </Pressable>
          );
        })}
      </View>

      <View>
        <Text style={styles.sectionLabel}>Name (optional)</Text>
        <TextInput
          accessibilityLabel="Report name"
          editable={!busy}
          maxLength={120}
          onChangeText={setReportName}
          placeholder="e.g. May 2026 A1c"
          placeholderTextColor={active.textMuted}
          style={styles.input}
          value={reportName}
        />
      </View>

      {renderProgress()}
      {renderError()}

      <Pressable
        accessibilityRole="button"
        disabled={busy || consentReady !== true}
        onPress={() => runPipeline("pdf")}
        style={({ pressed }) => [
          styles.button,
          (busy || consentReady !== true || pressed) && styles.buttonDisabled,
        ]}
      >
        <Text style={styles.buttonText}>Pick a PDF</Text>
      </Pressable>

      <Pressable
        accessibilityRole="button"
        disabled={busy || consentReady !== true}
        onPress={() => runPipeline("image")}
        style={({ pressed }) => [
          styles.button,
          styles.buttonSecondary,
          (busy || consentReady !== true || pressed) && styles.buttonDisabled,
        ]}
      >
        <Text style={[styles.buttonText, styles.buttonTextSecondary]}>
          Pick a photo
        </Text>
      </Pressable>
    </ScrollView>
  );
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

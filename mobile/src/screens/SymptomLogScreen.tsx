/**
 * SymptomLogScreen — log a symptom severity (2026-07 symptom tracker).
 *
 * The unlicensed replacement for the removed scored instruments: pick a
 * symptom → pick a plain 0–3 severity (None / Mild / Moderate / Severe) → save.
 * Each save commits ONE append-only observation (buildSymptomObservation), the
 * same model as a manually-logged marker. No score, no interpretation.
 *
 * Reached from the "Log a symptom" CTA on a symptom DomainDetail. Route params:
 *   - `domainId` scopes the picker to one symptom domain (sleep / urinary /
 *     menopause / hormonal); absent → all cohort-relevant symptoms.
 *   - `symptomKey` pre-selects a symptom (skips the picker).
 *
 * Cohort gating (sex_at_birth) is applied via `symptomsFor` — the screen never
 * offers a symptom the user's cohort shouldn't see. Clinical boundary: severity
 * labels describe the user's OWN self-report; the screen makes no verdict.
 */

import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronLeft } from "lucide-react-native";
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApiClient } from "@/auth";
import { PressableScale } from "@/components/PressableScale";
import { Skeleton } from "@/components/Skeleton";
import type { SexAtBirth } from "@/contracts";
import { useDal } from "@/db/DalProvider";
import { hapticSelection, hapticSuccess } from "@/feedback/haptics";
import type { RootStackParamList } from "@/navigation/types";
import { STANDING_DISCLAIMER } from "@/screens/timeline/displayMapping";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import {
  SEVERITY_OPTIONS,
  type SymptomDef,
  symptomsFor,
} from "./symptoms/symptomCatalog";
import { buildSymptomObservation } from "./symptoms/symptomLog";

type Nav = NativeStackNavigationProp<RootStackParamList, "SymptomLog">;
type Route = RouteProp<RootStackParamList, "SymptomLog">;

export function SymptomLogScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const domainId = route.params?.domainId;
  const presetKey = route.params?.symptomKey;

  const api = useApiClient();
  const dal = useDal();
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const insets = useSafeAreaInsets();

  const [sexAtBirth, setSexAtBirth] = React.useState<SexAtBirth | null>(null);
  const [profileLoading, setProfileLoading] = React.useState(true);
  const [selectedKey, setSelectedKey] = React.useState<string | null>(
    presetKey ?? null,
  );
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (dal == null) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await dal.getProfile();
        if (!cancelled) setSexAtBirth(profile?.sex_at_birth ?? null);
      } catch {
        if (!cancelled) setSexAtBirth(null);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dal]);

  // Cohort-relevant symptoms, scoped to the domain when one was passed.
  const symptoms = React.useMemo<ReadonlyArray<SymptomDef>>(
    () =>
      symptomsFor(sexAtBirth).filter(
        (s) => domainId == null || s.domain === domainId,
      ),
    [sexAtBirth, domainId],
  );

  const selected = React.useMemo(
    () => symptoms.find((s) => s.key === selectedKey) ?? null,
    [symptoms, selectedKey],
  );

  const onPickSeverity = React.useCallback(
    async (severity: number) => {
      if (selected == null || dal == null) return;
      const userId = api.getCurrentUser()?.userId ?? null;
      if (userId == null) {
        setErrorMsg("You need to be signed in to log a symptom.");
        return;
      }
      setSubmitting(true);
      setErrorMsg(null);
      try {
        const obs = buildSymptomObservation({
          symptom: selected,
          severity,
          userId,
          effectiveAt: new Date().toISOString(),
        });
        await dal.insertObservation(obs);
        hapticSuccess();
        navigation.goBack();
      } catch (e) {
        setErrorMsg(
          e instanceof Error ? `Could not save: ${e.message}` : "Could not save.",
        );
        setSubmitting(false);
      }
    },
    [api, dal, navigation, selected],
  );

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: redesign.paper },
        header: {
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.space3 - 2,
          paddingHorizontal: theme.spacing.space5,
          paddingTop: insets.top + theme.spacing.md,
          paddingBottom: theme.spacing.md,
        },
        backButton: {
          minWidth: 48,
          minHeight: 48,
          borderRadius: redesign.rChip,
          backgroundColor: redesign.tealWash,
          alignItems: "center",
          justifyContent: "center",
        },
        title: {
          color: redesign.ink,
          fontSize: theme.typography.sizes["2xl"] - 2,
          letterSpacing: -0.44,
          flexShrink: 1,
          ...fontStyle("display", 700, fontsLoaded),
        },
        scroll: {
          padding: theme.spacing.space5,
          gap: theme.spacing.space3,
        },
        prompt: {
          color: redesign.ink2,
          fontSize: theme.typography.sizes.base,
          lineHeight: theme.typography.sizes.base * 1.5,
          ...fontStyle("body", 400, fontsLoaded),
        },
        card: {
          borderColor: redesign.line,
          borderWidth: 1,
          borderRadius: redesign.rCard,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          backgroundColor: redesign.surface,
          minHeight: 48,
          justifyContent: "center",
        },
        cardLabel: {
          color: redesign.ink,
          fontSize: theme.typography.sizes.base,
          ...fontStyle("body", 500, fontsLoaded),
        },
        // Vertical stack of full-width option buttons (matches the symptom
        // picker, cohort steps, and check-in menu). The prior 45%-basis wrap row
        // packed the four options edge-to-edge with no horizontal padding, so the
        // labels were cramped + hard to read (45+ readability regression).
        severityRow: {
          gap: theme.spacing.sm,
        },
        severityButton: {
          borderColor: redesign.line,
          borderWidth: 1,
          borderRadius: redesign.rCard,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 52,
          backgroundColor: redesign.surface,
        },
        severityLabel: {
          color: redesign.ink,
          fontSize: theme.typography.sizes.lg,
          ...fontStyle("body", 600, fontsLoaded),
        },
        error: { color: redesign.alarm, fontSize: theme.typography.sizes.sm },
        disclaimer: {
          color: redesign.ink3,
          fontSize: theme.typography.sizes.xs,
          lineHeight: theme.typography.sizes.xs * 1.45,
          marginTop: theme.spacing.sm,
          ...fontStyle("body", 400, fontsLoaded),
        },
      }),
    [theme, redesign, fontsLoaded, insets.top],
  );

  const headerTitle = selected != null ? selected.display : "Log a symptom";

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          testID="symptom_log_back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={12}
        >
          <ChevronLeft color={redesign.tealDeep} size={22} />
        </Pressable>
        <Text style={styles.title}>{headerTitle}</Text>
      </View>

      {profileLoading ? (
        <View style={styles.scroll}>
          <Skeleton width="70%" height={18} radius={6} />
          <Skeleton height={64} radius={redesign.rCard} />
          <Skeleton height={64} radius={redesign.rCard} />
        </View>
      ) : selected == null ? (
        // ── Symptom picker ──────────────────────────────────────────────
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.prompt}>
            Which symptom would you like to track?
          </Text>
          {symptoms.map((s) => (
            <Pressable
              key={s.key}
              testID={`symptom_pick_${s.key}`}
              accessibilityRole="button"
              accessibilityLabel={s.display}
              style={styles.card}
              onPress={() => {
                hapticSelection();
                setSelectedKey(s.key);
              }}
            >
              <Text style={styles.cardLabel}>{s.display}</Text>
            </Pressable>
          ))}
          <Text style={styles.disclaimer}>{STANDING_DISCLAIMER}</Text>
        </ScrollView>
      ) : (
        // ── Severity picker ─────────────────────────────────────────────
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.prompt}>
            Over the past week, how much has this bothered you?
          </Text>
          <View style={styles.severityRow}>
            {SEVERITY_OPTIONS.map((opt) => (
              <PressableScale
                key={opt.value}
                testID={`symptom_severity_${opt.value}`}
                haptic
                accessibilityRole="button"
                accessibilityLabel={opt.label}
                disabled={submitting}
                onPress={() => void onPickSeverity(opt.value)}
                style={styles.severityButton}
              >
                <Text style={styles.severityLabel}>{opt.label}</Text>
              </PressableScale>
            ))}
          </View>
          {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}
          <Text style={styles.disclaimer}>{STANDING_DISCLAIMER}</Text>
        </ScrollView>
      )}
    </View>
  );
}

/**
 * InstrumentsScreen — Wave 2 (mobile-onboarding-builder).
 *
 * Runs the validated-instrument battery selected by `instrumentsFor`
 * (sex-branched). Each instrument:
 *
 *   1. Renders the canonical published items in order (verbatim wording).
 *   2. Records each item response as an observation:
 *      category="questionnaire", code_system from the instrument
 *      (LOINC for PHQ-9/PHQ-2/GAD-7/AUDIT-C/Epworth; "internal" for
 *      MRS/ADAM/IPSS), code=instrument's per-item code, value_num=response.
 *   3. Computes the canonical score and writes a SUMMARY observation
 *      using the instrument's LOINC panel code (or internal stable code)
 *      with value_num=score.
 *
 * LOAD-BEARING 988 SAFETY FLOW (PHQ-9 item 9):
 *   - When the user selects any response > 0 on item 9, the 988 modal
 *     opens IMMEDIATELY, before the response is recorded.
 *   - The observation is recorded ONLY after the user taps "I understand".
 *   - The modal is dismissible only via the explicit acknowledgement.
 *   - tel:988 and sms:988 link out via React Native's Linking module —
 *     both schemes work on iOS and Android.
 *
 * Per the agent hard rule: "Do not ship PHQ-9 without the 988 surface,
 * ever." This implementation wires PHQ-9 with the 988 surface. PHQ-2 is
 * available as the deferral fallback but is NOT in the active battery.
 */
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useApiClient } from "@/auth";
import type { ObservationInsertInput } from "@/contracts";
import { useDal } from "@/db/DalProvider";
import type { RootStackParamList } from "@/navigation/types";
import { Crisis988Modal } from "@/onboarding/Crisis988Modal";
import { fw } from "@/onboarding/fontWeight";
import {
  instrumentsFor,
  PHQ9_ITEM_9_INDEX,
  shouldShow988,
  type InstrumentDefinition,
} from "@/onboarding/instruments";
import { useTheme } from "@/theme/useTheme";

type Nav = NativeStackNavigationProp<RootStackParamList, "Instruments">;

interface PendingItem9 {
  instrumentIndex: number;
  value: number;
}

export function InstrumentsScreen(): React.ReactElement {
  const api = useApiClient();
  const dal = useDal();
  const navigation = useNavigation<Nav>();
  const { active, theme } = useTheme();

  const [sexAtBirth, setSexAtBirth] = React.useState<
    "male" | "female" | "intersex" | "unknown" | null
  >(null);
  const [profileLoading, setProfileLoading] = React.useState(true);

  // Load sex_at_birth from the local profile to branch the battery.
  React.useEffect(() => {
    if (dal == null) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await dal.getProfile();
        if (cancelled) return;
        setSexAtBirth(profile?.sex_at_birth ?? null);
      } catch {
        if (cancelled) return;
        setSexAtBirth(null);
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dal]);

  const battery = React.useMemo(
    () => instrumentsFor(sexAtBirth),
    [sexAtBirth],
  );

  // Per-instrument response arrays. Initialized to null per item.
  const [responses, setResponses] = React.useState<Array<Array<number | null>>>(
    [],
  );
  React.useEffect(() => {
    setResponses(battery.map((inst) => inst.items.map(() => null)));
  }, [battery]);

  const [currentIdx, setCurrentIdx] = React.useState(0);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // 988 modal state — when set, we hold back the item-9 update until ack.
  const [pendingItem9, setPendingItem9] = React.useState<PendingItem9 | null>(
    null,
  );

  const currentInstrument: InstrumentDefinition | undefined =
    battery[currentIdx];

  const setResponseAt = React.useCallback(
    (instrumentIndex: number, itemIndex: number, value: number) => {
      setResponses((prev) => {
        const next = prev.map((arr) => [...arr]);
        next[instrumentIndex][itemIndex] = value;
        return next;
      });
    },
    [],
  );

  const onSelectItemResponse = React.useCallback(
    (itemIndex: number, value: number) => {
      const inst = battery[currentIdx];
      if (!inst) return;
      // LOAD-BEARING: PHQ-9 item 9 → defer the update until 988 ack.
      if (
        inst.id === "PHQ-9" &&
        itemIndex === PHQ9_ITEM_9_INDEX &&
        value > 0
      ) {
        setPendingItem9({ instrumentIndex: currentIdx, value });
        return;
      }
      setResponseAt(currentIdx, itemIndex, value);
    },
    [battery, currentIdx, setResponseAt],
  );

  const acknowledge988 = React.useCallback(() => {
    if (pendingItem9 == null) return;
    setResponseAt(
      pendingItem9.instrumentIndex,
      PHQ9_ITEM_9_INDEX,
      pendingItem9.value,
    );
    setPendingItem9(null);
  }, [pendingItem9, setResponseAt]);

  const persistInstrument = React.useCallback(
    async (
      inst: InstrumentDefinition,
      values: Array<number | null>,
    ): Promise<void> => {
      const userId = api.getCurrentUser()?.userId ?? null;
      if (dal == null || userId == null) {
        throw new Error("Local database not ready");
      }
      const now = new Date().toISOString();

      // Per-item observations
      for (let i = 0; i < inst.items.length; i++) {
        const v = values[i];
        if (v == null) continue; // skip unanswered items
        const item = inst.items[i];
        const obs: ObservationInsertInput = {
          user_id: userId,
          category: "questionnaire",
          code_system: inst.codeSystem,
          code: item.itemCode,
          display: `${inst.displayName} item ${item.number}`,
          value_num: v,
          value_text: null,
          unit: null,
          source: "self_reported",
          effective_at: now,
          report_id: null,
          supersedes_id: null,
          metadata_json: JSON.stringify({
            instrument: inst.id,
            itemNumber: item.number,
            itemText: item.text,
          }),
        };
        await dal.insertObservation(obs);
      }

      // Summary observation
      const score = inst.score(values);
      if (score != null) {
        const summary: ObservationInsertInput = {
          user_id: userId,
          category: "questionnaire",
          code_system: inst.codeSystem,
          code: inst.loincCode,
          display: `${inst.displayName} total score`,
          value_num: score,
          value_text: inst.interpret ? inst.interpret(score) : null,
          unit: null,
          source: "derived",
          effective_at: now,
          report_id: null,
          supersedes_id: null,
          metadata_json: JSON.stringify({
            instrument: inst.id,
            scoreRange:
              inst.id === "PHQ-9"
                ? "0-27"
                : inst.id === "PHQ-2"
                  ? "0-6"
                  : inst.id === "GAD-7"
                    ? "0-21"
                    : inst.id === "AUDIT-C"
                      ? "0-12"
                      : inst.id === "Epworth"
                        ? "0-24"
                        : inst.id === "MRS"
                          ? "0-44"
                          : inst.id === "ADAM"
                            ? "yes-count 0-10"
                            : "0-35",
          }),
        };
        await dal.insertObservation(summary);
      }
    },
    [api, dal],
  );

  const nextInstrument = React.useCallback(async () => {
    const inst = currentInstrument;
    if (!inst) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      await persistInstrument(inst, responses[currentIdx] ?? []);
      if (currentIdx + 1 < battery.length) {
        setCurrentIdx((i) => i + 1);
      } else {
        navigation.navigate("MainTabs");
      }
    } catch (e) {
      setErrorMsg(
        e instanceof Error
          ? `Could not save: ${e.message}`
          : "Could not save responses.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    battery.length,
    currentIdx,
    currentInstrument,
    navigation,
    persistInstrument,
    responses,
  ]);

  const skipInstrument = React.useCallback(() => {
    if (currentIdx + 1 < battery.length) {
      setCurrentIdx((i) => i + 1);
    } else {
      navigation.navigate("MainTabs");
    }
  }, [battery.length, currentIdx, navigation]);

  // 988 confirmation banner — shows after acknowledgement, before the user
  // proceeds, so the next-step affordance is visible.
  const showedSafety = React.useMemo(
    () => shouldShow988(responses[currentIdx] ?? []),
    [responses, currentIdx],
  );

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: active.bgPrimary },
        scroll: { padding: theme.spacing.lg, gap: theme.spacing.lg },
        header: {
          fontSize: theme.typography.sizes.sm,
          color: active.textSecondary,
          textTransform: "uppercase",
          letterSpacing: 1,
        },
        title: {
          fontSize: theme.typography.sizes["2xl"],
          fontFamily: theme.typography.fonts.serif,
          color: active.textPrimary,
          fontWeight: fw(theme.typography.weights.bold),
        },
        leadIn: {
          fontSize: theme.typography.sizes.base,
          color: active.textSecondary,
          lineHeight:
            theme.typography.sizes.base * theme.typography.lineHeights.relaxed,
        },
        itemBlock: { gap: theme.spacing.sm },
        itemText: {
          fontSize: theme.typography.sizes.base,
          color: active.textPrimary,
          lineHeight:
            theme.typography.sizes.base * theme.typography.lineHeights.normal,
        },
        chipRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
        chip: {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radii.md,
          borderColor: active.border,
          borderWidth: 1,
          backgroundColor: active.bgSecondary,
          minHeight: 40,
        },
        chipSelected: {
          borderColor: active.accentPrimary,
          backgroundColor: active.bgTertiary,
        },
        chipLabel: {
          color: active.textPrimary,
          fontSize: theme.typography.sizes.sm,
        },
        safetyBanner: {
          backgroundColor: theme.colors.conditions.light.healthRed.bg,
          borderColor: theme.colors.conditions.light.healthRed.base,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
        },
        safetyBannerText: {
          color: active.textPrimary,
          fontSize: theme.typography.sizes.sm,
        },
        actions: {
          flexDirection: "row",
          gap: theme.spacing.sm,
          marginTop: theme.spacing.md,
        },
        primary: {
          flex: 1,
          backgroundColor: active.accentPrimary,
          paddingVertical: theme.spacing.md,
          borderRadius: theme.radii.md,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
        },
        secondary: {
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radii.md,
          backgroundColor: active.bgSecondary,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
        },
        primaryLabel: {
          color: active.bgPrimary,
          fontSize: theme.typography.sizes.base,
          fontWeight: fw(theme.typography.weights.semibold),
        },
        secondaryLabel: {
          color: active.textPrimary,
          fontSize: theme.typography.sizes.base,
        },
        error: {
          color: theme.colors.conditions.light.healthRed.base,
          fontSize: theme.typography.sizes.sm,
        },
        emptyScreen: { flex: 1, alignItems: "center", justifyContent: "center", padding: theme.spacing.lg },
        emptyText: { color: active.textSecondary },
      }),
    [active, theme],
  );

  if (profileLoading) {
    return (
      <View style={styles.emptyScreen}>
        <ActivityIndicator color={active.accentPrimary} />
        <Text style={[styles.emptyText, { marginTop: theme.spacing.sm }]}>Loading…</Text>
      </View>
    );
  }

  if (currentInstrument == null) {
    return (
      <View style={styles.emptyScreen}>
        <Text style={styles.emptyText}>No instruments to complete.</Text>
        <Pressable
          style={[styles.primary, { marginTop: theme.spacing.md }]}
          onPress={() => navigation.navigate("MainTabs")}
          accessibilityRole="button"
        >
          <Text style={styles.primaryLabel}>Continue</Text>
        </Pressable>
      </View>
    );
  }

  const itemValues = responses[currentIdx] ?? [];
  const allAnswered = currentInstrument.items.every(
    (_, idx) => itemValues[idx] != null,
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.header}>
          Questionnaire {currentIdx + 1} of {battery.length}
        </Text>
        <Text style={styles.title}>{currentInstrument.displayName}</Text>
        <Text style={styles.leadIn}>
          {currentInstrument.id === "PHQ-9"
            ? "Over the last 2 weeks, how often have you been bothered by any of the following problems?"
            : currentInstrument.id === "GAD-7"
              ? "Over the last 2 weeks, how often have you been bothered by the following problems?"
              : currentInstrument.id === "AUDIT-C"
                ? "The next questions are about your use of alcoholic beverages during the past year."
                : currentInstrument.id === "Epworth"
                  ? "How likely are you to doze off or fall asleep in the following situations, in contrast to feeling just tired?"
                  : currentInstrument.id === "MRS"
                    ? "Which of the following symptoms apply to you at this time?"
                    : currentInstrument.id === "ADAM"
                      ? "Please answer yes or no to each of the following questions."
                      : currentInstrument.id === "IPSS"
                        ? "Over the past month, how often have you had the following symptoms?"
                        : ""}
        </Text>

        {showedSafety ? (
          <View style={styles.safetyBanner}>
            <Text style={styles.safetyBannerText}>
              You acknowledged the crisis resource notice. If anything changes,
              call or text 988 — it&apos;s free, confidential, and available 24/7.
            </Text>
          </View>
        ) : null}

        {currentInstrument.items.map((item, idx) => {
          const selectedValue = itemValues[idx];
          return (
            <View key={item.itemCode} style={styles.itemBlock}>
              <Text style={styles.itemText}>
                {item.number}. {item.text}
              </Text>
              <View style={styles.chipRow}>
                {currentInstrument.responseOptions.map((opt) => {
                  const selected = selectedValue === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      style={[styles.chip, selected && styles.chipSelected]}
                      onPress={() => onSelectItemResponse(idx, opt.value)}
                      disabled={submitting}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      accessibilityLabel={`Item ${item.number}: ${opt.label}`}
                    >
                      <Text style={styles.chipLabel}>{opt.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          );
        })}

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

        <View style={styles.actions}>
          <Pressable
            style={styles.secondary}
            onPress={skipInstrument}
            disabled={submitting}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryLabel}>Skip</Text>
          </Pressable>
          <Pressable
            style={styles.primary}
            onPress={nextInstrument}
            disabled={submitting || !allAnswered}
            accessibilityRole="button"
            accessibilityState={{ disabled: submitting || !allAnswered }}
          >
            {submitting ? (
              <ActivityIndicator color={active.bgPrimary} />
            ) : (
              <Text style={styles.primaryLabel}>
                {currentIdx + 1 < battery.length ? "Save and next" : "Finish"}
              </Text>
            )}
          </Pressable>
        </View>
      </ScrollView>

      <Crisis988Modal
        visible={pendingItem9 != null}
        onAcknowledge={acknowledge988}
      />
    </View>
  );
}

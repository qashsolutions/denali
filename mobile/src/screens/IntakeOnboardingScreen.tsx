/**
 * IntakeOnboardingScreen — Wave 2 (mobile-onboarding-builder).
 *
 * Four intake sections, each writing to LocalDataDAL.insertObservation
 * (or insertCondition when the user's free-text condition maps cleanly
 * to the canonical ConditionCategory enum).
 *
 *   1. Chief complaint — symptom name + onset date + severity (0-10).
 *      Stored as an observation: category="symptom", code_system="internal",
 *      effective_at=onset date, value_num=severity, value_text=symptom name.
 *
 *   2. Medical history — list of conditions. Each row either:
 *      a) maps via `mapToConditionCategory` → conditions row with
 *         source="self_reported", started_at=now, ended_at=null;
 *      b) otherwise stored as observation category="condition",
 *         code_system="internal", value_text=user text.
 *
 *   3. Family history — per-relative entries with condition + age of onset.
 *      Stored as observations category="family_history", metadata_json
 *      carrying { relative, ageOfOnset, conditionName }.
 *
 *   4. Lifestyle — smoking / alcohol / activity / diet / sleep prompts.
 *      Stored as observations category="lifestyle", code_system="internal",
 *      value_text=user's chosen option.
 *
 * Local-first: writes happen on tap; no network calls in this screen.
 * Append-only invariant honored via the DAL (no UPDATEs in this screen).
 */
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { useApiClient } from "@/auth";
import type { ConditionInsertInput, ObservationInsertInput } from "@/contracts";
import { useDal } from "@/db/DalProvider";
import type { RootStackParamList } from "@/navigation/types";
import { mapToConditionCategory } from "@/onboarding/conditionMapping";
import { fw } from "@/onboarding/fontWeight";
import { useTheme } from "@/theme/useTheme";

type Nav = NativeStackNavigationProp<RootStackParamList, "Intake">;

const SMOKING_OPTIONS = [
  "Never smoked",
  "Former smoker",
  "Current smoker — less than daily",
  "Current smoker — daily",
] as const;

const ALCOHOL_OPTIONS = [
  "Never",
  "Monthly or less",
  "2-4 times a month",
  "2-3 times a week",
  "4+ times a week",
] as const;

const ACTIVITY_OPTIONS = [
  "Sedentary (little to no exercise)",
  "Light (1-2 days/week)",
  "Moderate (3-4 days/week)",
  "Active (5+ days/week)",
] as const;

const DIET_OPTIONS = [
  "Standard American",
  "Mediterranean / mostly plants",
  "Low-carb / keto",
  "Vegetarian",
  "Vegan",
  "Other",
] as const;

const SLEEP_OPTIONS = [
  "Less than 5 hours / night",
  "5-6 hours / night",
  "7-8 hours / night",
  "9+ hours / night",
] as const;

const LIFESTYLE_SECTIONS: ReadonlyArray<{
  key: string;
  code: string;
  question: string;
  options: ReadonlyArray<string>;
}> = [
  {
    key: "smoking",
    code: "denali.lifestyle.smoking",
    question: "Smoking status",
    options: SMOKING_OPTIONS,
  },
  {
    key: "alcohol",
    code: "denali.lifestyle.alcohol",
    question: "How often do you drink alcohol?",
    options: ALCOHOL_OPTIONS,
  },
  {
    key: "activity",
    code: "denali.lifestyle.activity",
    question: "Physical activity level",
    options: ACTIVITY_OPTIONS,
  },
  {
    key: "diet",
    code: "denali.lifestyle.diet",
    question: "Diet pattern",
    options: DIET_OPTIONS,
  },
  {
    key: "sleep",
    code: "denali.lifestyle.sleep",
    question: "Average sleep duration",
    options: SLEEP_OPTIONS,
  },
];

interface SymptomDraft {
  name: string;
  onsetDate: string; // ISO yyyy-mm-dd
  severity: number; // 0..10
}

interface HistoryDraft {
  name: string;
}

interface FamilyDraft {
  relative: string;
  conditionName: string;
  ageOfOnset: string; // numeric string
}

const RELATIVES = ["Mother", "Father", "Sibling", "Grandparent", "Other"];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function IntakeOnboardingScreen(): React.ReactElement {
  const api = useApiClient();
  const dal = useDal();
  const navigation = useNavigation<Nav>();
  const { active, theme } = useTheme();

  // ─── Symptom ───
  const [symptom, setSymptom] = React.useState<SymptomDraft>({
    name: "",
    onsetDate: todayIso(),
    severity: 0,
  });
  const [symptomDone, setSymptomDone] = React.useState(false);

  // ─── History ───
  const [history, setHistory] = React.useState<HistoryDraft[]>([]);
  const [historyDraft, setHistoryDraft] = React.useState("");

  // ─── Family ───
  const [family, setFamily] = React.useState<FamilyDraft[]>([]);
  const [familyDraft, setFamilyDraft] = React.useState<FamilyDraft>({
    relative: "Mother",
    conditionName: "",
    ageOfOnset: "",
  });

  // ─── Lifestyle ───
  const [lifestyle, setLifestyle] = React.useState<Record<string, string>>({});

  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const userId = api.getCurrentUser()?.userId ?? null;

  const handleSubmit = React.useCallback(async () => {
    if (submitting) return;
    if (dal == null || userId == null) {
      setErrorMsg("Local database not ready. Please try again in a moment.");
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);

    try {
      // Symptom (only if user typed something)
      if (symptom.name.trim().length > 0) {
        const obs: ObservationInsertInput = {
          user_id: userId,
          category: "symptom",
          code_system: "internal",
          code: `denali.symptom.${symptom.name.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 60)}`,
          display: symptom.name.trim(),
          value_num: symptom.severity,
          value_text: symptom.name.trim(),
          unit: "0-10 severity",
          source: "self_reported",
          effective_at: new Date(symptom.onsetDate).toISOString(),
          report_id: null,
          supersedes_id: null,
          metadata_json: null,
        };
        await dal.insertObservation(obs);
      }

      // History — try to map; fall back to observation
      for (const h of history) {
        const text = h.name.trim();
        if (text.length === 0) continue;
        const category = mapToConditionCategory(text);
        if (category != null) {
          const condition: ConditionInsertInput = {
            user_id: userId,
            condition_code: text,
            condition_category: category,
            source: "self_reported",
            started_at: new Date().toISOString(),
            ended_at: null,
            confidence: null,
          };
          await dal.insertCondition(condition);
        } else {
          // Unmappable — store as observation with category=condition
          const obs: ObservationInsertInput = {
            user_id: userId,
            category: "condition",
            code_system: "internal",
            code: `denali.history.${text.toLowerCase().replace(/\s+/g, "_").slice(0, 60)}`,
            display: text,
            value_num: null,
            value_text: text,
            unit: null,
            source: "self_reported",
            effective_at: new Date().toISOString(),
            report_id: null,
            supersedes_id: null,
            metadata_json: JSON.stringify({ note: "unmapped self-reported condition" }),
          };
          await dal.insertObservation(obs);
        }
      }

      // Family — each entry one observation
      for (const f of family) {
        const cond = f.conditionName.trim();
        const age = parseInt(f.ageOfOnset, 10);
        if (cond.length === 0) continue;
        const obs: ObservationInsertInput = {
          user_id: userId,
          category: "family_history",
          code_system: "internal",
          code: `denali.family.${f.relative.toLowerCase()}.${cond.toLowerCase().replace(/\s+/g, "_").slice(0, 60)}`,
          display: `${f.relative}: ${cond}`,
          value_num: Number.isFinite(age) ? age : null,
          value_text: cond,
          unit: Number.isFinite(age) ? "age at onset" : null,
          source: "self_reported",
          effective_at: new Date().toISOString(),
          report_id: null,
          supersedes_id: null,
          metadata_json: JSON.stringify({
            relative: f.relative,
            ageOfOnset: Number.isFinite(age) ? age : null,
            conditionName: cond,
          }),
        };
        await dal.insertObservation(obs);
      }

      // Lifestyle — one observation per answered prompt
      for (const section of LIFESTYLE_SECTIONS) {
        const answer = lifestyle[section.key];
        if (!answer) continue;
        const obs: ObservationInsertInput = {
          user_id: userId,
          category: "lifestyle",
          code_system: "internal",
          code: section.code,
          display: section.question,
          value_num: null,
          value_text: answer,
          unit: null,
          source: "self_reported",
          effective_at: new Date().toISOString(),
          report_id: null,
          supersedes_id: null,
          metadata_json: null,
        };
        await dal.insertObservation(obs);
      }

      navigation.navigate("Instruments");
    } catch (e) {
      setErrorMsg(
        e instanceof Error
          ? `Could not save intake: ${e.message}`
          : "Could not save intake. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }, [
    dal,
    family,
    history,
    lifestyle,
    navigation,
    submitting,
    symptom,
    userId,
  ]);

  const skipAll = React.useCallback(() => {
    Alert.alert(
      "Skip intake?",
      "You can come back to this later from Settings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Skip",
          style: "destructive",
          onPress: () => navigation.navigate("Instruments"),
        },
      ],
    );
  }, [navigation]);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: active.bgPrimary },
        scroll: { padding: theme.spacing.lg, gap: theme.spacing.lg },
        title: {
          fontSize: theme.typography.sizes["3xl"],
          fontFamily: theme.typography.fonts.serif,
          color: active.textPrimary,
          fontWeight: fw(theme.typography.weights.bold),
        },
        subtitle: {
          fontSize: theme.typography.sizes.base,
          color: active.textSecondary,
        },
        sectionTitle: {
          fontSize: theme.typography.sizes.xl,
          color: active.textPrimary,
          fontWeight: fw(theme.typography.weights.semibold),
          marginTop: theme.spacing.md,
        },
        helpText: {
          fontSize: theme.typography.sizes.sm,
          color: active.textSecondary,
        },
        input: {
          borderColor: active.border,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
          fontSize: theme.typography.sizes.base,
          color: active.textPrimary,
          backgroundColor: active.bgSecondary,
          minHeight: 48,
        },
        row: { flexDirection: "row", gap: theme.spacing.sm },
        chip: {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radii.md,
          borderColor: active.border,
          borderWidth: 1,
          backgroundColor: active.bgSecondary,
        },
        chipSelected: {
          borderColor: active.accentPrimary,
          backgroundColor: active.bgTertiary,
        },
        chipLabel: {
          color: active.textPrimary,
          fontSize: theme.typography.sizes.sm,
        },
        smallButton: {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radii.md,
          backgroundColor: active.bgTertiary,
          alignSelf: "flex-start",
        },
        smallButtonLabel: {
          color: active.textPrimary,
          fontSize: theme.typography.sizes.sm,
          fontWeight: fw(theme.typography.weights.medium),
        },
        listItem: {
          padding: theme.spacing.sm,
          borderRadius: theme.radii.sm,
          backgroundColor: active.bgSecondary,
        },
        listItemText: {
          color: active.textPrimary,
          fontSize: theme.typography.sizes.sm,
        },
        actions: {
          flexDirection: "row",
          gap: theme.spacing.sm,
          marginTop: theme.spacing.lg,
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
          paddingHorizontal: theme.spacing.md,
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
      }),
    [active, theme],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View>
          <Text style={styles.title}>Tell us a bit more</Text>
          <Text style={styles.subtitle}>
            Everything you enter here stays on this device. Skip any section
            that doesn&apos;t apply.
          </Text>
        </View>

        {/* Chief complaint */}
        <Text style={styles.sectionTitle}>What brings you in?</Text>
        <Text style={styles.helpText}>
          What&apos;s on your mind — a symptom, concern, or question?
        </Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Joint pain, fatigue, headaches"
          placeholderTextColor={active.textMuted}
          value={symptom.name}
          onChangeText={(name) => setSymptom((s) => ({ ...s, name }))}
          editable={!submitting}
          accessibilityLabel="Symptom or concern"
        />
        <Text style={styles.helpText}>When did it start? (YYYY-MM-DD)</Text>
        <TextInput
          style={styles.input}
          placeholder="YYYY-MM-DD"
          placeholderTextColor={active.textMuted}
          value={symptom.onsetDate}
          onChangeText={(onsetDate) =>
            setSymptom((s) => ({ ...s, onsetDate }))
          }
          editable={!submitting}
          keyboardType="numbers-and-punctuation"
          accessibilityLabel="Onset date"
        />
        <Text style={styles.helpText}>
          How severe? 0 (no impact) to 10 (worst possible).
        </Text>
        <View style={styles.row}>
          {[0, 2, 4, 6, 8, 10].map((n) => (
            <Pressable
              key={n}
              style={[
                styles.chip,
                symptom.severity === n && styles.chipSelected,
              ]}
              onPress={() => setSymptom((s) => ({ ...s, severity: n }))}
              disabled={submitting}
              accessibilityRole="radio"
              accessibilityState={{ selected: symptom.severity === n }}
            >
              <Text style={styles.chipLabel}>{n}</Text>
            </Pressable>
          ))}
        </View>

        {/* Medical history */}
        <Text style={styles.sectionTitle}>Medical history</Text>
        <Text style={styles.helpText}>
          Conditions you&apos;ve been diagnosed with. Tap Add to include each one.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. High blood pressure"
          placeholderTextColor={active.textMuted}
          value={historyDraft}
          onChangeText={setHistoryDraft}
          editable={!submitting}
          accessibilityLabel="Condition name"
        />
        <Pressable
          style={styles.smallButton}
          onPress={() => {
            const name = historyDraft.trim();
            if (name.length === 0) return;
            setHistory((arr) => [...arr, { name }]);
            setHistoryDraft("");
          }}
          disabled={submitting}
          accessibilityRole="button"
        >
          <Text style={styles.smallButtonLabel}>Add condition</Text>
        </Pressable>
        {history.map((h, idx) => (
          <View key={`${h.name}-${idx}`} style={styles.listItem}>
            <Text style={styles.listItemText}>{h.name}</Text>
          </View>
        ))}

        {/* Family history */}
        <Text style={styles.sectionTitle}>Family history</Text>
        <Text style={styles.helpText}>
          Who in your family had what, and at what age. Tap Add for each entry.
        </Text>
        <View style={styles.row}>
          {RELATIVES.map((r) => (
            <Pressable
              key={r}
              style={[
                styles.chip,
                familyDraft.relative === r && styles.chipSelected,
              ]}
              onPress={() =>
                setFamilyDraft((f) => ({ ...f, relative: r }))
              }
              disabled={submitting}
            >
              <Text style={styles.chipLabel}>{r}</Text>
            </Pressable>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder="Condition (e.g. Heart attack)"
          placeholderTextColor={active.textMuted}
          value={familyDraft.conditionName}
          onChangeText={(conditionName) =>
            setFamilyDraft((f) => ({ ...f, conditionName }))
          }
          editable={!submitting}
          accessibilityLabel="Family condition"
        />
        <TextInput
          style={styles.input}
          placeholder="Age at onset (e.g. 62)"
          placeholderTextColor={active.textMuted}
          value={familyDraft.ageOfOnset}
          onChangeText={(ageOfOnset) =>
            setFamilyDraft((f) => ({
              ...f,
              ageOfOnset: ageOfOnset.replace(/[^0-9]/g, "").slice(0, 3),
            }))
          }
          keyboardType="number-pad"
          editable={!submitting}
          accessibilityLabel="Age at onset"
          maxLength={3}
        />
        <Pressable
          style={styles.smallButton}
          onPress={() => {
            if (familyDraft.conditionName.trim().length === 0) return;
            setFamily((arr) => [...arr, familyDraft]);
            setFamilyDraft({
              relative: "Mother",
              conditionName: "",
              ageOfOnset: "",
            });
          }}
          disabled={submitting}
          accessibilityRole="button"
        >
          <Text style={styles.smallButtonLabel}>Add family entry</Text>
        </Pressable>
        {family.map((f, idx) => (
          <View key={`fam-${idx}`} style={styles.listItem}>
            <Text style={styles.listItemText}>
              {f.relative}: {f.conditionName}
              {f.ageOfOnset ? ` (age ${f.ageOfOnset})` : ""}
            </Text>
          </View>
        ))}

        {/* Lifestyle */}
        <Text style={styles.sectionTitle}>Lifestyle</Text>
        {LIFESTYLE_SECTIONS.map((section) => (
          <View key={section.key} style={{ gap: theme.spacing.sm }}>
            <Text style={styles.helpText}>{section.question}</Text>
            {section.options.map((opt) => {
              const selected = lifestyle[section.key] === opt;
              return (
                <Pressable
                  key={opt}
                  style={[styles.chip, selected && styles.chipSelected]}
                  onPress={() =>
                    setLifestyle((m) => ({ ...m, [section.key]: opt }))
                  }
                  disabled={submitting}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                >
                  <Text style={styles.chipLabel}>{opt}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

        <View style={styles.actions}>
          <Pressable
            style={styles.secondary}
            onPress={skipAll}
            disabled={submitting}
            accessibilityRole="button"
          >
            <Text style={styles.secondaryLabel}>Skip</Text>
          </Pressable>
          <Pressable
            style={styles.primary}
            onPress={handleSubmit}
            disabled={submitting}
            accessibilityRole="button"
          >
            {submitting ? (
              <ActivityIndicator color={active.bgPrimary} />
            ) : (
              <Text style={styles.primaryLabel}>Save and continue</Text>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

/**
 * IntakeOnboardingScreen — Wave 2 redesign (one item per screen, optional per section).
 *
 * Burden model:
 *   - Each of the four sections is OPTIONAL per the Wave-2 brief. The
 *     user enters a section by tapping it on the section-picker
 *     screen, walks through its items one at a time, and either
 *     completes the section or skips back out to the picker.
 *   - The "Continue" / "Finish intake" button at the picker advances
 *     to Instruments without requiring any section to be completed.
 *
 * Sections:
 *   1. What brings you in?  (chief complaint via coded symptom autocomplete + severity slider)
 *   2. Medical history       (coded conditions via autocomplete, repeatable)
 *   3. Family history        (structured: relation + condition + onset age, repeatable)
 *   4. Lifestyle             (smoking / alcohol / activity / diet / sleep — Likert each)
 *
 * Coded data over free text:
 *   - Chief complaint uses the SYMPTOMS vocabulary (internal codes).
 *   - Medical history uses CONDITIONS_45_PLUS (ICD-10).
 *   - Family history uses CONDITIONS_45_PLUS via StructuredFamilyHistoryInput.
 *   - Lifestyle uses fixed Likert options (no autocomplete needed).
 *
 * Persistence at finish:
 *   - Chief complaint → observation category="symptom"
 *   - Medical history entries that map → conditions row; others →
 *     observation category="condition" with the ICD-10 code attached.
 *   - Family history → observation category="family_history", code =
 *     selected condition code, metadata_json carries the structured
 *     relation + onset_age + condition_display.
 *   - Lifestyle → observation category="lifestyle" per answered prompt.
 *
 * Local-first: writes happen at section-finish via the local DAL.
 * No network calls in this screen.
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
import type {
  ConditionInsertInput,
  ObservationInsertInput,
} from "@/contracts";
import { useDal } from "@/db/DalProvider";
import type { RootStackParamList } from "@/navigation/types";
import {
  assembleNextKeyedAnswers,
  AutocompleteInput,
  type AutocompleteSelection,
  buildFamilyHistoryRecord,
  type FamilyHistoryDraft,
  familyHistoryMetadataJson,
  LikertInput,
  SliderInput,
  StructuredFamilyHistoryInput,
} from "@/onboarding/inputs";
import { OneItemScreen } from "@/onboarding/OneItemScreen";
import { mapToConditionCategory } from "@/onboarding/conditionMapping";
import { fw } from "@/onboarding/fontWeight";
import { CONDITIONS_45_PLUS, SYMPTOMS } from "@/onboarding/vocab";
import { useTheme } from "@/theme/useTheme";

type Nav = NativeStackNavigationProp<RootStackParamList, "Intake">;

// ─── Lifestyle definitions ────────────────────────────────────────────────

const SMOKING_OPTIONS = [
  { value: 0, label: "Never smoked" },
  { value: 1, label: "Former smoker" },
  { value: 2, label: "Current smoker — less than daily" },
  { value: 3, label: "Current smoker — daily" },
] as const;
const ALCOHOL_OPTIONS = [
  { value: 0, label: "Never" },
  { value: 1, label: "Monthly or less" },
  { value: 2, label: "2-4 times a month" },
  { value: 3, label: "2-3 times a week" },
  { value: 4, label: "4+ times a week" },
] as const;
const ACTIVITY_OPTIONS = [
  { value: 0, label: "Little to no exercise" },
  { value: 1, label: "Light (1-2 days/week)" },
  { value: 2, label: "Moderate (3-4 days/week)" },
  { value: 3, label: "Active (5+ days/week)" },
] as const;
const DIET_OPTIONS = [
  { value: 0, label: "Standard American" },
  { value: 1, label: "Mediterranean / mostly plants" },
  { value: 2, label: "Low-carb / keto" },
  { value: 3, label: "Vegetarian" },
  { value: 4, label: "Vegan" },
  { value: 5, label: "Other / mixed" },
] as const;
const SLEEP_OPTIONS = [
  { value: 0, label: "Less than 5 hours" },
  { value: 1, label: "5–6 hours" },
  { value: 2, label: "7–8 hours" },
  { value: 3, label: "9+ hours" },
] as const;

interface LifestylePrompt {
  key: keyof LifestyleAnswers;
  code: string;
  question: string;
  options: ReadonlyArray<{ value: number; label: string }>;
}

interface LifestyleAnswers {
  smoking: number | null;
  alcohol: number | null;
  activity: number | null;
  diet: number | null;
  sleep: number | null;
}

const LIFESTYLE_PROMPTS: ReadonlyArray<LifestylePrompt> = [
  {
    key: "smoking",
    code: "denali.lifestyle.smoking",
    question: "How would you describe your smoking?",
    options: [...SMOKING_OPTIONS],
  },
  {
    key: "alcohol",
    code: "denali.lifestyle.alcohol",
    question: "How often do you drink alcohol?",
    options: [...ALCOHOL_OPTIONS],
  },
  {
    key: "activity",
    code: "denali.lifestyle.activity",
    question: "How active are you on a typical week?",
    options: [...ACTIVITY_OPTIONS],
  },
  {
    key: "diet",
    code: "denali.lifestyle.diet",
    question: "Which best describes your usual eating pattern?",
    options: [...DIET_OPTIONS],
  },
  {
    key: "sleep",
    code: "denali.lifestyle.sleep",
    question: "How much do you usually sleep at night?",
    options: [...SLEEP_OPTIONS],
  },
];

// ─── Section identification ───────────────────────────────────────────────

type SectionId = "menu" | "complaint" | "history" | "family" | "lifestyle";

interface SectionStatus {
  complaint: "todo" | "skipped" | "saved";
  history: "todo" | "skipped" | "saved";
  family: "todo" | "skipped" | "saved";
  lifestyle: "todo" | "skipped" | "saved";
}

// ─── Component ────────────────────────────────────────────────────────────

export function IntakeOnboardingScreen(): React.ReactElement {
  const api = useApiClient();
  const dal = useDal();
  const navigation = useNavigation<Nav>();
  const { active, theme } = useTheme();

  const [section, setSection] = React.useState<SectionId>("menu");
  const [status, setStatus] = React.useState<SectionStatus>({
    complaint: "todo",
    history: "todo",
    family: "todo",
    lifestyle: "todo",
  });

  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  // Section state — chief complaint
  const [complaintSelection, setComplaintSelection] =
    React.useState<AutocompleteSelection | null>(null);
  const [complaintSeverity, setComplaintSeverity] = React.useState(0);
  const [complaintStep, setComplaintStep] = React.useState<1 | 2>(1);

  // Section state — history (repeatable)
  const [historyEntries, setHistoryEntries] = React.useState<
    AutocompleteSelection[]
  >([]);
  const [historyDraft, setHistoryDraft] =
    React.useState<AutocompleteSelection | null>(null);

  // Section state — family history (repeatable)
  const [familyEntries, setFamilyEntries] = React.useState<FamilyHistoryDraft[]>(
    [],
  );
  const [familyDraft, setFamilyDraft] = React.useState<FamilyHistoryDraft>({
    relation: null,
    selection: null,
    onsetAge: null,
  });

  // Section state — lifestyle
  const [lifestyle, setLifestyle] = React.useState<LifestyleAnswers>({
    smoking: null,
    alcohol: null,
    activity: null,
    diet: null,
    sleep: null,
  });
  const [lifestyleStep, setLifestyleStep] = React.useState(0);

  const userId = api.getCurrentUser()?.userId ?? null;

  // ─── Persistence helpers ────────────────────────────────────────────────

  const persistComplaint = React.useCallback(async () => {
    if (dal == null || userId == null) {
      throw new Error("Local database not ready");
    }
    if (complaintSelection == null) return;
    const obs: ObservationInsertInput = {
      user_id: userId,
      category: "symptom",
      code_system: complaintSelection.code_system,
      code: complaintSelection.code,
      display: complaintSelection.display,
      value_num: complaintSeverity,
      value_text: complaintSelection.display,
      unit: "0-10 severity",
      source: "self_reported",
      effective_at: new Date().toISOString(),
      report_id: null,
      supersedes_id: null,
      metadata_json:
        complaintSelection.isUncoded === true
          ? JSON.stringify({ uncoded: true })
          : null,
    };
    await dal.insertObservation(obs);
  }, [complaintSelection, complaintSeverity, dal, userId]);

  const persistHistory = React.useCallback(async () => {
    if (dal == null || userId == null) {
      throw new Error("Local database not ready");
    }
    for (const entry of historyEntries) {
      const category = mapToConditionCategory(entry.display);
      if (category != null) {
        const condition: ConditionInsertInput = {
          user_id: userId,
          condition_code: entry.code,
          condition_category: category,
          source: "self_reported",
          started_at: new Date().toISOString(),
          ended_at: null,
          confidence: null,
        };
        await dal.insertCondition(condition);
      } else {
        // Code is ICD-10 but not in the curated 9-cat enum (e.g. asthma).
        // Store as observation category="condition" with the ICD-10 code
        // so the data is still coded and analyzable longitudinally.
        const obs: ObservationInsertInput = {
          user_id: userId,
          category: "condition",
          code_system: entry.code_system,
          code: entry.code,
          display: entry.display,
          value_num: null,
          value_text: entry.display,
          unit: null,
          source: "self_reported",
          effective_at: new Date().toISOString(),
          report_id: null,
          supersedes_id: null,
          metadata_json:
            entry.isUncoded === true
              ? JSON.stringify({ uncoded: true })
              : null,
        };
        await dal.insertObservation(obs);
      }
    }
  }, [dal, historyEntries, userId]);

  const persistFamily = React.useCallback(async () => {
    if (dal == null || userId == null) {
      throw new Error("Local database not ready");
    }
    for (const draft of familyEntries) {
      const record = buildFamilyHistoryRecord(draft);
      if (record == null) continue;
      const obs: ObservationInsertInput = {
        user_id: userId,
        category: "family_history",
        code_system: record.conditionCodeSystem,
        code: record.conditionCode,
        display: record.conditionDisplay,
        value_num: record.onsetAge,
        value_text: record.conditionDisplay,
        unit: record.onsetAge != null ? "age at onset" : null,
        source: "self_reported",
        effective_at: new Date().toISOString(),
        report_id: null,
        supersedes_id: null,
        metadata_json: familyHistoryMetadataJson(record),
      };
      await dal.insertObservation(obs);
    }
  }, [dal, familyEntries, userId]);

  // Persists a snapshot of the lifestyle map. Takes the snapshot as an
  // EXPLICIT arg (not from closure) so the auto-advance path on the last
  // prompt can pass the just-computed map. Closure-captured `lifestyle`
  // would lag behind the just-set value on the final tap — same stale-
  // closure class as the Cohort gender-step dead-end. The deps array no
  // longer includes `lifestyle` for the same reason.
  const persistLifestyle = React.useCallback(
    async (lifestyleSnapshot: typeof lifestyle) => {
      if (dal == null || userId == null) {
        throw new Error("Local database not ready");
      }
      for (const prompt of LIFESTYLE_PROMPTS) {
        const value = lifestyleSnapshot[prompt.key];
        if (value == null) continue;
        const label =
          prompt.options.find((o) => o.value === value)?.label ?? String(value);
        const obs: ObservationInsertInput = {
          user_id: userId,
          category: "lifestyle",
          code_system: "internal",
          code: prompt.code,
          display: prompt.question,
          value_num: value,
          value_text: label,
          unit: null,
          source: "self_reported",
          effective_at: new Date().toISOString(),
          report_id: null,
          supersedes_id: null,
          metadata_json: null,
        };
        await dal.insertObservation(obs);
      }
    },
    [dal, userId],
  );

  const finishSection = React.useCallback(
    async (id: Exclude<SectionId, "menu">, persist: () => Promise<void>) => {
      setSubmitting(true);
      setErrorMsg(null);
      try {
        await persist();
        setStatus((s) => ({ ...s, [id]: "saved" }));
        setSection("menu");
      } catch (e) {
        setErrorMsg(
          e instanceof Error
            ? `Could not save: ${e.message}`
            : "Could not save. Please try again.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  const skipSection = React.useCallback((id: Exclude<SectionId, "menu">) => {
    setStatus((s) => ({ ...s, [id]: "skipped" }));
    setSection("menu");
    setErrorMsg(null);
  }, []);

  const goToInstruments = React.useCallback(() => {
    navigation.navigate("Instruments");
  }, [navigation]);

  // ─── Styles ─────────────────────────────────────────────────────────────

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
          lineHeight:
            theme.typography.sizes.base *
            theme.typography.lineHeights.relaxed,
        },
        sectionCard: {
          borderColor: active.border,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
          backgroundColor: active.bgSecondary,
          gap: theme.spacing.xs,
        },
        sectionTitle: {
          fontSize: theme.typography.sizes.lg,
          color: active.textPrimary,
          fontWeight: fw(theme.typography.weights.semibold),
        },
        sectionMeta: {
          fontSize: theme.typography.sizes.sm,
          color: active.textSecondary,
        },
        sectionStatus: {
          fontSize: theme.typography.sizes.xs,
          textTransform: "uppercase",
          letterSpacing: 1,
          marginTop: theme.spacing.xs,
        },
        statusSaved: {
          color: theme.colors.conditions.light.checkTeal.base,
          fontWeight: fw(theme.typography.weights.semibold),
        },
        statusSkipped: {
          color: active.textMuted,
        },
        statusTodo: {
          color: active.accentPrimary,
          fontWeight: fw(theme.typography.weights.semibold),
        },
        primaryAction: {
          backgroundColor: active.accentPrimary,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radii.md,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
          marginTop: theme.spacing.md,
        },
        primaryLabel: {
          color: active.bgPrimary,
          fontSize: theme.typography.sizes.base,
          fontWeight: fw(theme.typography.weights.semibold),
        },
        addBtn: {
          backgroundColor: active.bgTertiary,
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radii.md,
          alignSelf: "flex-start",
          minHeight: 44,
          justifyContent: "center",
        },
        addLabel: {
          color: active.textPrimary,
          fontSize: theme.typography.sizes.sm,
          fontWeight: fw(theme.typography.weights.medium),
        },
        entryRow: {
          padding: theme.spacing.sm,
          borderRadius: theme.radii.sm,
          backgroundColor: active.bgTertiary,
        },
        entryText: {
          color: active.textPrimary,
          fontSize: theme.typography.sizes.sm,
        },
        list: { gap: theme.spacing.xs },
        submittingWrap: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: active.bgPrimary,
        },
      }),
    [active, theme],
  );

  // ─── Loading overlay ────────────────────────────────────────────────────

  if (submitting) {
    return (
      <View style={styles.submittingWrap}>
        <ActivityIndicator color={active.accentPrimary} />
        <Text style={[styles.subtitle, { marginTop: theme.spacing.sm }]}>
          Saving…
        </Text>
      </View>
    );
  }

  // ─── Section: menu (default) ────────────────────────────────────────────

  if (section === "menu") {
    const sectionMeta: ReadonlyArray<{
      id: Exclude<SectionId, "menu">;
      title: string;
      meta: string;
    }> = [
      {
        id: "complaint",
        title: "What brings you in?",
        meta: "A symptom or concern that's on your mind.",
      },
      {
        id: "history",
        title: "Your medical history",
        meta: "Conditions you've been diagnosed with.",
      },
      {
        id: "family",
        title: "Family history",
        meta: "What runs in the family, and at what age.",
      },
      {
        id: "lifestyle",
        title: "Daily habits",
        meta: "Smoking, alcohol, activity, food, sleep.",
      },
    ];
    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.title}>Tell us a bit more</Text>
          <Text style={styles.subtitle}>
            Each section is optional. Skip anything that doesn&apos;t apply.
            Everything you enter stays on this device.
          </Text>

          {sectionMeta.map(({ id, title, meta }) => {
            const s = status[id];
            return (
              <Pressable
                key={id}
                style={styles.sectionCard}
                onPress={() => setSection(id)}
                accessibilityRole="button"
                accessibilityLabel={title}
              >
                <Text style={styles.sectionTitle}>{title}</Text>
                <Text style={styles.sectionMeta}>{meta}</Text>
                <Text
                  style={[
                    styles.sectionStatus,
                    s === "saved"
                      ? styles.statusSaved
                      : s === "skipped"
                        ? styles.statusSkipped
                        : styles.statusTodo,
                  ]}
                >
                  {s === "saved"
                    ? "Saved"
                    : s === "skipped"
                      ? "Skipped"
                      : "Tap to add"}
                </Text>
              </Pressable>
            );
          })}

          {errorMsg ? (
            <Text style={{ color: theme.colors.conditions.light.healthRed.base }}>
              {errorMsg}
            </Text>
          ) : null}

          <Pressable
            style={styles.primaryAction}
            onPress={goToInstruments}
            accessibilityRole="button"
            accessibilityLabel="Finish intake and continue"
          >
            <Text style={styles.primaryLabel}>Finish intake</Text>
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ─── Section: chief complaint ───────────────────────────────────────────

  if (section === "complaint") {
    if (complaintStep === 1) {
      return (
        <OneItemScreen
          stepIndex={1}
          totalSteps={2}
          sectionLabel="What brings you in?"
          question="What's most on your mind today?"
          helperText="Pick the closest match. Tap 'Use my own wording' if nothing fits."
          canContinue={complaintSelection != null}
          onContinue={() => setComplaintStep(2)}
          onBack={() => setSection("menu")}
          onSkipSection={() => skipSection("complaint")}
          errorMessage={errorMsg}
        >
          <AutocompleteInput
            vocabulary={SYMPTOMS}
            value={complaintSelection}
            onChange={setComplaintSelection}
            allowOther
            placeholder="e.g. fatigue, joint pain"
            accessibilityLabel="Symptom or concern"
          />
        </OneItemScreen>
      );
    }
    return (
      <OneItemScreen
        stepIndex={2}
        totalSteps={2}
        sectionLabel="What brings you in?"
        question="How much is this affecting you?"
        helperText="0 means no impact. 10 means the worst possible."
        canContinue
        onContinue={() => finishSection("complaint", persistComplaint)}
        onBack={() => setComplaintStep(1)}
        onSkipSection={() => skipSection("complaint")}
        errorMessage={errorMsg}
      >
        <SliderInput
          min={0}
          max={10}
          step={1}
          value={complaintSeverity}
          onChange={setComplaintSeverity}
          minLabel="No impact"
          maxLabel="Worst possible"
          accessibilityLabel="Severity"
        />
      </OneItemScreen>
    );
  }

  // ─── Section: medical history ───────────────────────────────────────────

  if (section === "history") {
    return (
      <OneItemScreen
        stepIndex={1}
        totalSteps={1}
        sectionLabel="Your medical history"
        question="What conditions have you been diagnosed with?"
        helperText="Add as many as apply. Tap Save when you're done — or Skip if none apply."
        canContinue={historyEntries.length > 0}
        onContinue={() => finishSection("history", persistHistory)}
        onBack={() => setSection("menu")}
        onSkipSection={() => skipSection("history")}
        errorMessage={errorMsg}
      >
        <View style={{ gap: theme.spacing.md }}>
          <AutocompleteInput
            vocabulary={CONDITIONS_45_PLUS}
            value={historyDraft}
            onChange={setHistoryDraft}
            allowOther
            placeholder="e.g. high blood pressure"
            accessibilityLabel="Condition"
          />
          <Pressable
            style={styles.addBtn}
            onPress={() => {
              if (historyDraft == null) return;
              setHistoryEntries((arr) => [...arr, historyDraft]);
              setHistoryDraft(null);
            }}
            disabled={historyDraft == null}
            accessibilityRole="button"
            accessibilityLabel="Add condition"
          >
            <Text style={styles.addLabel}>Add this condition</Text>
          </Pressable>
          <View style={styles.list}>
            {historyEntries.map((e, idx) => (
              <View key={`${e.code}-${idx}`} style={styles.entryRow}>
                <Text style={styles.entryText}>
                  {e.display}
                  {e.isUncoded ? " (your own wording)" : ""}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </OneItemScreen>
    );
  }

  // ─── Section: family history ────────────────────────────────────────────

  if (section === "family") {
    const draftComplete =
      familyDraft.relation != null && familyDraft.selection != null;
    return (
      <OneItemScreen
        stepIndex={1}
        totalSteps={1}
        sectionLabel="Family history"
        question="Who in your family had what?"
        helperText="Add one entry per relative + condition. Onset age is optional."
        canContinue={familyEntries.length > 0}
        onContinue={() => finishSection("family", persistFamily)}
        onBack={() => setSection("menu")}
        onSkipSection={() => skipSection("family")}
        errorMessage={errorMsg}
      >
        <View style={{ gap: theme.spacing.md }}>
          <StructuredFamilyHistoryInput
            value={familyDraft}
            onChange={setFamilyDraft}
          />
          <Pressable
            style={styles.addBtn}
            onPress={() => {
              if (!draftComplete) return;
              setFamilyEntries((arr) => [...arr, familyDraft]);
              setFamilyDraft({
                relation: null,
                selection: null,
                onsetAge: null,
              });
            }}
            disabled={!draftComplete}
            accessibilityRole="button"
            accessibilityLabel="Add this family entry"
          >
            <Text style={styles.addLabel}>Add this family entry</Text>
          </Pressable>
          <View style={styles.list}>
            {familyEntries.map((e, idx) => {
              const r = buildFamilyHistoryRecord(e);
              if (r == null) return null;
              return (
                <View key={`fam-${idx}`} style={styles.entryRow}>
                  <Text style={styles.entryText}>
                    {r.relation.replace(/_/g, " ")} — {r.conditionDisplay}
                    {r.onsetAge != null ? ` (age ${r.onsetAge})` : ""}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </OneItemScreen>
    );
  }

  // ─── Section: lifestyle ─────────────────────────────────────────────────

  const prompt = LIFESTYLE_PROMPTS[lifestyleStep];
  const lifestyleTotal = LIFESTYLE_PROMPTS.length;
  return (
    <OneItemScreen
      stepIndex={lifestyleStep + 1}
      totalSteps={lifestyleTotal}
      sectionLabel="Daily habits"
      question={prompt.question}
      autoAdvance
      onBack={
        lifestyleStep > 0
          ? () => setLifestyleStep((s) => Math.max(0, s - 1))
          : () => setSection("menu")
      }
      onSkipSection={() => skipSection("lifestyle")}
      errorMessage={errorMsg}
    >
      <LikertInput
        options={prompt.options}
        value={lifestyle[prompt.key]}
        onChange={(v) => {
          // Compute the next-lifestyle snapshot LOCALLY so the last-tap
          // persist gets the just-set value. Passing this explicit map to
          // persistLifestyle eliminates the stale-closure class (closure-
          // captured `lifestyle` would still be the pre-tap map at this
          // tick). No microtask defer needed — explicit args make
          // React's batching irrelevant to correctness. The pure helper
          // is what the regression tests exercise.
          const nextLifestyle = assembleNextKeyedAnswers(
            lifestyle,
            prompt.key,
            v,
          );
          setLifestyle(nextLifestyle);
          if (lifestyleStep + 1 >= lifestyleTotal) {
            void finishSection("lifestyle", () =>
              persistLifestyle(nextLifestyle),
            );
          } else {
            setLifestyleStep((s) => s + 1);
          }
        }}
        accessibilityLabel={prompt.question}
      />
    </OneItemScreen>
  );
}

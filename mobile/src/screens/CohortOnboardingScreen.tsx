/**
 * CohortOnboardingScreen — Wave 2 (mobile-onboarding-builder).
 *
 * 4-question post-auth interstitial:
 *   Q1: Birth year (1900..currentYear) — required. INTEGER text input.
 *   Q2: Sex at birth (Male / Female / Prefer not to say [= "unknown"]) — required.
 *   Q3: Are you enrolled in Medicare? (Yes / No) — required.
 *   Q4: Gender identity — optional dropdown.
 *
 * Submit:
 *   - PATCH /api/profile with additive payload (omit gender_identity when null)
 *   - LocalDataDAL.upsertProfile (Local is system of record)
 *   - Navigate to Intake on success.
 *
 * Local-first: writes to local DAL before/independent of network. If the
 * server PATCH fails, the local profile row is still good; the user can
 * proceed. We surface the network error but do not block the journey.
 *
 * Contracts consumed: ApiClient, LocalDataDAL, Theme, SexAtBirth,
 * GenderIdentity (all from src/contracts).
 */
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import {
  ActivityIndicator,
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
import type { GenderIdentity, SexAtBirth } from "@/contracts";
import { useDal } from "@/db/DalProvider";
import type { RootStackParamList } from "@/navigation/types";
import {
  buildCohortPayload,
  canSubmitCohort,
} from "@/onboarding/cohortPayload";
import { fw } from "@/onboarding/fontWeight";
import { useTheme } from "@/theme/useTheme";

type Nav = NativeStackNavigationProp<RootStackParamList, "CohortOnboarding">;

// Mirror the web's v1 UI options. Intersex is API-settable but not shown.
const SEX_OPTIONS: ReadonlyArray<{ value: SexAtBirth; label: string }> = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "unknown", label: "Prefer not to say" },
];

const GENDER_OPTIONS: ReadonlyArray<{
  value: GenderIdentity | null;
  label: string;
}> = [
  { value: null, label: "Prefer to skip" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "non-binary", label: "Non-binary" },
  { value: "transgender-male", label: "Transgender male" },
  { value: "transgender-female", label: "Transgender female" },
  { value: "other", label: "Other" },
  { value: "prefer-not-to-say", label: "Prefer not to say" },
];

export function CohortOnboardingScreen(): React.ReactElement {
  const api = useApiClient();
  const dal = useDal();
  const navigation = useNavigation<Nav>();
  const { active, theme } = useTheme();
  const currentYear = React.useMemo(() => new Date().getFullYear(), []);

  const [birthYearStr, setBirthYearStr] = React.useState("");
  const [sexAtBirth, setSexAtBirth] = React.useState<SexAtBirth | null>(null);
  const [isOnMedicare, setIsOnMedicare] = React.useState<boolean | null>(null);
  const [genderIdentity, setGenderIdentity] =
    React.useState<GenderIdentity | null>(null);
  const [showGenderPicker, setShowGenderPicker] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const birthYear = React.useMemo(() => {
    const n = parseInt(birthYearStr, 10);
    return Number.isFinite(n) ? n : null;
  }, [birthYearStr]);

  const canSubmit = canSubmitCohort({
    birthYear,
    sexAtBirth,
    isOnMedicare,
    currentYear,
  });
  const submitDisabled = submitting || !canSubmit;

  const handleSubmit = React.useCallback(async () => {
    if (submitDisabled || birthYear == null || sexAtBirth == null || isOnMedicare == null) return;

    setSubmitting(true);
    setErrorMsg(null);

    const payload = buildCohortPayload({
      birthYear,
      sexAtBirth,
      isOnMedicare,
      genderIdentity,
    });

    // Local-first: write the profile row to SQLCipher BEFORE the network
    // PATCH so a network failure doesn't strand the user's cohort answers.
    // Mobile is the system of record for the local profile.
    const currentUser = api.getCurrentUser();
    if (dal != null && currentUser != null) {
      try {
        await dal.upsertProfile({
          id: currentUser.userId,
          email: currentUser.email,
          birth_year: birthYear,
          is_on_medicare: isOnMedicare,
          sex_at_birth: sexAtBirth,
          gender_identity: genderIdentity ?? null,
        });
      } catch (e) {
        // Local DB write failed — surface to user; do not advance.
        setSubmitting(false);
        setErrorMsg(
          e instanceof Error
            ? `Could not save locally: ${e.message}`
            : "Could not save locally. Please try again.",
        );
        return;
      }
    }

    // Server-side PATCH — best-effort. Network failure is surfaced but does
    // not block the journey because the local DB is the source of truth.
    try {
      await api.apiPatch("/api/profile", payload);
    } catch (e) {
      // Log but do not block — local is authoritative.
      // The web app would set medicare_status cookie here; mobile uses
      // local profile state for all routing decisions instead.
      // eslint-disable-next-line no-console
      console.warn("[cohort] PATCH /api/profile failed:", e);
    }

    setSubmitting(false);
    navigation.navigate("Intake");
  }, [
    api,
    birthYear,
    dal,
    genderIdentity,
    isOnMedicare,
    navigation,
    sexAtBirth,
    submitDisabled,
  ]);

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
          marginBottom: theme.spacing.sm,
        },
        section: { gap: theme.spacing.sm },
        legend: {
          fontSize: theme.typography.sizes.lg,
          fontWeight: fw(theme.typography.weights.semibold),
          color: active.textPrimary,
        },
        legendRequired: {
          fontSize: theme.typography.sizes.xs,
          color: theme.colors.conditions.light.healthRed.base,
        },
        legendOptional: {
          fontSize: theme.typography.sizes.xs,
          color: active.textSecondary,
        },
        helpText: {
          fontSize: theme.typography.sizes.sm,
          color: active.textSecondary,
          lineHeight:
            theme.typography.sizes.sm * theme.typography.lineHeights.relaxed,
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
        option: {
          borderColor: active.border,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
          minHeight: 48,
          justifyContent: "center",
        },
        optionSelected: {
          borderColor: active.accentPrimary,
          backgroundColor: active.bgSecondary,
        },
        optionLabel: {
          fontSize: theme.typography.sizes.base,
          color: active.textPrimary,
        },
        submit: {
          backgroundColor: active.accentPrimary,
          paddingVertical: theme.spacing.md,
          borderRadius: theme.radii.md,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
          marginTop: theme.spacing.md,
        },
        submitDisabled: {
          backgroundColor: active.textMuted,
        },
        submitLabel: {
          color: active.bgPrimary,
          fontSize: theme.typography.sizes.base,
          fontWeight: fw(theme.typography.weights.semibold),
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
      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <Text style={styles.title}>Let&apos;s get you set up</Text>
          <Text style={styles.subtitle}>
            These help us personalize Denali for you.
          </Text>
        </View>

        {/* Q1 — Birth year */}
        <View style={styles.section}>
          <Text style={styles.legend}>
            Birth year{" "}
            <Text style={styles.legendRequired}>Required</Text>
          </Text>
          <Text style={styles.helpText}>
            Denali is designed for adults 45 and older. Many reference ranges
            and risk-stratification cutoffs depend on age.
          </Text>
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder="e.g. 1965"
            placeholderTextColor={active.textMuted}
            value={birthYearStr}
            onChangeText={(text) =>
              setBirthYearStr(text.replace(/[^0-9]/g, "").slice(0, 4))
            }
            editable={!submitting}
            accessibilityLabel="Birth year"
            maxLength={4}
          />
        </View>

        {/* Q2 — Sex at birth */}
        <View style={styles.section}>
          <Text style={styles.legend}>
            Sex at birth{" "}
            <Text style={styles.legendRequired}>Required</Text>
          </Text>
          <Text style={styles.helpText}>
            Used to interpret lab results accurately — reference ranges for
            things like hemoglobin, creatinine, and cardiac markers differ by
            sex at birth.
          </Text>
          {SEX_OPTIONS.map((opt) => {
            const selected = sexAtBirth === opt.value;
            return (
              <Pressable
                key={opt.value}
                style={[styles.option, selected && styles.optionSelected]}
                onPress={() => setSexAtBirth(opt.value)}
                disabled={submitting}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
              >
                <Text style={styles.optionLabel}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Q3 — Medicare */}
        <View style={styles.section}>
          <Text style={styles.legend}>
            Are you enrolled in Medicare?{" "}
            <Text style={styles.legendRequired}>Required</Text>
          </Text>
          <Text style={styles.helpText}>
            This helps us give you the right information. You can change this
            anytime in Settings.
          </Text>
          <Pressable
            style={[
              styles.option,
              isOnMedicare === true && styles.optionSelected,
            ]}
            onPress={() => setIsOnMedicare(true)}
            disabled={submitting}
            accessibilityRole="radio"
            accessibilityState={{ selected: isOnMedicare === true }}
          >
            <Text style={styles.optionLabel}>Yes, I have Medicare</Text>
          </Pressable>
          <Pressable
            style={[
              styles.option,
              isOnMedicare === false && styles.optionSelected,
            ]}
            onPress={() => setIsOnMedicare(false)}
            disabled={submitting}
            accessibilityRole="radio"
            accessibilityState={{ selected: isOnMedicare === false }}
          >
            <Text style={styles.optionLabel}>No, I don&apos;t have Medicare</Text>
          </Pressable>
        </View>

        {/* Q4 — Gender identity (optional) */}
        <View style={styles.section}>
          <Text style={styles.legend}>
            Gender identity{" "}
            <Text style={styles.legendOptional}>Optional</Text>
          </Text>
          <Text style={styles.helpText}>
            Optional — helps us address you correctly. You can update this
            anytime in Settings.
          </Text>
          <Pressable
            style={styles.option}
            onPress={() => setShowGenderPicker((v) => !v)}
            disabled={submitting}
            accessibilityRole="button"
          >
            <Text style={styles.optionLabel}>
              {genderIdentity
                ? GENDER_OPTIONS.find((g) => g.value === genderIdentity)
                    ?.label ?? genderIdentity
                : "Select an option"}
            </Text>
          </Pressable>
          {showGenderPicker
            ? GENDER_OPTIONS.map((opt) => {
                const selected = genderIdentity === opt.value;
                return (
                  <Pressable
                    key={opt.value ?? "__skip__"}
                    style={[
                      styles.option,
                      selected && styles.optionSelected,
                    ]}
                    onPress={() => {
                      setGenderIdentity(opt.value);
                      setShowGenderPicker(false);
                    }}
                    disabled={submitting}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <Text style={styles.optionLabel}>{opt.label}</Text>
                  </Pressable>
                );
              })
            : null}
        </View>

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

        <Pressable
          style={[styles.submit, submitDisabled && styles.submitDisabled]}
          onPress={handleSubmit}
          disabled={submitDisabled}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitDisabled }}
        >
          {submitting ? (
            <ActivityIndicator color={active.bgPrimary} />
          ) : (
            <Text style={styles.submitLabel}>Continue</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

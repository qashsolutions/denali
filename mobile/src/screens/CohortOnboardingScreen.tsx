/**
 * CohortOnboardingScreen — Wave 2 redesign (one item per screen).
 *
 * Internal step state walks the user through the demographics
 * questions one at a time, using `OneItemScreen` for the shell. The
 * route is still a single screen so we don't explode the navigation
 * graph; the OneItemScreen presents one question at a time.
 *
 * Step order (all REQUIRED per the Wave-2 burden model, except
 * gender identity which stays optional per D7):
 *   1. Birth year   (numeric text input — Continue button)
 *   2. Sex at birth (Likert single-select — auto-advance)
 *   3. Medicare?    (Likert single-select — auto-advance)
 *   4. Gender identity (Likert single-select with "Prefer to skip" — auto-advance,
 *                       OPTIONAL — user can pick "Prefer to skip" to finish)
 *
 * Submit happens after step 4:
 *   - LocalDataDAL.upsertProfile (local is source of truth)
 *   - ApiClient.apiPatch("/api/profile") with additive payload (omits
 *     gender_identity when null).
 *
 * If the local DAL write fails, we surface the error and stay on the
 * final step. Network PATCH failure is best-effort and logged but does
 * NOT block journey advancement.
 */
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from "react-native";

import { useApiClient } from "@/auth";
import type { GenderIdentity, SexAtBirth } from "@/contracts";
import { useDal } from "@/db/DalProvider";
import type { RootStackParamList } from "@/navigation/types";
import { fw } from "@/onboarding/fontWeight";
import { LikertInput } from "@/onboarding/inputs";
import { OneItemScreen } from "@/onboarding/OneItemScreen";
import { buildCohortPayload, canSubmitCohort } from "@/onboarding/cohortPayload";
import { useTheme } from "@/theme/useTheme";

type Nav = NativeStackNavigationProp<RootStackParamList, "CohortOnboarding">;

const SEX_OPTIONS = [
  { value: 0, label: "Male" },
  { value: 1, label: "Female" },
  { value: 2, label: "Prefer not to say" },
] as const;
const SEX_TO_API: ReadonlyArray<SexAtBirth> = ["male", "female", "unknown"];

const MEDICARE_OPTIONS = [
  { value: 1, label: "Yes, I have Medicare" },
  { value: 0, label: "No, I don't have Medicare" },
] as const;

const GENDER_OPTIONS: ReadonlyArray<{ value: number; label: string; gid: GenderIdentity | null }> = [
  { value: 0, label: "Prefer to skip", gid: null },
  { value: 1, label: "Male", gid: "male" },
  { value: 2, label: "Female", gid: "female" },
  { value: 3, label: "Non-binary", gid: "non-binary" },
  { value: 4, label: "Transgender male", gid: "transgender-male" },
  { value: 5, label: "Transgender female", gid: "transgender-female" },
  { value: 6, label: "Other", gid: "other" },
  { value: 7, label: "Prefer not to say", gid: "prefer-not-to-say" },
];

const TOTAL_STEPS = 4;

export function CohortOnboardingScreen(): React.ReactElement {
  const api = useApiClient();
  const dal = useDal();
  const navigation = useNavigation<Nav>();
  const { active, theme } = useTheme();
  const currentYear = React.useMemo(() => new Date().getFullYear(), []);

  const [stepIndex, setStepIndex] = React.useState(1); // 1-based

  // Field state
  const [birthYearStr, setBirthYearStr] = React.useState("");
  const [sexLikert, setSexLikert] = React.useState<number | null>(null);
  const [medicareLikert, setMedicareLikert] = React.useState<number | null>(null);
  const [genderLikert, setGenderLikert] = React.useState<number | null>(null);

  const [submitting, setSubmitting] = React.useState(false);
  const [errorMsg, setErrorMsg] = React.useState<string | null>(null);

  const birthYear = React.useMemo(() => {
    const n = parseInt(birthYearStr, 10);
    return Number.isFinite(n) ? n : null;
  }, [birthYearStr]);

  const sexAtBirth: SexAtBirth | null =
    sexLikert != null ? SEX_TO_API[sexLikert] ?? null : null;
  const isOnMedicare: boolean | null =
    medicareLikert == null ? null : medicareLikert === 1;

  // Auto-advance handlers — fire on selection.
  const handleSexChange = React.useCallback((v: number) => {
    setSexLikert(v);
    setStepIndex((i) => Math.min(i + 1, TOTAL_STEPS));
  }, []);
  const handleMedicareChange = React.useCallback((v: number) => {
    setMedicareLikert(v);
    setStepIndex((i) => Math.min(i + 1, TOTAL_STEPS));
  }, []);
  const handleGenderChange = React.useCallback(
    (v: number) => {
      setGenderLikert(v);
      // Gender is the last step — submit on selection.
      // Defer the actual submit to a useEffect that watches all state
      // so the local variable read is up-to-date.
      // We use a microtask to avoid running submit inside setState.
      Promise.resolve().then(() => {
        // We have to call submit with the latest values. Read state at
        // call time via the closure: by the time the microtask runs,
        // genderLikert is the new value (React batches setState but
        // the local `v` is the source of truth here).
        // Build the payload directly to avoid stale-closure on
        // genderIdentity.
        const newGid =
          GENDER_OPTIONS.find((g) => g.value === v)?.gid ?? null;
        submitWithGender(newGid);
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Variant of submit that takes an explicit gender (used by auto-advance)
  const submitWithGender = React.useCallback(
    async (gid: GenderIdentity | null) => {
      if (submitting) return;
      if (
        !canSubmitCohort({
          birthYear,
          sexAtBirth,
          isOnMedicare,
          currentYear,
        })
      ) {
        setErrorMsg("Please complete all required answers.");
        return;
      }
      setSubmitting(true);
      setErrorMsg(null);

      const payload = buildCohortPayload({
        birthYear: birthYear as number,
        sexAtBirth: sexAtBirth as SexAtBirth,
        isOnMedicare: isOnMedicare as boolean,
        genderIdentity: gid,
      });

      const currentUser = api.getCurrentUser();
      if (dal != null && currentUser != null) {
        try {
          await dal.upsertProfile({
            id: currentUser.userId,
            email: currentUser.email,
            birth_year: birthYear,
            is_on_medicare: isOnMedicare,
            sex_at_birth: sexAtBirth,
            gender_identity: gid ?? null,
          });
        } catch (e) {
          setSubmitting(false);
          setErrorMsg(
            e instanceof Error
              ? `Could not save locally: ${e.message}`
              : "Could not save locally. Please try again.",
          );
          return;
        }
      }

      try {
        await api.apiPatch("/api/profile", payload);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn("[cohort] PATCH /api/profile failed:", e);
      }

      setSubmitting(false);
      navigation.navigate("Intake");
    },
    [
      api,
      birthYear,
      currentYear,
      dal,
      isOnMedicare,
      navigation,
      sexAtBirth,
      submitting,
    ],
  );

  const goBack = React.useCallback(() => {
    setErrorMsg(null);
    setStepIndex((i) => Math.max(1, i - 1));
  }, []);

  const continueBirthYear = React.useCallback(() => {
    if (birthYear == null) return;
    if (birthYear < 1900 || birthYear > currentYear) {
      setErrorMsg(`Please enter a year between 1900 and ${currentYear}.`);
      return;
    }
    setErrorMsg(null);
    setStepIndex((i) => Math.min(i + 1, TOTAL_STEPS));
  }, [birthYear, currentYear]);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        input: {
          borderColor: active.border,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
          fontSize: theme.typography.sizes["2xl"],
          fontFamily: theme.typography.fonts.mono,
          color: active.textPrimary,
          backgroundColor: active.bgSecondary,
          minHeight: 56,
          textAlign: "center",
        },
        submittingRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.sm,
        },
        submittingLabel: {
          fontSize: theme.typography.sizes.sm,
          color: active.textSecondary,
          fontWeight: fw(theme.typography.weights.medium),
        },
      }),
    [active, theme],
  );

  if (submitting) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: active.bgPrimary }}>
        <ActivityIndicator color={active.accentPrimary} />
        <Text style={[styles.submittingLabel, { marginTop: theme.spacing.sm }]}>
          Saving your answers…
        </Text>
      </View>
    );
  }

  switch (stepIndex) {
    case 1:
      return (
        <OneItemScreen
          stepIndex={1}
          totalSteps={TOTAL_STEPS}
          sectionLabel="About you"
          question="What year were you born?"
          helperText="Many reference ranges and risk-stratification cutoffs depend on age."
          canContinue={
            birthYear != null &&
            birthYear >= 1900 &&
            birthYear <= currentYear
          }
          onContinue={continueBirthYear}
          hideBack
          errorMessage={errorMsg}
        >
          <TextInput
            style={styles.input}
            keyboardType="number-pad"
            placeholder="e.g. 1965"
            placeholderTextColor={active.textMuted}
            value={birthYearStr}
            onChangeText={(text) =>
              setBirthYearStr(text.replace(/[^0-9]/g, "").slice(0, 4))
            }
            accessibilityLabel="Birth year"
            maxLength={4}
          />
        </OneItemScreen>
      );

    case 2:
      return (
        <OneItemScreen
          stepIndex={2}
          totalSteps={TOTAL_STEPS}
          sectionLabel="About you"
          question="What was your sex at birth?"
          helperText="Used to interpret lab results accurately — reference ranges for things like hemoglobin and cardiac markers differ by sex at birth."
          autoAdvance
          onBack={goBack}
          errorMessage={errorMsg}
        >
          <LikertInput
            options={SEX_OPTIONS}
            value={sexLikert}
            onChange={handleSexChange}
            accessibilityLabel="Sex at birth"
          />
        </OneItemScreen>
      );

    case 3:
      return (
        <OneItemScreen
          stepIndex={3}
          totalSteps={TOTAL_STEPS}
          sectionLabel="About you"
          question="Are you enrolled in Medicare?"
          helperText="This helps us tailor what we show you. You can change this anytime in Settings."
          autoAdvance
          onBack={goBack}
          errorMessage={errorMsg}
        >
          <LikertInput
            options={MEDICARE_OPTIONS}
            value={medicareLikert}
            onChange={handleMedicareChange}
            accessibilityLabel="Medicare enrollment"
          />
        </OneItemScreen>
      );

    case 4:
    default:
      return (
        <OneItemScreen
          stepIndex={4}
          totalSteps={TOTAL_STEPS}
          sectionLabel="About you"
          question="How do you identify?"
          helperText="Optional. Helps us address you correctly. You can update this anytime in Settings."
          autoAdvance
          onBack={goBack}
          errorMessage={errorMsg}
        >
          <LikertInput
            options={GENDER_OPTIONS}
            value={genderLikert}
            onChange={handleGenderChange}
            accessibilityLabel="Gender identity"
          />
        </OneItemScreen>
      );
  }
}

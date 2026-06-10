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
import { LikertInput } from "@/onboarding/inputs";
import { OneItemScreen } from "@/onboarding/OneItemScreen";
import {
  type CohortPayload,
  decideCohortSubmission,
  missingCohortFieldMessage,
} from "@/onboarding/cohortPayload";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

type Nav = NativeStackNavigationProp<RootStackParamList, "CohortOnboarding">;

const SEX_OPTIONS = [
  { value: 0, label: "Male", testID: "cohort_step2_option_male" },
  { value: 1, label: "Female", testID: "cohort_step2_option_female" },
  { value: 2, label: "Prefer not to say", testID: "cohort_step2_option_unknown" },
] as const;
const SEX_TO_API: ReadonlyArray<SexAtBirth> = ["male", "female", "unknown"];

const MEDICARE_OPTIONS = [
  { value: 1, label: "Yes, I have Medicare", testID: "cohort_step3_option_yes" },
  { value: 0, label: "No, I don't have Medicare", testID: "cohort_step3_option_no" },
] as const;

// Gender identity options. "Skip" is NOT in this list — the OneItemScreen's
// onSkipSection footer button handles the defer/null path (gid stored as
// null → buildCohortPayload omits the key → column untouched). The in-list
// "Prefer not to say" is an EXPLICIT declination — gid stored as
// "prefer-not-to-say" so the answer is recorded. Two distinct semantics,
// distinct affordances: list = identities, footer = defer.
const GENDER_OPTIONS: ReadonlyArray<{
  value: number;
  label: string;
  gid: GenderIdentity;
  testID: string;
}> = [
  { value: 0, label: "Male", gid: "male", testID: "cohort_step4_option_male" },
  { value: 1, label: "Female", gid: "female", testID: "cohort_step4_option_female" },
  { value: 2, label: "Non-binary", gid: "non-binary", testID: "cohort_step4_option_non_binary" },
  { value: 3, label: "Transgender male", gid: "transgender-male", testID: "cohort_step4_option_transgender_male" },
  { value: 4, label: "Transgender female", gid: "transgender-female", testID: "cohort_step4_option_transgender_female" },
  { value: 5, label: "Other", gid: "other", testID: "cohort_step4_option_other" },
  { value: 6, label: "Prefer not to say", gid: "prefer-not-to-say", testID: "cohort_step4_option_prefer_not_to_say" },
];

const TOTAL_STEPS = 4;

export function CohortOnboardingScreen(): React.ReactElement {
  const api = useApiClient();
  const dal = useDal();
  const navigation = useNavigation<Nav>();
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
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

  // Submit the cohort with an EXPLICIT payload. Takes the payload as an
  // arg (not from closure) so the auto-advance path can pass the just-
  // computed payload built from live state. This is the structural
  // counterpart to `decideCohortSubmission` — together they make the
  // submit path closure-safe.
  const submitCohort = React.useCallback(
    async (payload: CohortPayload) => {
      setSubmitting(true);
      setErrorMsg(null);

      const currentUser = api.getCurrentUser();
      if (dal != null && currentUser != null) {
        try {
          await dal.upsertProfile({
            id: currentUser.userId,
            email: currentUser.email,
            birth_year: payload.birth_year,
            is_on_medicare: payload.is_on_medicare,
            sex_at_birth: payload.sex_at_birth,
            gender_identity: payload.gender_identity ?? null,
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
    [api, dal, navigation],
  );

  // Auto-advance handlers — fire on selection. Sex + Medicare just step
  // forward; the closures here only call stable setState dispatchers, so
  // `[]` deps are correct (no captured state).
  const handleSexChange = React.useCallback((v: number) => {
    setSexLikert(v);
    setStepIndex((i) => Math.min(i + 1, TOTAL_STEPS));
  }, []);
  const handleMedicareChange = React.useCallback((v: number) => {
    setMedicareLikert(v);
    setStepIndex((i) => Math.min(i + 1, TOTAL_STEPS));
  }, []);

  // Gender is the last step. Build the decision from live state and the
  // just-picked option, then either show a specific missing-field error
  // or submit. NO microtask defer — the decision function takes state as
  // explicit args, so React's batching is irrelevant to correctness.
  // Deps include every captured value so the eslint rule passes naturally
  // (no suppression — that's exactly the silence that hid the original
  // stale-closure dead-end).
  const handleGenderChange = React.useCallback(
    (v: number) => {
      setGenderLikert(v);
      if (submitting) return;
      const newGid =
        GENDER_OPTIONS.find((g) => g.value === v)?.gid ?? null;
      const decision = decideCohortSubmission({
        birthYear,
        sexAtBirth,
        isOnMedicare,
        genderIdentity: newGid,
        currentYear,
      });
      if (decision.kind === "missing") {
        setErrorMsg(missingCohortFieldMessage(decision.field));
        return;
      }
      void submitCohort(decision.payload);
    },
    [
      birthYear,
      currentYear,
      isOnMedicare,
      sexAtBirth,
      submitCohort,
      submitting,
    ],
  );

  // Skip the gender question. Submits with gender_identity=null →
  // buildCohortPayload omits the key → server PATCH leaves the column
  // untouched. Distinct from "Prefer not to say", which IS stored.
  const handleSkipGender = React.useCallback(() => {
    if (submitting) return;
    const decision = decideCohortSubmission({
      birthYear,
      sexAtBirth,
      isOnMedicare,
      genderIdentity: null,
      currentYear,
    });
    if (decision.kind === "missing") {
      setErrorMsg(missingCohortFieldMessage(decision.field));
      return;
    }
    void submitCohort(decision.payload);
  }, [birthYear, currentYear, isOnMedicare, sexAtBirth, submitCohort, submitting]);

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
          borderColor: redesign.line,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
          fontSize: theme.typography.sizes["2xl"],
          color: redesign.ink,
          backgroundColor: redesign.surface,
          minHeight: 56,
          textAlign: "center",
          fontVariant: ["tabular-nums"],
          ...fontStyle("numbers", 600, fontsLoaded),
        },
        submittingRow: {
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.sm,
        },
        submittingLabel: {
          fontSize: theme.typography.sizes.sm,
          color: redesign.ink2,
          ...fontStyle("body", 500, fontsLoaded),
        },
      }),
    [theme, redesign, fontsLoaded],
  );

  if (submitting) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: redesign.paper }}>
        <ActivityIndicator color={redesign.teal} />
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
            testID="cohort_step1_birth_year_input"
            style={styles.input}
            keyboardType="number-pad"
            placeholder="e.g. 1965"
            placeholderTextColor={redesign.ink3}
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
          onSkipSection={handleSkipGender}
          skipLabel="Skip"
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

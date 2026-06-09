/**
 * OneItemScreen — reusable shell for one-question-per-screen onboarding.
 *
 * Renders, in order:
 *   1. A progress indicator ("3 of 9") at the top
 *   2. An optional section label (e.g. "Lifestyle")
 *   3. The plain-language question
 *   4. Optional supporting helper text
 *   5. Slot for the input (children)
 *   6. Footer with Back / Continue / Skip-section affordances
 *
 * Auto-advance is the caller's responsibility — for single-select Likert
 * inputs the parent passes `autoAdvance` and the shell hides the
 * Continue button; for slider / autocomplete / structured inputs the
 * Continue button is visible and tappable when `canContinue` is true.
 *
 * All theme values resolved via `useTheme()` — no hardcoded values.
 * Touch targets ≥ 44px. Plain-language labels only (never instrument
 * acronyms — see `mobile-onboarding-builder.md` STEP 2 rules).
 */
import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useTheme } from "@/theme/useTheme";

import { fw } from "./fontWeight";

export interface OneItemScreenProps {
  /** 1-based step index (e.g., 3 for "3 of 9"). */
  stepIndex: number;
  /** Total step count for the progress indicator. */
  totalSteps: number;
  /** Optional section label shown above the question (e.g. "Your mood"). */
  sectionLabel?: string;
  /** The plain-language question. */
  question: string;
  /** Optional supporting copy below the question. */
  helperText?: string;
  /** The input itself. */
  children: React.ReactNode;
  /** When true, hides the Continue button (used with auto-advance inputs). */
  autoAdvance?: boolean;
  /** Gates the Continue button. Ignored when `autoAdvance` is true. */
  canContinue?: boolean;
  /** Called when the user taps Continue. */
  onContinue?: () => void;
  /** Called when the user taps Back. Hidden if undefined or `hideBack`. */
  onBack?: () => void;
  /** When true, hides Back even if `onBack` is set (e.g., first step). */
  hideBack?: boolean;
  /**
   * Called when the user taps "Skip this section". Hidden when undefined.
   * Use for optional intake sections; never for instrument items.
   */
  onSkipSection?: () => void;
  /** Skip-button label. Default: "Skip this section". */
  skipLabel?: string;
  /** Disables all interaction (e.g., while persisting). */
  disabled?: boolean;
  /** Optional error message displayed above the footer. */
  errorMessage?: string | null;
}

export function OneItemScreen({
  stepIndex,
  totalSteps,
  sectionLabel,
  question,
  helperText,
  children,
  autoAdvance = false,
  canContinue = true,
  onContinue,
  onBack,
  hideBack = false,
  onSkipSection,
  skipLabel = "Skip this section",
  disabled = false,
  errorMessage,
}: OneItemScreenProps): React.ReactElement {
  const { active, theme } = useTheme();

  // Defensive: progress fraction clamped to [0, 1].
  const progress = React.useMemo(() => {
    if (totalSteps <= 0) return 0;
    return Math.max(0, Math.min(1, stepIndex / totalSteps));
  }, [stepIndex, totalSteps]);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: active.bgPrimary },
        scroll: { padding: theme.spacing.lg, gap: theme.spacing.lg },
        progressRow: {
          gap: theme.spacing.xs,
        },
        progressBar: {
          height: 4,
          borderRadius: theme.radii.sm,
          backgroundColor: active.bgTertiary,
          overflow: "hidden",
        },
        progressFill: {
          height: 4,
          backgroundColor: active.accentPrimary,
          borderRadius: theme.radii.sm,
        },
        progressLabel: {
          fontSize: theme.typography.sizes.xs,
          color: active.textSecondary,
          textTransform: "uppercase",
          letterSpacing: 1,
        },
        sectionLabel: {
          fontSize: theme.typography.sizes.sm,
          color: active.accentPrimary,
          textTransform: "uppercase",
          letterSpacing: 1,
          fontWeight: fw(theme.typography.weights.semibold),
        },
        question: {
          fontSize: theme.typography.sizes["2xl"],
          fontFamily: theme.typography.fonts.serif,
          color: active.textPrimary,
          fontWeight: fw(theme.typography.weights.bold),
          lineHeight:
            theme.typography.sizes["2xl"] *
            theme.typography.lineHeights.tight,
        },
        helperText: {
          fontSize: theme.typography.sizes.base,
          color: active.textSecondary,
          lineHeight:
            theme.typography.sizes.base *
            theme.typography.lineHeights.relaxed,
        },
        inputSlot: { marginTop: theme.spacing.sm },
        errorText: {
          fontSize: theme.typography.sizes.sm,
          color: theme.colors.conditions.light.healthRed.base,
        },
        footer: {
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.sm,
          marginTop: theme.spacing.lg,
        },
        backButton: {
          minHeight: 48,
          minWidth: 64,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.radii.md,
          backgroundColor: active.bgSecondary,
          justifyContent: "center",
          alignItems: "center",
        },
        backLabel: {
          fontSize: theme.typography.sizes.base,
          color: active.textPrimary,
        },
        spacer: { flex: 1 },
        skipButton: {
          minHeight: 48,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.radii.md,
          backgroundColor: active.bgSecondary,
          justifyContent: "center",
          alignItems: "center",
        },
        skipLabel: {
          fontSize: theme.typography.sizes.base,
          color: active.textSecondary,
        },
        continueButton: {
          minHeight: 48,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          borderRadius: theme.radii.md,
          backgroundColor: active.accentPrimary,
          justifyContent: "center",
          alignItems: "center",
        },
        continueDisabled: {
          backgroundColor: active.textMuted,
        },
        continueLabel: {
          fontSize: theme.typography.sizes.base,
          color: active.bgPrimary,
          fontWeight: fw(theme.typography.weights.semibold),
        },
      }),
    [active, theme],
  );

  const continueDisabled = disabled || !canContinue;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>
            {stepIndex} of {totalSteps}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[styles.progressFill, { width: `${progress * 100}%` }]}
            />
          </View>
        </View>

        {sectionLabel != null ? (
          <Text style={styles.sectionLabel}>{sectionLabel}</Text>
        ) : null}

        <Text style={styles.question} accessibilityRole="header">
          {question}
        </Text>

        {helperText != null ? (
          <Text style={styles.helperText}>{helperText}</Text>
        ) : null}

        <View style={styles.inputSlot}>{children}</View>

        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}

        <View style={styles.footer}>
          {!hideBack && onBack != null ? (
            <Pressable
              testID="oneitem_back_button"
              style={styles.backButton}
              onPress={onBack}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Text style={styles.backLabel}>Back</Text>
            </Pressable>
          ) : null}
          <View style={styles.spacer} />
          {onSkipSection != null ? (
            <Pressable
              testID="oneitem_skip_button"
              style={styles.skipButton}
              onPress={onSkipSection}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={skipLabel}
            >
              <Text style={styles.skipLabel}>{skipLabel}</Text>
            </Pressable>
          ) : null}
          {!autoAdvance && onContinue != null ? (
            <Pressable
              testID="oneitem_continue_button"
              style={[
                styles.continueButton,
                continueDisabled && styles.continueDisabled,
              ]}
              onPress={onContinue}
              disabled={continueDisabled}
              accessibilityRole="button"
              accessibilityLabel="Continue"
              accessibilityState={{ disabled: continueDisabled }}
            >
              <Text style={styles.continueLabel}>Continue</Text>
            </Pressable>
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

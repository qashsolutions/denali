/**
 * StepFooter — the shared onboarding step footer.
 *
 * One place that owns the footer layout for every onboarding step (cohort,
 * intake, instruments), so it's easy to manage/adjust — extracted out of
 * OneItemScreen at operator request.
 *
 * Layout (operator-reviewed):
 *   - Primary (Continue): full-width, filled teal, at the bottom.
 *   - Secondary (Back / Skip): compact light OUTLINE buttons. Visual height ~40;
 *     vertical hitSlop restores the >=48px TAP target (45+ a11y floor).
 *   - Secondary row alignment:
 *       • WITH a primary  → space-between: Back pins left, Skip pins right —
 *         bookending the full-width Continue's edges; a lone Back sits at the
 *         left (matches the confirm step the operator approved).
 *       • WITHOUT a primary (auto-advance steps) → centered.
 *
 * testIDs stay `oneitem_*` — the Maestro selector contract references them.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

export interface StepFooterProps {
  /** Show the Back button. */
  showBack: boolean;
  /** Back handler. */
  onBack?: () => void;
  /** Show the Skip-section button. */
  showSkip: boolean;
  /** Skip handler. */
  onSkip?: () => void;
  /** Skip-button label (e.g. "Skip this section" / "Skip"). */
  skipLabel: string;
  /** Show the primary Continue button. */
  showContinue: boolean;
  /** Continue handler (caller dismisses the keyboard etc.). */
  onContinue?: () => void;
  /** Disables + dims Continue. */
  continueDisabled: boolean;
  /** Disables the secondary buttons (e.g. while persisting). */
  disabled: boolean;
}

export function StepFooter({
  showBack,
  onBack,
  showSkip,
  onSkip,
  skipLabel,
  showContinue,
  onContinue,
  continueDisabled,
  disabled,
}: StepFooterProps): React.ReactElement {
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        // Column: secondary row on top, full-width primary below, clear gap.
        footer: {
          gap: theme.spacing.lg,
          marginTop: theme.spacing.lg,
        },
        secondaryRow: {
          flexDirection: "row",
          alignItems: "center",
          columnGap: theme.spacing.sm,
        },
        // With a primary below: bookend to its edges (lone Back → left).
        secondaryRowSplit: { justifyContent: "space-between" },
        // Sole footer content: center the group.
        secondaryRowCentered: { justifyContent: "center" },
        // Compact light outline; ~40px visual, >=48px tap via hitSlop below.
        secondaryButton: {
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.radii.lg,
          backgroundColor: "transparent",
          borderColor: redesign.line,
          borderWidth: 1,
          justifyContent: "center",
          alignItems: "center",
        },
        secondaryLabel: {
          fontSize: theme.typography.sizes.base,
          color: redesign.ink2,
          ...fontStyle("body", 500, fontsLoaded),
        },
        // Mockup .cta: teal primary, white label, full-width.
        continueButton: {
          alignSelf: "stretch",
          minHeight: 48,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          borderRadius: theme.radii.xl - 2,
          backgroundColor: redesign.tealDeep,
          justifyContent: "center",
          alignItems: "center",
        },
        continueButtonDisabled: { backgroundColor: redesign.ink3 },
        continueLabel: {
          fontSize: theme.typography.sizes.base,
          color: redesign.surface,
          ...fontStyle("body", 600, fontsLoaded),
        },
      }),
    [theme, redesign, fontsLoaded],
  );

  const hasSecondary = showBack || showSkip;

  return (
    <View style={styles.footer}>
      {hasSecondary ? (
        <View
          style={[
            styles.secondaryRow,
            showContinue
              ? styles.secondaryRowSplit
              : styles.secondaryRowCentered,
          ]}
        >
          {showBack ? (
            <Pressable
              testID="oneitem_back_button"
              style={styles.secondaryButton}
              hitSlop={{ top: 8, bottom: 8 }}
              onPress={onBack}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel="Back"
            >
              <Text style={styles.secondaryLabel}>Back</Text>
            </Pressable>
          ) : null}
          {showSkip ? (
            <Pressable
              testID="oneitem_skip_button"
              style={styles.secondaryButton}
              hitSlop={{ top: 8, bottom: 8 }}
              onPress={onSkip}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel={skipLabel}
            >
              <Text style={styles.secondaryLabel}>{skipLabel}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {showContinue ? (
        <Pressable
          testID="oneitem_continue_button"
          style={[
            styles.continueButton,
            continueDisabled && styles.continueButtonDisabled,
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
  );
}

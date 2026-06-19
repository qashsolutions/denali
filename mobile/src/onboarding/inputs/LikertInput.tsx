/**
 * LikertInput — labeled discrete options rendered as tappable cards.
 *
 * Used for instrument item responses (PHQ-2/9, GAD-7, Epworth, etc.)
 * and any "pick one of N labeled options" prompt where the labels are
 * meaningful prose (not just numbers).
 *
 * Why not a slider here: instrument items have discrete, labeled
 * response options ("Not at all" / "Several days" / ...) that the user
 * needs to read and choose between. Sliding a thumb across them is a
 * worse UX than tapping the labeled card.
 *
 * Auto-advance: when `onChange` fires for a single-select Likert, the
 * caller is responsible for advancing to the next item / screen.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import { isValidLikertValue } from "./helpers";

export interface LikertOption {
  value: number;
  label: string;
  /** Optional supporting copy under the label (e.g. score range). */
  helperText?: string;
  /**
   * Optional stable identifier surfaced to Maestro / accessibility
   * tooling as `testID` on the Pressable. Use a screen-scoped slug
   * like `cohort_step2_option_male`. Phase-1 testIDs are documented
   * in `mobile/maestro/README.md`.
   */
  testID?: string;
}

export interface LikertInputProps {
  options: ReadonlyArray<LikertOption>;
  /** Currently selected value; null when nothing selected yet. */
  value: number | null;
  onChange: (value: number) => void;
  accessibilityLabel?: string;
  disabled?: boolean;
}

export function LikertInput({
  options,
  value,
  onChange,
  accessibilityLabel,
  disabled = false,
}: LikertInputProps): React.ReactElement {
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: theme.spacing.sm },
        card: {
          borderColor: redesign.line,
          borderWidth: 1,
          borderRadius: redesign.rCard,
          padding: theme.spacing.md,
          backgroundColor: redesign.surface,
          minHeight: 56,
          justifyContent: "center",
          gap: theme.spacing.xs,
        },
        cardSelected: {
          borderColor: redesign.teal,
          backgroundColor: redesign.tealWash,
          borderWidth: 2,
        },
        cardDisabled: {
          opacity: 0.5,
        },
        label: {
          fontSize: theme.typography.sizes.base,
          color: redesign.ink,
          ...fontStyle("body", 500, fontsLoaded),
        },
        helper: {
          fontSize: theme.typography.sizes.sm,
          color: redesign.ink2,
          ...fontStyle("body", 400, fontsLoaded),
          fontStyle: "italic", // calibration hint reads as a soft italic aside
        },
      }),
    [theme, redesign, fontsLoaded],
  );

  return (
    <View
      style={styles.wrap}
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
    >
      {options.map((opt) => {
        const selected = value === opt.value;
        const valid = isValidLikertValue(opt.value, options.length);
        return (
          <Pressable
            key={opt.value}
            testID={opt.testID}
            style={[
              styles.card,
              selected && styles.cardSelected,
              disabled && styles.cardDisabled,
            ]}
            onPress={() => {
              if (disabled) return;
              if (!valid) return;
              onChange(opt.value);
            }}
            disabled={disabled}
            accessibilityRole="radio"
            accessibilityState={{ selected, disabled }}
            accessibilityLabel={opt.label}
          >
            <Text style={styles.label}>{opt.label}</Text>
            {opt.helperText ? (
              <Text style={styles.helper}>{opt.helperText}</Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

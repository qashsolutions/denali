/**
 * StructuredFamilyHistoryInput — three coordinated fields in one card:
 *
 *   1. Relation (parent / sibling / child / grandparent / aunt or uncle / other)
 *   2. Condition (AutocompleteInput resolving to the conditions vocabulary)
 *   3. Age of onset (numeric, optional)
 *
 * Returns a complete `FamilyHistoryDraft`. The caller calls
 * `buildFamilyHistoryRecord(draft)` (from `./helpers`) to produce the
 * saveable shape and `familyHistoryMetadataJson(record)` to produce the
 * `metadata_json` payload for the observation insert.
 */
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { CONDITIONS_45_PLUS } from "@/onboarding/vocab";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import { AutocompleteInput } from "./AutocompleteInput";
import {
  type AutocompleteSelection,
  FAMILY_RELATION_LABELS,
  type FamilyHistoryDraft,
  type FamilyRelation,
} from "./helpers";

const RELATION_ORDER: ReadonlyArray<FamilyRelation> = [
  "parent",
  "sibling",
  "child",
  "grandparent",
  "aunt_or_uncle",
  "other",
];

export interface StructuredFamilyHistoryInputProps {
  value: FamilyHistoryDraft;
  onChange: (draft: FamilyHistoryDraft) => void;
  disabled?: boolean;
}

export function StructuredFamilyHistoryInput({
  value,
  onChange,
  disabled = false,
}: StructuredFamilyHistoryInputProps): React.ReactElement {
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();

  const handleRelation = React.useCallback(
    (relation: FamilyRelation) => {
      onChange({ ...value, relation });
    },
    [onChange, value],
  );

  const handleCondition = React.useCallback(
    (selection: AutocompleteSelection | null) => {
      onChange({ ...value, selection });
    },
    [onChange, value],
  );

  const handleAge = React.useCallback(
    (raw: string) => {
      const digits = raw.replace(/[^0-9]/g, "").slice(0, 3);
      if (digits.length === 0) {
        onChange({ ...value, onsetAge: null });
        return;
      }
      const n = parseInt(digits, 10);
      onChange({
        ...value,
        onsetAge: Number.isFinite(n) ? n : null,
      });
    },
    [onChange, value],
  );

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: theme.spacing.md },
        label: {
          fontSize: theme.typography.sizes.sm,
          color: redesign.ink2,
          ...fontStyle("body", 500, fontsLoaded),
        },
        chipRow: { flexDirection: "row", flexWrap: "wrap", gap: theme.spacing.sm },
        chip: {
          paddingVertical: theme.spacing.sm,
          paddingHorizontal: theme.spacing.md,
          borderRadius: theme.radii.md,
          borderColor: redesign.line,
          borderWidth: 1,
          backgroundColor: redesign.surface,
          minHeight: 44,
          justifyContent: "center",
        },
        chipSelected: {
          borderColor: redesign.teal,
          backgroundColor: redesign.tealWash,
          borderWidth: 2,
        },
        chipLabel: {
          color: redesign.ink,
          fontSize: theme.typography.sizes.sm,
          ...fontStyle("body", 400, fontsLoaded),
        },
        ageInput: {
          borderColor: redesign.line,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
          fontSize: theme.typography.sizes.base,
          color: redesign.ink,
          backgroundColor: redesign.surface,
          minHeight: 48,
          ...fontStyle("body", 400, fontsLoaded),
        },
      }),
    [theme, redesign, fontsLoaded],
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Who</Text>
      <View style={styles.chipRow}>
        {RELATION_ORDER.map((r) => {
          const selected = value.relation === r;
          return (
            <Pressable
              key={r}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => handleRelation(r)}
              disabled={disabled}
              accessibilityRole="radio"
              accessibilityState={{ selected, disabled }}
              accessibilityLabel={FAMILY_RELATION_LABELS[r]}
            >
              <Text style={styles.chipLabel}>
                {FAMILY_RELATION_LABELS[r]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.label}>Condition</Text>
      <AutocompleteInput
        vocabulary={CONDITIONS_45_PLUS}
        value={value.selection}
        onChange={handleCondition}
        allowOther
        placeholder="Type a condition (e.g. heart attack)"
        accessibilityLabel="Family member's condition"
        disabled={disabled}
      />

      <Text style={styles.label}>Age at onset (optional)</Text>
      <TextInput
        style={styles.ageInput}
        value={value.onsetAge != null ? String(value.onsetAge) : ""}
        onChangeText={handleAge}
        placeholder="e.g. 62"
        placeholderTextColor={redesign.ink3}
        keyboardType="number-pad"
        editable={!disabled}
        accessibilityLabel="Age at onset"
        maxLength={3}
      />
    </View>
  );
}

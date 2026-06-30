/**
 * AutocompleteInput — typeahead resolving to a coded vocabulary entry.
 *
 * Renders a TextInput + a filtered list of matches. Tapping a match
 * fires `onChange` with the selected entry. When `allowOther` is true
 * and the query has no exact match, an "Use my own wording" entry is
 * surfaced as the last option; selecting it builds a `denali.user.<slug>`
 * code with `isUncoded: true`.
 *
 * The filter is delegated to `filterAutocomplete` (pure helper) so the
 * test suite can assert match behavior without spinning up the
 * component.
 */
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import {
  type AutocompleteEntry,
  type AutocompleteSelection,
  buildOtherSelection,
  filterAutocomplete,
} from "./helpers";

export interface AutocompleteInputProps<E extends AutocompleteEntry> {
  vocabulary: ReadonlyArray<E>;
  value: AutocompleteSelection | null;
  onChange: (selection: AutocompleteSelection | null) => void;
  /** When true, surfaces an "Use my own wording" affordance for queries
   *  that don't match the vocabulary. Default: false. */
  allowOther?: boolean;
  placeholder?: string;
  accessibilityLabel?: string;
  disabled?: boolean;
  /** Cap the rendered match list. Default: 8. */
  maxResults?: number;
}

export function AutocompleteInput<E extends AutocompleteEntry>({
  vocabulary,
  value,
  onChange,
  allowOther = false,
  placeholder,
  accessibilityLabel,
  disabled = false,
  maxResults = 8,
}: AutocompleteInputProps<E>): React.ReactElement {
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const [query, setQuery] = React.useState<string>(value?.display ?? "");
  const [focused, setFocused] = React.useState(false);

  // When the parent clears the value, reset the visible query too.
  React.useEffect(() => {
    if (value == null) setQuery("");
  }, [value]);

  const matches = React.useMemo(
    () => filterAutocomplete(vocabulary, query, maxResults),
    [vocabulary, query, maxResults],
  );

  // "Other" affordance: only surface if allowOther + non-empty query
  // + the exact display doesn't already match a vocabulary entry.
  const otherCandidate = React.useMemo<AutocompleteSelection | null>(() => {
    if (!allowOther) return null;
    if (query.trim().length === 0) return null;
    const lower = query.trim().toLowerCase();
    const exactInVocab = vocabulary.some(
      (e) => e.display.toLowerCase() === lower,
    );
    if (exactInVocab) return null;
    return buildOtherSelection(query);
  }, [allowOther, query, vocabulary]);

  const showDropdown = focused && (matches.length > 0 || otherCandidate != null);

  const handleSelectEntry = React.useCallback(
    (entry: E) => {
      const selection: AutocompleteSelection = {
        code: entry.code,
        code_system: entry.code_system,
        display: entry.display,
      };
      onChange(selection);
      setQuery(entry.display);
      setFocused(false);
    },
    [onChange],
  );

  const handleSelectOther = React.useCallback(() => {
    if (otherCandidate == null) return;
    onChange(otherCandidate);
    setQuery(otherCandidate.display);
    setFocused(false);
  }, [onChange, otherCandidate]);

  const handleClear = React.useCallback(() => {
    onChange(null);
    setQuery("");
  }, [onChange]);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: theme.spacing.xs },
        inputRow: { flexDirection: "row", alignItems: "center" },
        input: {
          flex: 1,
          borderColor: focused ? redesign.teal : redesign.line,
          borderWidth: focused ? 2 : 1,
          borderRadius: theme.radii.md,
          padding: theme.spacing.md,
          fontSize: theme.typography.sizes.base,
          color: redesign.ink,
          backgroundColor: redesign.surface,
          minHeight: 48,
          ...fontStyle("body", 400, fontsLoaded),
        },
        clearBtn: {
          marginLeft: theme.spacing.sm,
          paddingHorizontal: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          minHeight: 48,
          minWidth: 48,
          justifyContent: "center",
          alignItems: "center",
        },
        clearLabel: {
          fontSize: theme.typography.sizes.base,
          color: redesign.ink2,
          ...fontStyle("body", 400, fontsLoaded),
        },
        dropdown: {
          borderColor: redesign.line,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          backgroundColor: redesign.paper,
          maxHeight: 260,
        },
        item: {
          padding: theme.spacing.md,
          borderBottomColor: redesign.line,
          borderBottomWidth: 1,
          minHeight: 48,
        },
        itemLast: {
          borderBottomWidth: 0,
        },
        itemDisplay: {
          fontSize: theme.typography.sizes.base,
          color: redesign.ink,
          ...fontStyle("body", 500, fontsLoaded),
        },
        otherItem: {
          backgroundColor: redesign.surface,
        },
        otherLabel: {
          color: redesign.ink2,
          fontSize: theme.typography.sizes.sm,
          marginTop: theme.spacing.xs,
          ...fontStyle("body", 400, fontsLoaded),
        },
        selectedSummary: {
          padding: theme.spacing.sm,
          backgroundColor: redesign.tealWash,
          borderRadius: theme.radii.sm,
        },
        selectedSummaryLabel: {
          fontSize: theme.typography.sizes.sm,
          color: redesign.ink,
          ...fontStyle("body", 400, fontsLoaded),
        },
      }),
    [theme, redesign, fontsLoaded, focused],
  );

  return (
    <View style={styles.wrap}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            // Clearing the selection when the user starts typing means
            // the parent state reflects "nothing chosen yet" until the
            // user taps a match. Avoids stale-selection bugs.
            if (value != null) onChange(null);
          }}
          onFocus={() => setFocused(true)}
          // We intentionally do NOT blur on parent re-renders; the
          // dropdown's items capture taps before blur fires.
          placeholder={placeholder ?? "Type to search"}
          placeholderTextColor={redesign.ink3}
          editable={!disabled}
          accessibilityLabel={accessibilityLabel}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {value != null || query.length > 0 ? (
          <Pressable
            style={styles.clearBtn}
            onPress={handleClear}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Clear selection"
          >
            <Text style={styles.clearLabel}>Clear</Text>
          </Pressable>
        ) : null}
      </View>

      {showDropdown ? (
        <ScrollView
          style={styles.dropdown}
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
        >
          {matches.map((m, idx) => {
            const isLast =
              idx === matches.length - 1 && otherCandidate == null;
            return (
              <Pressable
                key={m.code}
                style={[styles.item, isLast && styles.itemLast]}
                onPress={() => handleSelectEntry(m)}
                accessibilityRole="button"
                accessibilityLabel={m.display}
              >
                <Text style={styles.itemDisplay}>{m.display}</Text>
              </Pressable>
            );
          })}
          {otherCandidate != null ? (
            <Pressable
              style={[styles.item, styles.itemLast, styles.otherItem]}
              onPress={handleSelectOther}
              accessibilityRole="button"
              accessibilityLabel={`Use my own wording: ${otherCandidate.display}`}
            >
              <Text style={styles.itemDisplay}>Use my own wording</Text>
              <Text style={styles.otherLabel}>“{otherCandidate.display}”</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      ) : null}

      {value != null && !focused ? (
        <View style={styles.selectedSummary}>
          <Text style={styles.selectedSummaryLabel}>
            Selected: {value.display}
            {value.isUncoded ? " (your own wording)" : ""}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

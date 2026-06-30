/**
 * LogMarkerScreen — manual marker entry ("Log a value").
 *
 * Catalog-driven (see markerCatalog.ts): pick a marker → enter its value(s)
 * with a unit → save as coded observation(s) (`source: "self_reported"`,
 * code_system "LOINC"), identical in shape to an uploaded lab. No clinical
 * interpretation — the value records raw. Plausibility is a typo guard only.
 *
 * v1 dates the entry "now"; backdating a past lab value is a documented
 * follow-up (would need a date picker — out of scope, no new dep).
 *
 * Guardrails (all markers):
 *   - Live validation: per-field validity + overall canSave computed on every
 *     keystroke via pure helpers (validateField, deriveCanSave) in markerEntry.ts.
 *   - Save is DISABLED (dimmed, non-tappable) when any field is empty,
 *     non-numeric, or outside the field's plausible physical range.
 *   - Error copy is a hard block, not a soft warning: "Enter a number." or
 *     the exact valid range in the active display unit.
 *
 * Height — ft/in:
 *   - Default unit for height is "ft/in" (US 45+ audience).
 *   - Two inputs rendered: [feet] ft  [inches] in.
 *   - Stored value is always canonical cm (feetInchesToCm conversion).
 */
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApiClient } from "@/auth";
import { PressableScale } from "@/components/PressableScale";
import type { SexAtBirth } from "@/contracts";
import { useDal } from "@/db/DalProvider";
import { hapticSelection } from "@/feedback/haptics";
import type { RootStackParamList } from "@/navigation/types";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import { dateKeyOf, formatGroupHeader } from "../timeline/groupObservations";
import {
  findMarker,
  MARKER_GROUP_ORDER,
  markersFor,
  trackedMarkers,
  type MarkerDef,
  type MarkerField,
} from "./markerCatalog";
import {
  buildMarkerObservations,
  canonicalUnit,
  defaultUnitForField,
  deriveCanSave,
  feetInchesToCm,
  rangeErrorMessage,
  validateField,
} from "./markerEntry";

type Nav = NativeStackNavigationProp<RootStackParamList, "LogMarker">;
type Route = RouteProp<RootStackParamList, "LogMarker">;

export function LogMarkerScreen(): React.ReactElement {
  const dal = useDal();
  const api = useApiClient();
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  // Top inset so the header clears the status-bar clock.
  const insets = useSafeAreaInsets();

  const [markerKey, setMarkerKey] = React.useState<string | null>(
    route.params?.markerKey ?? null,
  );
  const marker = markerKey != null ? (findMarker(markerKey) ?? null) : null;
  const [values, setValues] = React.useState<string[]>([]);
  const [units, setUnits] = React.useState<string[]>([]);
  // ft/in composite inputs: indexed by field index.
  const [feetValues, setFeetValues] = React.useState<string[]>([]);
  const [inchesValues, setInchesValues] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [sexAtBirth, setSexAtBirth] = React.useState<SexAtBirth | null>(null);
  // The user's logged/uploaded values (code + date) → drives "You're tracking".
  const [obs, setObs] = React.useState<
    ReadonlyArray<{ code: string; effective_at: string }>
  >([]);

  const userId = api.getCurrentUser()?.userId ?? null;

  const selectMarker = React.useCallback((m: MarkerDef) => {
    hapticSelection();
    setMarkerKey(m.key);
    setValues(m.fields.map(() => ""));
    // Default unit: ft/in for height, canonical (kg / mg/dL / …) for the rest.
    setUnits(m.fields.map(defaultUnitForField));
    setFeetValues(m.fields.map(() => ""));
    setInchesValues(m.fields.map(() => ""));
    setError(null);
  }, []);

  // Load sex_at_birth (cohort gate) + the user's logged/uploaded values
  // (for "You're tracking"). Non-blocking; both default to empty.
  React.useEffect(() => {
    if (dal == null) return;
    let cancelled = false;
    void (async () => {
      try {
        const profile = await dal.getProfile();
        if (!cancelled) setSexAtBirth(profile?.sex_at_birth ?? null);
        const user = api.getCurrentUser();
        const rows = await dal.listObservations({
          latest_only: true,
          limit: 500,
        });
        if (cancelled) return;
        const scoped = user
          ? rows.filter((r) => r.user_id === user.userId)
          : rows;
        setObs(
          scoped.map((r) => ({ code: r.code, effective_at: r.effective_at })),
        );
      } catch {
        if (!cancelled) setSexAtBirth(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dal, api]);

  // "You're tracking" — markers the user already has data for (behavioral,
  // most-recent first; NOT a clinical relevance claim).
  const tracked = React.useMemo(
    () => trackedMarkers(obs, sexAtBirth),
    [obs, sexAtBirth],
  );
  const trackedKeys = React.useMemo(
    () => new Set(tracked.map((t) => t.marker.key)),
    [tracked],
  );
  // Remaining cohort-relevant markers, grouped (tracked ones surfaced above,
  // so excluded here — surfaced, never hidden).
  const groupedMarkers = React.useMemo(
    () =>
      MARKER_GROUP_ORDER.map((group) => ({
        group,
        markers: markersFor(sexAtBirth).filter(
          (m) => m.group === group && !trackedKeys.has(m.key),
        ),
      })).filter((g) => g.markers.length > 0),
    [sexAtBirth, trackedKeys],
  );

  // ── Live canSave derived from current inputs ────────────────────────────
  // Pure helper; safe to evaluate on every render — no side effects.
  const canSave = React.useMemo(() => {
    if (marker == null) return false;
    return deriveCanSave(marker, values, units, feetValues, inchesValues);
  }, [marker, values, units, feetValues, inchesValues]);

  // ── Save handler ────────────────────────────────────────────────────────
  const onSave = React.useCallback(async () => {
    if (marker == null || dal == null || userId == null) {
      setError("Not ready. Please try again.");
      return;
    }
    // Guard: canSave must be true (button should be disabled, but double-check).
    if (!canSave) return;

    const entries: { value: number; unit: string }[] = [];
    for (let i = 0; i < marker.fields.length; i += 1) {
      const field = marker.fields[i];
      const isFeetInches =
        field.units.find((u) => u.unit === units[i])?.feetInches === true;

      // Re-validate with the SAME helper that drives the canSave gate, so the
      // final guard is never weaker than the live gate (no divergence — e.g.
      // the ft/in 0–11 bound and the empty-string check both hold here too).
      const res = isFeetInches
        ? validateField(field, units[i], undefined, feetValues[i], inchesValues[i])
        : validateField(field, units[i], values[i]);
      if (!res.ok) {
        setError(
          res.reason === "out-of-range"
            ? rangeErrorMessage(field, units[i])
            : field.label != null
              ? `Enter a number for ${field.label}.`
              : "Enter a number.",
        );
        return;
      }

      if (isFeetInches) {
        // ft/in composite: store the converted cm as a canonical "cm" entry so
        // buildMarkerObservations applies toCanonicalFactor=1 (identity).
        const cm = feetInchesToCm(
          Number(feetValues[i]?.trim()),
          Number(inchesValues[i]?.trim()),
        );
        entries.push({ value: cm, unit: canonicalUnit(field).unit });
      } else {
        entries.push({ value: Number(values[i]?.trim()), unit: units[i] });
      }
    }

    setSaving(true);
    setError(null);
    try {
      const inserts = buildMarkerObservations({
        marker,
        userId,
        effectiveAt: new Date().toISOString(),
        entries,
      });
      for (const o of inserts) {
        await dal.insertObservation(o);
      }
      navigation.goBack();
    } catch {
      setError("Couldn't save. Please try again.");
      setSaving(false);
    }
  }, [marker, dal, userId, values, units, feetValues, inchesValues, canSave, navigation]);

  const styles = React.useMemo(
    () => makeStyles(theme, redesign, fontsLoaded, insets.top),
    [theme, redesign, fontsLoaded, insets.top],
  );

  if (saving) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={redesign.teal} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          testID="log_marker_back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => (marker ? setMarkerKey(null) : navigation.goBack())}
          hitSlop={12}
        >
          <Text style={styles.backChevron}>‹</Text>
        </Pressable>
        <Text style={styles.title}>
          {marker ? marker.display : "Log a value"}
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
      >
        {marker == null ? (
          <>
            <Text style={styles.prompt}>What did you measure?</Text>
            {tracked.length > 0 ? (
              <View style={styles.group}>
                <Text style={styles.groupHeader}>You&apos;re tracking</Text>
                {tracked.map(({ marker: m, lastLoggedAt }) => (
                  <Pressable
                    key={m.key}
                    testID={`log_marker_pick_${m.key}`}
                    style={styles.markerRow}
                    onPress={() => selectMarker(m)}
                    accessibilityRole="button"
                    accessibilityLabel={`${m.display}, last logged ${formatGroupHeader(dateKeyOf(lastLoggedAt))}`}
                  >
                    <Text style={styles.markerName}>{m.display}</Text>
                    <Text style={styles.markerMeta}>
                      Last logged {formatGroupHeader(dateKeyOf(lastLoggedAt))}
                    </Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {groupedMarkers.map(({ group, markers }) => (
              <View key={group} style={styles.group}>
                <Text style={styles.groupHeader}>{group}</Text>
                {markers.map((m) => (
                  <Pressable
                    key={m.key}
                    testID={`log_marker_pick_${m.key}`}
                    style={styles.markerRow}
                    onPress={() => selectMarker(m)}
                    accessibilityRole="button"
                    accessibilityLabel={m.display}
                  >
                    <Text style={styles.markerName}>{m.display}</Text>
                  </Pressable>
                ))}
              </View>
            ))}
          </>
        ) : (
          <>
            {marker.entryHint != null ? (
              <Text style={styles.entryHint}>{marker.entryHint}</Text>
            ) : null}

            {marker.fields.map((field, i) => (
              <FieldInput
                key={field.loinc}
                field={field}
                fieldIndex={i}
                markerDisplay={marker.display}
                activeUnit={units[i] ?? field.units[0].unit}
                value={values[i] ?? ""}
                feetValue={feetValues[i] ?? ""}
                inchesValue={inchesValues[i] ?? ""}
                onChangeValue={(t) =>
                  setValues((prev) => {
                    const next = [...prev];
                    next[i] = t;
                    return next;
                  })
                }
                onChangeFeet={(t) =>
                  setFeetValues((prev) => {
                    const next = [...prev];
                    next[i] = t;
                    return next;
                  })
                }
                onChangeInches={(t) =>
                  setInchesValues((prev) => {
                    const next = [...prev];
                    next[i] = t;
                    return next;
                  })
                }
                onChangeUnit={(unit) => {
                  hapticSelection();
                  setUnits((prev) => {
                    const next = [...prev];
                    next[i] = unit;
                    return next;
                  });
                  // Reset the raw inputs when switching units to avoid
                  // stale-string confusion (the user sees blank fields).
                  setValues((prev) => {
                    const next = [...prev];
                    next[i] = "";
                    return next;
                  });
                  setFeetValues((prev) => {
                    const next = [...prev];
                    next[i] = "";
                    return next;
                  });
                  setInchesValues((prev) => {
                    const next = [...prev];
                    next[i] = "";
                    return next;
                  });
                }}
                styles={styles}
                redesign={redesign}
              />
            ))}

            {error != null ? (
              <Text style={styles.error}>{error}</Text>
            ) : null}

            <PressableScale
              testID="log_marker_save"
              haptic
              disabled={!canSave}
              style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
              onPress={onSave}
              accessibilityRole="button"
              accessibilityLabel="Save"
              accessibilityState={{ disabled: !canSave }}
            >
              <Text
                style={[styles.saveLabel, !canSave && styles.saveLabelDisabled]}
              >
                Save
              </Text>
            </PressableScale>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// ── FieldInput sub-component ──────────────────────────────────────────────────
// Extracted to keep the render body legible; receives all state as props (no
// local state) so the parent remains the single source of truth.

interface FieldInputProps {
  field: MarkerField;
  fieldIndex: number;
  markerDisplay: string;
  activeUnit: string;
  value: string;
  feetValue: string;
  inchesValue: string;
  onChangeValue: (t: string) => void;
  onChangeFeet: (t: string) => void;
  onChangeInches: (t: string) => void;
  onChangeUnit: (unit: string) => void;
  styles: ReturnType<typeof makeStyles>;
  redesign: ReturnType<typeof useTheme>["redesign"];
}

function FieldInput({
  field,
  fieldIndex,
  markerDisplay,
  activeUnit,
  value,
  feetValue,
  inchesValue,
  onChangeValue,
  onChangeFeet,
  onChangeInches,
  onChangeUnit,
  styles,
  redesign,
}: FieldInputProps): React.ReactElement {
  const i = fieldIndex;
  const activeUnitDef = field.units.find((u) => u.unit === activeUnit);
  const isFeetInches = activeUnitDef?.feetInches === true;

  // Per-field live validation for inline error display (not blocking — the
  // Save button handles the hard gate; inline errors guide the user).
  const fieldResult =
    isFeetInches
      ? validateField(field, activeUnit, undefined, feetValue, inchesValue)
      : validateField(field, activeUnit, value);

  // Only show inline field error if the user has started typing (non-empty
  // input) — avoids alarming them on a fresh blank field.
  const hasTyped = isFeetInches
    ? feetValue !== "" || inchesValue !== ""
    : value !== "";
  const showInlineError = hasTyped && !fieldResult.ok;

  const inlineErrorText = showInlineError
    ? fieldResult.reason === "empty"
      ? "Enter a number."
      : fieldResult.reason === "not-a-number"
        ? "Enter a number."
        : rangeErrorMessage(field, activeUnit)
    : null;

  return (
    <View style={styles.fieldBlock}>
      {field.label != null ? (
        <Text style={styles.fieldLabel}>{field.label}</Text>
      ) : null}

      <View style={styles.inputRow}>
        {isFeetInches ? (
          // Two-input path: [feet] ft  [inches] in
          <View style={styles.feetInchesRow}>
            <TextInput
              testID={`log_marker_input_${i}_feet`}
              accessibilityLabel={`${field.label ?? markerDisplay} feet`}
              keyboardType="number-pad"
              value={feetValue}
              onChangeText={onChangeFeet}
              placeholder="5"
              placeholderTextColor={redesign.ink3}
              style={[styles.input, styles.inputFeetInches]}
            />
            <Text style={styles.feetInchesLabel}>ft</Text>
            <TextInput
              testID={`log_marker_input_${i}_inches`}
              accessibilityLabel={`${field.label ?? markerDisplay} inches`}
              keyboardType="number-pad"
              value={inchesValue}
              onChangeText={onChangeInches}
              placeholder="9"
              placeholderTextColor={redesign.ink3}
              style={[styles.input, styles.inputFeetInches]}
            />
            <Text style={styles.feetInchesLabel}>in</Text>
          </View>
        ) : (
          // Standard single-input path
          <TextInput
            testID={`log_marker_input_${i}`}
            accessibilityLabel={field.label ?? markerDisplay}
            // Signed fields (e.g. bone-density T-score) need a keyboard
            // that allows a leading minus sign. Unsigned fields keep the
            // positive-only decimal pad. The `signed` flag is explicit on
            // the MarkerField — never a global toggle.
            keyboardType={
              field.signed ? "numbers-and-punctuation" : "decimal-pad"
            }
            value={value}
            onChangeText={onChangeValue}
            placeholder={field.signed ? "e.g. -1.5" : "0"}
            placeholderTextColor={redesign.ink3}
            style={styles.input}
          />
        )}

        {field.units.length > 1 ? (
          <View style={styles.unitToggle}>
            {field.units.map((u) => {
              const active = activeUnit === u.unit;
              return (
                <Pressable
                  key={u.unit}
                  testID={`log_marker_unit_${i}_${u.unit}`}
                  onPress={() => onChangeUnit(u.unit)}
                  style={[styles.unitChip, active && styles.unitChipActive]}
                  accessibilityRole="button"
                  accessibilityLabel={u.unit}
                  accessibilityState={{ selected: active }}
                >
                  <Text
                    style={[
                      styles.unitLabel,
                      active && styles.unitLabelActive,
                    ]}
                  >
                    {u.unit}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <Text style={styles.unitStatic}>{activeUnit}</Text>
        )}
      </View>

      {inlineErrorText != null ? (
        <Text style={styles.fieldError}>{inlineErrorText}</Text>
      ) : null}
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

function makeStyles(
  theme: ReturnType<typeof useTheme>["theme"],
  redesign: ReturnType<typeof useTheme>["redesign"],
  fontsLoaded: boolean,
  insetTop: number,
) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: redesign.paper },
    center: { alignItems: "center", justifyContent: "center" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.space5,
      paddingTop: insetTop + theme.spacing.md,
      paddingBottom: theme.spacing.sm,
    },
    backChevron: {
      fontSize: theme.typography.sizes["2xl"],
      color: redesign.tealDeep,
      ...fontStyle("body", 600, fontsLoaded),
    },
    title: {
      fontSize: theme.typography.sizes["2xl"],
      color: redesign.ink,
      letterSpacing: -0.3,
      ...fontStyle("display", 700, fontsLoaded),
    },
    scroll: { padding: theme.spacing.space5, gap: theme.spacing.md },
    prompt: {
      fontSize: theme.typography.sizes.base,
      color: redesign.ink2,
      ...fontStyle("body", 400, fontsLoaded),
    },
    entryHint: {
      fontSize: theme.typography.sizes.sm,
      color: redesign.ink2,
      ...fontStyle("body", 400, fontsLoaded),
    },
    group: { gap: theme.spacing.sm },
    groupHeader: {
      fontSize: 11,
      letterSpacing: 11 * 0.12,
      textTransform: "uppercase",
      color: redesign.ink3,
      marginTop: theme.spacing.xs,
      ...fontStyle("body", 600, fontsLoaded),
    },
    markerRow: {
      backgroundColor: redesign.surface,
      borderColor: redesign.line,
      borderWidth: 1,
      borderRadius: redesign.rCard,
      paddingVertical: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      minHeight: 52,
      justifyContent: "center",
    },
    markerName: {
      fontSize: theme.typography.sizes.lg,
      color: redesign.ink,
      ...fontStyle("body", 600, fontsLoaded),
    },
    markerMeta: {
      fontSize: theme.typography.sizes.xs,
      color: redesign.ink3,
      marginTop: 2,
      ...fontStyle("body", 400, fontsLoaded),
    },
    fieldBlock: { gap: theme.spacing.xs },
    fieldLabel: {
      fontSize: theme.typography.sizes.sm,
      color: redesign.ink2,
      ...fontStyle("body", 600, fontsLoaded),
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    // Container for the feet+inches dual-input pair.
    feetInchesRow: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
    },
    input: {
      flex: 1,
      backgroundColor: redesign.surface,
      color: redesign.ink,
      borderColor: redesign.line,
      borderWidth: 1,
      borderRadius: theme.radii.lg,
      paddingHorizontal: theme.spacing.md,
      minHeight: 52,
      fontSize: theme.typography.sizes.xl,
      ...fontStyle("numbers", 600, fontsLoaded),
    },
    // Narrower input for ft/in pair so both fit comfortably on one line.
    inputFeetInches: {
      flex: 0,
      width: 64,
    },
    feetInchesLabel: {
      fontSize: theme.typography.sizes.base,
      color: redesign.ink2,
      ...fontStyle("body", 400, fontsLoaded),
    },
    unitToggle: { flexDirection: "row", gap: theme.spacing.xs },
    unitChip: {
      paddingHorizontal: theme.spacing.md,
      minHeight: 48,
      borderRadius: redesign.rChip,
      backgroundColor: redesign.pillSoft,
      alignItems: "center",
      justifyContent: "center",
    },
    unitChipActive: { backgroundColor: redesign.tealWash },
    unitLabel: {
      fontSize: theme.typography.sizes.sm,
      color: redesign.ink2,
      ...fontStyle("body", 600, fontsLoaded),
    },
    unitLabelActive: { color: redesign.tealDeep },
    unitStatic: {
      fontSize: theme.typography.sizes.base,
      color: redesign.ink2,
      ...fontStyle("body", 400, fontsLoaded),
    },
    // Top-level save error (from the onSave guard).
    error: {
      fontSize: theme.typography.sizes.sm,
      color: redesign.alarm,
      ...fontStyle("body", 400, fontsLoaded),
    },
    // Inline per-field error (live, shown once the user starts typing).
    fieldError: {
      fontSize: theme.typography.sizes.xs,
      color: redesign.alarm,
      ...fontStyle("body", 400, fontsLoaded),
    },
    saveBtn: {
      marginTop: theme.spacing.sm,
      backgroundColor: redesign.tealDeep,
      borderRadius: theme.radii.xl - 2,
      minHeight: 50,
      alignItems: "center",
      justifyContent: "center",
    },
    saveBtnDisabled: {
      backgroundColor: redesign.pillSoft,
    },
    saveLabel: {
      color: redesign.surface,
      fontSize: theme.typography.sizes.base,
      ...fontStyle("body", 600, fontsLoaded),
    },
    saveLabelDisabled: {
      color: redesign.ink3,
    },
  });
}

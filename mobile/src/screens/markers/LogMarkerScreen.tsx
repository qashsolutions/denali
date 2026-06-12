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

import { useApiClient } from "@/auth";
import { useDal } from "@/db/DalProvider";
import type { RootStackParamList } from "@/navigation/types";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import {
  findMarker,
  MARKER_CATALOG,
  type MarkerDef,
} from "./markerCatalog";
import {
  buildMarkerObservations,
  canonicalUnit,
  checkPlausible,
  toCanonical,
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

  const [markerKey, setMarkerKey] = React.useState<string | null>(
    route.params?.markerKey ?? null,
  );
  const marker = markerKey != null ? (findMarker(markerKey) ?? null) : null;
  const [values, setValues] = React.useState<string[]>([]);
  const [units, setUnits] = React.useState<string[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [saving, setSaving] = React.useState(false);

  const userId = api.getCurrentUser()?.userId ?? null;

  const selectMarker = React.useCallback((m: MarkerDef) => {
    setMarkerKey(m.key);
    setValues(m.fields.map(() => ""));
    setUnits(m.fields.map((f) => canonicalUnit(f).unit));
    setError(null);
  }, []);

  const onSave = React.useCallback(async () => {
    if (marker == null || dal == null || userId == null) {
      setError("Not ready. Please try again.");
      return;
    }
    const entries: { value: number; unit: string }[] = [];
    for (let i = 0; i < marker.fields.length; i += 1) {
      const num = Number(values[i]?.trim());
      const canonical = toCanonical(marker.fields[i], num, units[i]);
      const res = checkPlausible(marker.fields[i], canonical);
      if (!res.ok) {
        const which =
          marker.fields[i].label != null ? `${marker.fields[i].label} ` : "";
        setError(
          res.reason === "not-a-number"
            ? `Enter a number for ${which.trim() || "the value"}.`
            : `That ${which}value looks unusual — double-check it.`,
        );
        return;
      }
      entries.push({ value: num, unit: units[i] });
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
      for (const obs of inserts) {
        await dal.insertObservation(obs);
      }
      navigation.goBack();
    } catch {
      setError("Couldn't save. Please try again.");
      setSaving(false);
    }
  }, [marker, dal, userId, values, units, navigation]);

  const styles = React.useMemo(
    () => makeStyles(theme, redesign, fontsLoaded),
    [theme, redesign, fontsLoaded],
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
            {MARKER_CATALOG.map((m) => (
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
          </>
        ) : (
          <>
            {marker.entryHint != null ? (
              <Text style={styles.entryHint}>{marker.entryHint}</Text>
            ) : null}
            {marker.fields.map((field, i) => (
              <View key={field.loinc} style={styles.fieldBlock}>
                {field.label != null ? (
                  <Text style={styles.fieldLabel}>{field.label}</Text>
                ) : null}
                <View style={styles.inputRow}>
                  <TextInput
                    testID={`log_marker_input_${i}`}
                    accessibilityLabel={field.label ?? marker.display}
                    keyboardType="decimal-pad"
                    value={values[i] ?? ""}
                    onChangeText={(t) =>
                      setValues((prev) => {
                        const next = [...prev];
                        next[i] = t;
                        return next;
                      })
                    }
                    placeholder="0"
                    placeholderTextColor={redesign.ink3}
                    style={styles.input}
                  />
                  {field.units.length > 1 ? (
                    <View style={styles.unitToggle}>
                      {field.units.map((u) => {
                        const active = units[i] === u.unit;
                        return (
                          <Pressable
                            key={u.unit}
                            testID={`log_marker_unit_${i}_${u.unit}`}
                            onPress={() =>
                              setUnits((prev) => {
                                const next = [...prev];
                                next[i] = u.unit;
                                return next;
                              })
                            }
                            style={[
                              styles.unitChip,
                              active && styles.unitChipActive,
                            ]}
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
                    <Text style={styles.unitStatic}>{units[i]}</Text>
                  )}
                </View>
              </View>
            ))}

            {error != null ? (
              <Text style={styles.error}>{error}</Text>
            ) : null}

            <Pressable
              testID="log_marker_save"
              style={styles.saveBtn}
              onPress={onSave}
              accessibilityRole="button"
              accessibilityLabel="Save"
            >
              <Text style={styles.saveLabel}>Save</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function makeStyles(
  theme: ReturnType<typeof useTheme>["theme"],
  redesign: ReturnType<typeof useTheme>["redesign"],
  fontsLoaded: boolean,
) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: redesign.paper },
    center: { alignItems: "center", justifyContent: "center" },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.space5,
      paddingTop: theme.spacing.space5,
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
    fieldBlock: { gap: theme.spacing.xs },
    fieldLabel: {
      fontSize: theme.typography.sizes.sm,
      color: redesign.ink2,
      ...fontStyle("body", 600, fontsLoaded),
    },
    inputRow: { flexDirection: "row", alignItems: "center", gap: theme.spacing.sm },
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
    unitToggle: { flexDirection: "row", gap: theme.spacing.xs },
    unitChip: {
      paddingHorizontal: theme.spacing.md,
      minHeight: 44,
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
    error: {
      fontSize: theme.typography.sizes.sm,
      color: redesign.alarm,
      ...fontStyle("body", 400, fontsLoaded),
    },
    saveBtn: {
      marginTop: theme.spacing.sm,
      backgroundColor: redesign.teal,
      borderRadius: theme.radii.xl - 2,
      minHeight: 50,
      alignItems: "center",
      justifyContent: "center",
    },
    saveLabel: {
      color: redesign.surface,
      fontSize: theme.typography.sizes.base,
      ...fontStyle("body", 600, fontsLoaded),
    },
  });
}

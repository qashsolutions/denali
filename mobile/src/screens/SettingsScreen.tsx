/**
 * SettingsScreen — Phase 1 mobile (Wave 3 / mobile-app-shell Pass 2).
 *
 * Surfaces the three `consent_preferences` toggles (health_data_ai,
 * health_data_storage, analytics) plus account info (email, plan,
 * sign-out). D10 interpretation: `health_data_storage` is Phase 2's
 * cloud backup gate, INERT in Phase 1 — surfaced with explanatory copy.
 *
 * Contracts consumed: ApiClient, Theme.
 */

import { CommonActions, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { useApiClient } from "@/auth";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/useTheme";

import {
  applyConsentToggle,
  type ConsentType,
} from "./settings/consentToggle";

type Nav = NativeStackNavigationProp<RootStackParamList>;

interface ConsentSnapshot {
  health_data_ai: boolean;
  health_data_storage: boolean;
  analytics: boolean;
}

const TOGGLE_COPY: Record<
  ConsentType,
  { label: string; body: string; phase1Inert?: boolean }
> = {
  health_data_ai: {
    label: "Use my health data with AI",
    body: "Lets Denali read your uploaded reports and observations to answer questions. Required for chat and report parsing.",
  },
  health_data_storage: {
    label: "Allow cloud backup of my health data",
    body: "Cloud backup is not available in this version. This setting will apply when a backup option is added in a future release.",
    phase1Inert: true,
  },
  analytics: {
    label: "Share anonymous usage analytics",
    body: "Helps us understand which features are useful. No health data is sent in analytics.",
  },
};

export function SettingsScreen(): React.ReactElement {
  const api = useApiClient();
  const navigation = useNavigation<Nav>();
  const { active, theme } = useTheme();

  const [consent, setConsent] = React.useState<ConsentSnapshot | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [signingOut, setSigningOut] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.apiGet<{ consent: ConsentSnapshot }>(
          "/api/consent",
        );
        if (cancelled) return;
        setConsent(res.consent);
      } catch (err) {
        if (cancelled) return;
        setLoadError("Couldn't load your settings. Try again later.");
        console.warn("[Settings] consent GET failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const onToggle = React.useCallback(
    async (type: ConsentType, next: boolean) => {
      // Optimistic update; revert on failure.
      const prev = consent;
      if (consent) setConsent({ ...consent, [type]: next });
      try {
        await applyConsentToggle(api, type, next);
      } catch (err) {
        console.warn("[Settings] consent PATCH failed", err);
        // Revert.
        if (prev) setConsent(prev);
        Alert.alert(
          "Couldn't save",
          "Please check your connection and try again.",
        );
      }
    },
    [api, consent],
  );

  const onSignOut = React.useCallback(async () => {
    setSigningOut(true);
    try {
      await api.signOut();
    } catch (err) {
      console.warn("[Settings] signOut failed", err);
    } finally {
      setSigningOut(false);
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: "SignIn" }],
        }),
      );
    }
  }, [api, navigation]);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: active.bgPrimary },
        content: {
          padding: theme.spacing.lg,
          gap: theme.spacing.md,
        },
        title: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.serif,
          fontSize: theme.typography.sizes["2xl"],
        },
        sectionLabel: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.sm,
          fontWeight: "600",
          marginTop: theme.spacing.md,
          marginBottom: theme.spacing.xs,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        },
        accountCard: {
          backgroundColor: active.bgSecondary,
          borderColor: active.border,
          borderWidth: 1,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.md,
          gap: theme.spacing.xs,
        },
        accountValue: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
        },
        accountLabel: {
          color: active.textMuted,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.xs,
        },
        toggleRow: {
          backgroundColor: active.bgSecondary,
          borderColor: active.border,
          borderWidth: 1,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.md,
          gap: theme.spacing.xs,
        },
        toggleHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: theme.spacing.sm,
        },
        toggleLabel: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
          fontWeight: "600",
          flexShrink: 1,
        },
        toggleBody: {
          color: active.textSecondary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.sm,
        },
        inertHint: {
          color: active.warning,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.xs,
          fontStyle: "italic",
        },
        signOutBtn: {
          backgroundColor: active.bgSecondary,
          borderColor: active.error,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          paddingVertical: theme.spacing.md,
          alignItems: "center",
          marginTop: theme.spacing.md,
          minHeight: 44,
          justifyContent: "center",
        },
        signOutText: {
          color: active.error,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
          fontWeight: "600",
        },
        loadError: {
          color: active.error,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.sm,
        },
      }),
    [active, theme],
  );

  const user = api.getCurrentUser();

  if (consent == null && loadError == null) {
    return (
      <View
        style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}
      >
        <ActivityIndicator color={active.accentPrimary} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Text style={styles.title}>Settings</Text>

      <Text style={styles.sectionLabel}>Account</Text>
      <View style={styles.accountCard}>
        <Text style={styles.accountLabel}>Signed in as</Text>
        <Text style={styles.accountValue}>{user?.email ?? "Unknown"}</Text>
      </View>

      <Text style={styles.sectionLabel}>Privacy & Data</Text>
      {loadError != null && <Text style={styles.loadError}>{loadError}</Text>}
      {consent != null &&
        (Object.keys(TOGGLE_COPY) as ConsentType[]).map((type) => {
          const copy = TOGGLE_COPY[type];
          const value = consent[type];
          return (
            <View key={type} style={styles.toggleRow}>
              <View style={styles.toggleHeader}>
                <Text style={styles.toggleLabel}>{copy.label}</Text>
                <Switch
                  accessibilityLabel={copy.label}
                  onValueChange={(next) => onToggle(type, next)}
                  value={value}
                />
              </View>
              <Text style={styles.toggleBody}>{copy.body}</Text>
              {copy.phase1Inert && (
                <Text style={styles.inertHint}>
                  Toggling this has no effect in this version.
                </Text>
              )}
            </View>
          );
        })}

      <Pressable
        accessibilityRole="button"
        disabled={signingOut}
        onPress={onSignOut}
        style={({ pressed }) => [
          styles.signOutBtn,
          (signingOut || pressed) && { opacity: 0.5 },
        ]}
      >
        {signingOut ? (
          <ActivityIndicator color={active.error} />
        ) : (
          <Text style={styles.signOutText}>Sign out</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

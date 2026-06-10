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

import type { ConsentGetResponse } from "@/api/routeContracts";
import { useApiClient } from "@/auth";
import type { RootStackParamList } from "@/navigation/types";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import {
  applyConsentToggle,
  type ConsentType,
} from "./settings/consentToggle";

type Nav = NativeStackNavigationProp<RootStackParamList>;

// The consent map shape comes from the network contract — see
// src/api/routeContracts.ts. Single source of truth across mobile.
type ConsentSnapshot = ConsentGetResponse["consent"];

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
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();

  const [consent, setConsent] = React.useState<ConsentSnapshot | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [signingOut, setSigningOut] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.apiGet<ConsentGetResponse>("/api/consent");
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
    () => {
      // Shared white r-18 surface card (mockup .card).
      const cardSurface = {
        backgroundColor: redesign.surface,
        borderColor: redesign.line,
        borderWidth: 1,
        borderRadius: redesign.rCard,
        padding: theme.spacing.md,
        gap: theme.spacing.xs,
        shadowColor: redesign.ink,
        shadowOpacity: 0.05,
        shadowRadius: 7,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      };
      return StyleSheet.create({
        screen: { flex: 1, backgroundColor: redesign.paper },
        content: {
          padding: theme.spacing.space5,
          gap: theme.spacing.space3,
        },
        // Mockup .scr-title: Bricolage display, ink.
        title: {
          color: redesign.ink,
          fontSize: theme.typography.sizes["2xl"],
          letterSpacing: -0.5,
          ...fontStyle("display", 700, fontsLoaded),
        },
        // Eyebrow: body 600, 11px, tracked, uppercase, ink-3.
        sectionLabel: {
          color: redesign.ink3,
          fontSize: 11,
          letterSpacing: 11 * 0.15,
          marginTop: theme.spacing.space3,
          marginBottom: theme.spacing.xs,
          textTransform: "uppercase",
          ...fontStyle("body", 600, fontsLoaded),
        },
        accountCard: cardSurface,
        accountValue: {
          color: redesign.ink,
          fontSize: theme.typography.sizes.base,
          ...fontStyle("body", 500, fontsLoaded),
        },
        accountLabel: {
          color: redesign.ink3,
          fontSize: theme.typography.sizes.xs,
          ...fontStyle("body", 400, fontsLoaded),
        },
        toggleRow: cardSurface,
        toggleHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          gap: theme.spacing.sm,
        },
        toggleLabel: {
          color: redesign.ink,
          fontSize: theme.typography.sizes.base,
          flexShrink: 1,
          ...fontStyle("body", 600, fontsLoaded),
        },
        toggleBody: {
          color: redesign.ink2,
          fontSize: theme.typography.sizes.sm,
          lineHeight: theme.typography.sizes.sm * 1.45,
          ...fontStyle("body", 400, fontsLoaded),
        },
        inertHint: {
          color: redesign.amber,
          fontSize: theme.typography.sizes.xs,
          fontStyle: "italic",
          ...fontStyle("body", 400, fontsLoaded),
        },
        // Sign-out: ghost card with the alarm accent (the alarm token's
        // calm UI use), not a filled alarm button.
        signOutBtn: {
          backgroundColor: redesign.surface,
          borderColor: redesign.alarm,
          borderWidth: 1,
          borderRadius: theme.radii.xl - 2,
          paddingVertical: theme.spacing.md,
          alignItems: "center",
          marginTop: theme.spacing.md,
          minHeight: 48,
          justifyContent: "center",
        },
        signOutText: {
          color: redesign.alarm,
          fontSize: theme.typography.sizes.base,
          ...fontStyle("body", 600, fontsLoaded),
        },
        loadError: {
          color: redesign.alarm,
          fontSize: theme.typography.sizes.sm,
          ...fontStyle("body", 400, fontsLoaded),
        },
      });
    },
    [theme, redesign, fontsLoaded],
  );

  const user = api.getCurrentUser();

  if (consent == null && loadError == null) {
    return (
      <View
        style={[styles.screen, { alignItems: "center", justifyContent: "center" }]}
      >
        <ActivityIndicator color={redesign.teal} />
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
                  trackColor={{ false: redesign.line2, true: redesign.teal }}
                  thumbColor={redesign.surface}
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
          <ActivityIndicator color={redesign.alarm} />
        ) : (
          <Text style={styles.signOutText}>Sign out</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

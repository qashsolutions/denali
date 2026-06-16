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
import { Lock } from "lucide-react-native";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ConsentGetResponse } from "@/api/routeContracts";
import { isBiometricAvailable, useApiClient } from "@/auth";
import { BackupSettingsCard } from "@/backup/ui/BackupSettingsCard";
import { PressableScale } from "@/components/PressableScale";
import { Skeleton } from "@/components/Skeleton";
import { hapticSelection } from "@/feedback/haptics";
import type { RootStackParamList } from "@/navigation/types";
import { fontStyle, MAX_FONT_SCALE, useFontsLoaded } from "@/theme/fonts";
import { useThemeMode, type ThemeMode } from "@/theme/ThemeMode";
import { useTheme } from "@/theme/useTheme";

import {
  applyConsentToggle,
  type ConsentType,
} from "./settings/consentToggle";
import { useReminders } from "@/notifications/useReminders";

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

// ZK backup UI is flag-gated (off by default): it stays hidden until the
// backup_blobs migration is applied + the flow is verified on-device, so it
// can't surface a /api/backup that 500s pre-migration. Opt-in + staging-first
// per docs/design/zk-backup-v1.md §9. Flip EXPO_PUBLIC_BACKUP_ENABLED=true to show.
const BACKUP_FEATURE_ENABLED = process.env.EXPO_PUBLIC_BACKUP_ENABLED === "true";

// Appearance control — "System" first so the default reads as "follow my
// device". Stored locally (see ThemeMode.tsx); no server round-trip.
const THEME_MODE_OPTIONS: ReadonlyArray<{ mode: ThemeMode; label: string }> = [
  { mode: "system", label: "System" },
  { mode: "light", label: "Light" },
  { mode: "dark", label: "Dark" },
];

export function SettingsScreen(): React.ReactElement {
  const api = useApiClient();
  const navigation = useNavigation<Nav>();
  const { theme, redesign, scheme } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const insets = useSafeAreaInsets();
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();

  // Switch colors are mode-aware. In dark mode the naive choices collapse:
  // `surface` thumb == card background (invisible) and a `line2` off-track sits
  // ~3% off `surface`, so an OFF toggle disappears. Dark mode therefore uses a
  // near-white (`ink`) thumb that reads on both the OFF track and the teal ON
  // track, plus the more visible `line` hairline for the off-track. Light mode
  // is unchanged — its white thumb is defined by Android's elevation shadow.
  const dark = scheme === "dark";
  const switchThumb = dark ? redesign.ink : redesign.surface;
  const switchOffTrack = dark ? redesign.line : redesign.line2;

  const {
    enabled: remindersEnabled,
    loading: remindersLoading,
    lastError: remindersError,
    setEnabled: setRemindersEnabled,
  } = useReminders();

  const [consent, setConsent] = React.useState<ConsentSnapshot | null>(null);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [signingOut, setSigningOut] = React.useState(false);
  // App-lock status is read-only: it reflects whether the DEVICE has a
  // biometric/credential enrolled, which is what the always-on launch gate
  // (biometricGate.ts, decision D15) keys off. null = still checking; we
  // render the row only once resolved so we never flash a wrong state.
  const [lockEnrolled, setLockEnrolled] = React.useState<boolean | null>(null);
  // App-lock status copy. Platform-correct wording (Face ID / Touch ID on iOS,
  // fingerprint / face unlock on Android) — the launch gate uses whichever the
  // device offers, with the device passcode/PIN as fallback.
  const lockStatusCopy = lockEnrolled
    ? Platform.OS === "ios"
      ? "On — Denali unlocks with Face ID, Touch ID, or your device passcode."
      : "On — Denali unlocks with your fingerprint, face unlock, or device PIN."
    : Platform.OS === "ios"
      ? "Off — set up Face ID or a passcode in your device settings to lock Denali."
      : "Off — set up a fingerprint or screen lock in your device settings to lock Denali.";

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

  React.useEffect(() => {
    let cancelled = false;
    void isBiometricAvailable().then((ok) => {
      if (!cancelled) setLockEnrolled(ok);
    });
    return () => {
      cancelled = true;
    };
  }, []);

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
          paddingTop: insets.top + theme.spacing.space5,
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
        remindersRow: cardSurface,
        lockCard: cardSurface,
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
        remindersErrorHint: {
          color: redesign.alarm,
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
        // Appearance segmented control — pill-track of three equal segments,
        // the active one tinted teal-wash with teal-deep text.
        segmentRow: {
          flexDirection: "row",
          backgroundColor: redesign.surface,
          borderColor: redesign.line,
          borderWidth: 1,
          borderRadius: redesign.rChip,
          padding: theme.spacing.xs,
          gap: theme.spacing.xs,
        },
        segment: {
          flex: 1,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
          borderRadius: redesign.rChip - 2,
        },
        segmentSelected: {
          backgroundColor: redesign.tealWash,
        },
        segmentText: {
          color: redesign.ink2,
          fontSize: theme.typography.sizes.base,
          ...fontStyle("body", 500, fontsLoaded),
        },
        segmentTextSelected: {
          color: redesign.tealDeep,
          ...fontStyle("body", 600, fontsLoaded),
        },
      });
    },
    [theme, redesign, fontsLoaded, insets.top],
  );

  const user = api.getCurrentUser();

  if (consent == null && loadError == null) {
    // Content-shaped skeletons (title + account card + a couple of setting
    // cards) read as "loading your settings" better than a centered spinner.
    return (
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <Skeleton width={130} height={28} radius={8} />
        <Skeleton
          height={68}
          radius={redesign.rCard}
          style={{ marginTop: theme.spacing.space3 }}
        />
        <Skeleton
          height={48}
          radius={redesign.rChip}
          style={{ marginTop: theme.spacing.space3 }}
        />
        <Skeleton
          height={96}
          radius={redesign.rCard}
          style={{ marginTop: theme.spacing.space3 }}
        />
        <Skeleton
          height={96}
          radius={redesign.rCard}
          style={{ marginTop: theme.spacing.space3 }}
        />
      </ScrollView>
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

      <Text style={styles.sectionLabel}>Appearance</Text>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Appearance"
        style={styles.segmentRow}
      >
        {THEME_MODE_OPTIONS.map((opt) => {
          const selected = themeMode === opt.mode;
          return (
            <Pressable
              key={opt.mode}
              testID={`settings_theme_${opt.mode}`}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              accessibilityLabel={`${opt.label} appearance`}
              onPress={() => {
                hapticSelection();
                setThemeMode(opt.mode);
              }}
              style={[styles.segment, selected && styles.segmentSelected]}
            >
              <Text
                maxFontSizeMultiplier={MAX_FONT_SCALE}
                style={[
                  styles.segmentText,
                  selected && styles.segmentTextSelected,
                ]}
              >
                {opt.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.sectionLabel}>Reminders</Text>
      <View style={styles.remindersRow}>
        <View style={styles.toggleHeader}>
          <Text style={styles.toggleLabel}>Check-in reminders</Text>
          {remindersLoading ? (
            <ActivityIndicator size="small" color={redesign.teal} />
          ) : (
            <Switch
              testID="settings_reminders_toggle"
              accessibilityLabel="Check-in reminders"
              onValueChange={(next) => {
                hapticSelection();
                setRemindersEnabled(next);
              }}
              value={remindersEnabled}
              trackColor={{ false: switchOffTrack, true: redesign.teal }}
              thumbColor={switchThumb}
            />
          )}
        </View>
        <Text style={styles.toggleBody}>
          Receive gentle nudges to log how you are doing. Reminders are
          scheduled locally on your device — no data is sent to any server.
        </Text>
        {remindersError === "permission_denied" && (
          <Text style={styles.remindersErrorHint}>
            Notification permission was denied. Enable notifications for Denali
            in your device settings to use reminders.
          </Text>
        )}
        {remindersError === "error" && (
          <Text style={styles.remindersErrorHint}>
            Could not schedule reminders. Please try again.
          </Text>
        )}
      </View>

      <Text style={styles.sectionLabel}>Privacy & Data</Text>
      {lockEnrolled !== null && (
        <View
          style={styles.lockCard}
          accessibilityLabel={`App lock. ${lockStatusCopy}`}
        >
          <View style={styles.toggleHeader}>
            <Text style={styles.toggleLabel}>App lock</Text>
            <Lock
              color={lockEnrolled ? redesign.tealDeep : redesign.ink3}
              size={20}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
          </View>
          <Text style={styles.toggleBody}>{lockStatusCopy}</Text>
        </View>
      )}
      {loadError != null && <Text style={styles.loadError}>{loadError}</Text>}
      {consent != null &&
        (Object.keys(TOGGLE_COPY) as ConsentType[])
          .filter((type) => type !== "health_data_storage")
          .map((type) => {
          const copy = TOGGLE_COPY[type];
          const value = consent[type];
          return (
            <View key={type} style={styles.toggleRow}>
              <View style={styles.toggleHeader}>
                <Text style={styles.toggleLabel}>{copy.label}</Text>
                <Switch
                  accessibilityLabel={copy.label}
                  onValueChange={(next) => {
                    hapticSelection();
                    onToggle(type, next);
                  }}
                  value={value}
                  trackColor={{ false: switchOffTrack, true: redesign.teal }}
                  thumbColor={switchThumb}
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

      {consent != null && BACKUP_FEATURE_ENABLED && (
        <BackupSettingsCard
          storageConsent={consent.health_data_storage}
          onStorageConsentChange={(granted) =>
            onToggle("health_data_storage", granted)
          }
        />
      )}

      <PressableScale
        accessibilityRole="button"
        disabled={signingOut}
        onPress={onSignOut}
        style={[styles.signOutBtn, signingOut && { opacity: 0.5 }]}
      >
        {signingOut ? (
          <ActivityIndicator color={redesign.alarm} />
        ) : (
          <Text style={styles.signOutText}>Sign out</Text>
        )}
      </PressableScale>
    </ScrollView>
  );
}

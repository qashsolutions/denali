/**
 * LockScreen — shown on cold launch when a restored session is held behind
 * a failed/cancelled biometric gate (decision D15).
 *
 * The session is valid (tokens restored, within the 30-day cap) — the user
 * just hasn't passed the device-presence check yet. "Unlock" re-runs the
 * gate; "Sign in with a different email" signs out and returns to OTP. The
 * screen never exposes any health data or token.
 *
 * Theme tokens via useTheme(); no hardcoded hex.
 */
import { Lock } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/useTheme";

export interface LockScreenProps {
  /** Re-run the biometric gate. */
  onUnlock: () => void;
  /** Sign out (clear the session) and return to email OTP. */
  onSignOut: () => void;
  /** True while a gate / sign-out call is in flight. */
  busy: boolean;
}

export function LockScreen({
  onUnlock,
  onSignOut,
  busy,
}: LockScreenProps): React.ReactElement {
  const { active, theme } = useTheme();
  const insets = useSafeAreaInsets();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          backgroundColor: active.bgPrimary,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        },
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: theme.spacing.lg,
          gap: theme.spacing.md,
        },
        iconChip: {
          width: 64,
          height: 64,
          borderRadius: theme.radii.xl,
          backgroundColor: active.bgSecondary,
          alignItems: "center",
          justifyContent: "center",
          marginBottom: theme.spacing.sm,
        },
        title: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.serif,
          fontSize: theme.typography.sizes["2xl"],
          textAlign: "center",
        },
        subtitle: {
          color: active.textSecondary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
          textAlign: "center",
          lineHeight: theme.typography.sizes.base * 1.5,
          marginBottom: theme.spacing.sm,
        },
        button: {
          backgroundColor: active.accentPrimary,
          borderRadius: theme.radii.md,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.xl,
          minHeight: 48,
          minWidth: 200,
          alignItems: "center",
          justifyContent: "center",
        },
        buttonText: {
          color: active.bgPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
          fontWeight: "600",
        },
        link: {
          color: active.accentPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.sm,
          textAlign: "center",
          marginTop: theme.spacing.sm,
        },
      }),
    [active, theme, insets.top, insets.bottom],
  );

  return (
    <View style={styles.screen}>
      <View style={styles.center}>
        <View style={styles.iconChip}>
          <Lock color={active.accentPrimary} size={28} />
        </View>
        <Text style={styles.title}>Denali is locked</Text>
        <Text style={styles.subtitle}>
          Unlock with your device biometrics or passcode to continue.
        </Text>
        <Pressable
          testID="lock_unlock_button"
          accessibilityRole="button"
          accessibilityLabel="Unlock"
          disabled={busy}
          onPress={onUnlock}
          style={({ pressed }) => [
            styles.button,
            (busy || pressed) && { opacity: 0.6 },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={active.bgPrimary} />
          ) : (
            <Text style={styles.buttonText}>Unlock</Text>
          )}
        </Pressable>
        <Pressable
          testID="lock_signout_button"
          accessibilityRole="button"
          accessibilityLabel="Sign in with a different email"
          disabled={busy}
          onPress={onSignOut}
        >
          <Text style={styles.link}>Sign in with a different email</Text>
        </Pressable>
      </View>
    </View>
  );
}

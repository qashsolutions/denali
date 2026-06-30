/**
 * BackupSettingsCard — the Settings surface for zero-knowledge cloud backup
 * (D16). Drives the `health_data_storage` consent (the persistent opt-in) and
 * the on-device flows: enable (mint key -> show recovery kit -> upload), back up
 * now, show recovery phrase, restore (new device), turn off.
 *
 * UI state derives from what's true on THIS device:
 *   - a local recovery key present  -> backup is on here (status + actions)
 *   - no local key but consent on    -> likely a new device -> offer restore
 *   - neither                        -> off -> offer enable
 */

import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import {
  backupNow,
  disableBackup,
  enableBackup,
} from "@/backup/backupController";
import { recoveryKeyToPhrase } from "@/backup/recoveryKey";
import { useBackupDeps } from "@/backup/useBackupDeps";
import { hapticSuccess } from "@/feedback/haptics";
import type { RootStackParamList } from "@/navigation/types";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import { RecoveryKitModal } from "./RecoveryKitModal";

type Nav = NativeStackNavigationProp<RootStackParamList>;
type CardState = "loading" | "off" | "on" | "restore";

export interface BackupSettingsCardProps {
  /** Current `health_data_storage` consent (persistent opt-in). */
  storageConsent: boolean;
  /** Persist the opt-in (PATCH /api/consent) after enable/disable. */
  onStorageConsentChange: (granted: boolean) => void | Promise<void>;
}

export function BackupSettingsCard({
  storageConsent,
  onStorageConsentChange,
}: BackupSettingsCardProps): React.ReactElement {
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const navigation = useNavigation<Nav>();
  const deps = useBackupDeps();

  const [state, setState] = React.useState<CardState>("loading");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [kitPhrase, setKitPhrase] = React.useState<string | null>(null);
  const [kitIsSetup, setKitIsSetup] = React.useState(false);

  // Resolve the device's backup state once the DAL/deps are ready.
  React.useEffect(() => {
    let cancelled = false;
    if (!deps) return;
    (async () => {
      try {
        const rk = await deps.store.load();
        if (cancelled) return;
        setState(rk ? "on" : storageConsent ? "restore" : "off");
      } catch (err) {
        if (!cancelled) setState(storageConsent ? "restore" : "off");
        console.warn("[Backup] state probe failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [deps, storageConsent]);

  const onEnable = React.useCallback(async () => {
    if (!deps || busy) return;
    setError(null);
    setBusy(true);
    try {
      const { phrase } = await enableBackup(deps);
      hapticSuccess();
      setKitIsSetup(true);
      setKitPhrase(phrase);
    } catch (err) {
      setError("Couldn't turn on backup. Please try again.");
      console.warn("[Backup] enable failed", err);
    } finally {
      setBusy(false);
    }
  }, [deps, busy]);

  const onKitConfirm = React.useCallback(async () => {
    setKitPhrase(null);
    if (kitIsSetup) {
      await onStorageConsentChange(true);
      setState("on");
      setKitIsSetup(false);
    }
  }, [kitIsSetup, onStorageConsentChange]);

  const onBackupNow = React.useCallback(async () => {
    if (!deps || busy) return;
    setError(null);
    setBusy(true);
    try {
      await backupNow(deps);
      hapticSuccess();
      Alert.alert("Backed up", "Your latest health record is safely backed up.");
    } catch (err) {
      setError("Backup failed. Please try again when you're online.");
      console.warn("[Backup] backupNow failed", err);
    } finally {
      setBusy(false);
    }
  }, [deps, busy]);

  const onShowPhrase = React.useCallback(async () => {
    if (!deps) return;
    try {
      const rk = await deps.store.load();
      if (rk) {
        setKitIsSetup(false);
        setKitPhrase(recoveryKeyToPhrase(rk));
      }
    } catch {
      // Static label only — the native error can carry the operated-on value.
      console.warn("[Backup] show-phrase failed");
    }
  }, [deps]);

  const onTurnOff = React.useCallback(() => {
    Alert.alert(
      "Turn off backup?",
      "Your encrypted backup will be deleted from the server. Your on-device record is unaffected.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Turn off",
          style: "destructive",
          onPress: async () => {
            if (!deps) return;
            setBusy(true);
            try {
              await disableBackup(deps);
              await onStorageConsentChange(false);
              setState("off");
            } catch (err) {
              setError("Couldn't turn off backup. Please try again.");
              console.warn("[Backup] disable failed", err);
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }, [deps, onStorageConsentChange]);

  const styles = React.useMemo(
    () => makeStyles(theme, redesign, fontsLoaded),
    [theme, redesign, fontsLoaded],
  );

  return (
    <View style={styles.card} testID="backup_settings_card">
      <Text style={styles.label}>Cloud backup (zero-knowledge)</Text>
      <Text style={styles.body}>
        Encrypt your health record on this device and store it so you can recover
        it on a new phone. Denali stores only encrypted data it can&apos;t read.
      </Text>

      {error != null && <Text style={styles.error}>{error}</Text>}

      {state === "loading" && <ActivityIndicator color={redesign.teal} />}

      {state === "off" && (
        <Pressable
          accessibilityRole="button"
          testID="backup_enable"
          disabled={busy || deps == null}
          onPress={onEnable}
          style={({ pressed }) => [styles.primaryBtn, (busy || pressed) && { opacity: 0.6 }]}
        >
          {busy ? (
            <ActivityIndicator color={redesign.surface} />
          ) : (
            <Text style={styles.primaryText}>Turn on backup</Text>
          )}
        </Pressable>
      )}

      {state === "restore" && (
        <Pressable
          accessibilityRole="button"
          testID="backup_restore_entry"
          onPress={() => navigation.navigate("RestoreBackup")}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.6 }]}
        >
          <Text style={styles.primaryText}>Restore your health record</Text>
        </Pressable>
      )}

      {state === "on" && (
        <View style={styles.actions}>
          <Text style={styles.statusOn}>Backup is on for this device.</Text>
          <Pressable
            accessibilityRole="button"
            testID="backup_now"
            disabled={busy}
            onPress={onBackupNow}
            style={({ pressed }) => [styles.primaryBtn, (busy || pressed) && { opacity: 0.6 }]}
          >
            {busy ? (
              <ActivityIndicator color={redesign.surface} />
            ) : (
              <Text style={styles.primaryText}>Back up now</Text>
            )}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            testID="backup_show_phrase"
            onPress={onShowPhrase}
            style={({ pressed }) => [styles.ghostBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.ghostText}>Show recovery phrase</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            testID="backup_disable"
            onPress={onTurnOff}
            style={({ pressed }) => [styles.dangerBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.dangerText}>Turn off backup</Text>
          </Pressable>
        </View>
      )}

      <RecoveryKitModal
        visible={kitPhrase != null}
        phrase={kitPhrase ?? ""}
        confirmLabel={kitIsSetup ? "I've saved my recovery phrase" : "Done"}
        onConfirm={onKitConfirm}
      />
    </View>
  );
}

function makeStyles(
  theme: ReturnType<typeof useTheme>["theme"],
  redesign: ReturnType<typeof useTheme>["redesign"],
  fontsLoaded: boolean,
) {
  return StyleSheet.create({
    card: {
      backgroundColor: redesign.surface,
      borderColor: redesign.line,
      borderWidth: 1,
      borderRadius: redesign.rCard,
      padding: theme.spacing.md,
      gap: theme.spacing.sm,
    },
    label: {
      color: redesign.ink,
      fontSize: theme.typography.sizes.base,
      ...fontStyle("body", 600, fontsLoaded),
    },
    body: {
      color: redesign.ink2,
      fontSize: theme.typography.sizes.sm,
      lineHeight: theme.typography.sizes.sm * 1.45,
      ...fontStyle("body", 400, fontsLoaded),
    },
    error: {
      color: redesign.alarm,
      fontSize: theme.typography.sizes.sm,
      ...fontStyle("body", 400, fontsLoaded),
    },
    actions: { gap: theme.spacing.sm },
    statusOn: {
      color: redesign.tealDeep,
      fontSize: theme.typography.sizes.sm,
      ...fontStyle("body", 600, fontsLoaded),
    },
    primaryBtn: {
      backgroundColor: redesign.teal,
      borderRadius: theme.radii.lg,
      paddingVertical: theme.spacing.md,
      alignItems: "center",
      minHeight: 48,
      justifyContent: "center",
    },
    primaryText: {
      color: redesign.surface,
      fontSize: theme.typography.sizes.base,
      ...fontStyle("body", 600, fontsLoaded),
    },
    ghostBtn: {
      backgroundColor: redesign.surface,
      borderColor: redesign.line,
      borderWidth: 1,
      borderRadius: theme.radii.lg,
      paddingVertical: theme.spacing.md,
      alignItems: "center",
      minHeight: 48,
      justifyContent: "center",
    },
    ghostText: {
      color: redesign.tealDeep,
      fontSize: theme.typography.sizes.base,
      ...fontStyle("body", 600, fontsLoaded),
    },
    dangerBtn: {
      backgroundColor: redesign.surface,
      borderColor: redesign.alarm,
      borderWidth: 1,
      borderRadius: theme.radii.lg,
      paddingVertical: theme.spacing.md,
      alignItems: "center",
      minHeight: 48,
      justifyContent: "center",
    },
    dangerText: {
      color: redesign.alarm,
      fontSize: theme.typography.sizes.base,
      ...fontStyle("body", 600, fontsLoaded),
    },
  });
}

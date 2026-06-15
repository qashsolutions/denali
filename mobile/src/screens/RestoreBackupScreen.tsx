/**
 * RestoreBackupScreen — recover the on-device health record from the BIP39
 * recovery phrase (new device / device loss). Decryption happens on-device; the
 * server only ever returned ciphertext.
 */

import { useNavigation } from "@react-navigation/native";
import React from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { restoreFromPhrase } from "@/backup/backupController";
import { InvalidRecoveryPhraseError } from "@/backup/recoveryKey";
import { useBackupDeps } from "@/backup/useBackupDeps";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

export function RestoreBackupScreen(): React.ReactElement {
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const deps = useBackupDeps();

  const [phrase, setPhrase] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const onRestore = React.useCallback(async () => {
    if (!deps || busy) return;
    setError(null);
    setBusy(true);
    try {
      const result = await restoreFromPhrase(deps, phrase);
      if (result == null) {
        setError("No backup was found for your account.");
        return;
      }
      Alert.alert(
        "Restore complete",
        `Imported ${result.observationsInserted} record${result.observationsInserted === 1 ? "" : "s"} onto this device.`,
      );
      navigation.goBack();
    } catch (err) {
      if (err instanceof InvalidRecoveryPhraseError) {
        setError("That recovery phrase isn't valid. Check the words and try again.");
      } else {
        setError("Couldn't restore your backup. Please try again.");
      }
      console.warn("[Restore] failed", err);
    } finally {
      setBusy(false);
    }
  }, [deps, busy, phrase, navigation]);

  const styles = React.useMemo(
    () => makeStyles(theme, redesign, fontsLoaded, insets.top),
    [theme, redesign, fontsLoaded, insets.top],
  );

  const canSubmit = !busy && phrase.trim().length > 0 && deps != null;

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <Text style={styles.title}>Restore your health record</Text>
      <Text style={styles.body}>
        Enter the 24-word recovery phrase from your recovery kit. Your record is
        decrypted on this device — Denali never sees your phrase.
      </Text>
      <TextInput
        accessibilityLabel="Recovery phrase"
        testID="restore_phrase_input"
        multiline
        autoCapitalize="none"
        autoCorrect={false}
        value={phrase}
        onChangeText={setPhrase}
        placeholder="word1 word2 word3 …"
        placeholderTextColor={redesign.ink3}
        style={styles.input}
      />
      {error != null && <Text style={styles.error}>{error}</Text>}
      <Pressable
        accessibilityRole="button"
        testID="restore_submit"
        disabled={!canSubmit}
        onPress={onRestore}
        style={({ pressed }) => [
          styles.submitBtn,
          (!canSubmit || pressed) && { opacity: 0.5 },
        ]}
      >
        {busy ? (
          <ActivityIndicator color={redesign.surface} />
        ) : (
          <Text style={styles.submitText}>Restore</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

function makeStyles(
  theme: ReturnType<typeof useTheme>["theme"],
  redesign: ReturnType<typeof useTheme>["redesign"],
  fontsLoaded: boolean,
  insetTop: number,
) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: redesign.paper },
    content: {
      padding: theme.spacing.space5,
      paddingTop: insetTop + theme.spacing.space5,
      gap: theme.spacing.md,
    },
    title: {
      color: redesign.ink,
      fontSize: theme.typography.sizes["2xl"],
      letterSpacing: -0.5,
      ...fontStyle("display", 700, fontsLoaded),
    },
    body: {
      color: redesign.ink2,
      fontSize: theme.typography.sizes.sm,
      lineHeight: theme.typography.sizes.sm * 1.5,
      ...fontStyle("body", 400, fontsLoaded),
    },
    input: {
      minHeight: 120,
      backgroundColor: redesign.surface,
      color: redesign.ink,
      borderColor: redesign.line,
      borderWidth: 1,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.md,
      fontSize: theme.typography.sizes.base,
      textAlignVertical: "top",
      ...fontStyle("body", 400, fontsLoaded),
    },
    error: {
      color: redesign.alarm,
      fontSize: theme.typography.sizes.sm,
      ...fontStyle("body", 400, fontsLoaded),
    },
    submitBtn: {
      backgroundColor: redesign.teal,
      borderRadius: theme.radii.lg,
      paddingVertical: theme.spacing.md,
      alignItems: "center",
      minHeight: 48,
      justifyContent: "center",
    },
    submitText: {
      color: redesign.surface,
      fontSize: theme.typography.sizes.base,
      ...fontStyle("body", 600, fontsLoaded),
    },
  });
}

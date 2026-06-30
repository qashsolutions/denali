/**
 * RecoveryKitModal — shows the 24-word BIP39 recovery phrase ONCE at backup
 * setup (and on "Show recovery phrase"). The user must confirm they've saved it
 * before continuing. This is the only cross-device recovery path; the server
 * cannot see or recover it.
 */

import React from "react";
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

export interface RecoveryKitModalProps {
  visible: boolean;
  phrase: string;
  /** Confirm label — "I've saved it" on setup, "Done" on re-view. */
  confirmLabel?: string;
  onConfirm: () => void;
}

export function RecoveryKitModal({
  visible,
  phrase,
  confirmLabel = "I've saved my recovery phrase",
  onConfirm,
}: RecoveryKitModalProps): React.ReactElement {
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const insets = useSafeAreaInsets();
  const words = phrase.length > 0 ? phrase.split(" ") : [];
  const styles = React.useMemo(
    () => makeStyles(theme, redesign, fontsLoaded, insets.top),
    [theme, redesign, fontsLoaded, insets.top],
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onConfirm}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Your recovery phrase</Text>
          <Text style={styles.body}>
            Write these 24 words down in order and keep them somewhere safe. They
            are the only way to recover your health record if you lose this
            device — Denali can&apos;t see them and can&apos;t recover them for
            you.
          </Text>
          <View style={styles.grid}>
            {words.map((word, i) => (
              <View
                key={`${i}-${word}`}
                style={styles.wordChip}
                testID={`recovery_word_${i + 1}`}
              >
                <Text style={styles.wordNum}>{i + 1}</Text>
                <Text style={styles.word}>{word}</Text>
              </View>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            testID="recovery_kit_confirm"
            onPress={onConfirm}
            style={({ pressed }) => [styles.confirmBtn, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.confirmText}>{confirmLabel}</Text>
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
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
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: theme.spacing.sm,
      marginVertical: theme.spacing.sm,
    },
    wordChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      backgroundColor: redesign.surface,
      borderColor: redesign.line,
      borderWidth: 1,
      borderRadius: redesign.rChip,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
      minWidth: "30%",
    },
    wordNum: {
      color: redesign.ink3,
      fontSize: theme.typography.sizes.xs,
      ...fontStyle("numbers", 600, fontsLoaded),
    },
    word: {
      color: redesign.ink,
      fontSize: theme.typography.sizes.base,
      ...fontStyle("body", 500, fontsLoaded),
    },
    confirmBtn: {
      backgroundColor: redesign.tealDeep,
      borderRadius: theme.radii.lg,
      paddingVertical: theme.spacing.md,
      alignItems: "center",
      marginTop: theme.spacing.md,
      minHeight: 48,
      justifyContent: "center",
    },
    confirmText: {
      color: redesign.surface,
      fontSize: theme.typography.sizes.base,
      ...fontStyle("body", 600, fontsLoaded),
    },
  });
}

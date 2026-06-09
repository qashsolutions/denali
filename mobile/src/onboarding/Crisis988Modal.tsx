/**
 * Crisis988Modal — the LOAD-BEARING 988 safety surface.
 *
 * Renders a full-screen modal that is dismissible only via the explicit
 * "I understand" tap. Triggered when the user selects any response > 0 on
 * PHQ-9 item 9 (see `shouldShow988` in `instruments/safety.ts`).
 *
 * Buttons:
 *   - "Call 988"  → Linking.openURL("tel:988")
 *   - "Text 988"  → Linking.openURL("sms:988")
 *
 * Both schemes work on iOS and Android (Android dials/sends via the default
 * dialer/SMS app). If Linking.openURL rejects (rare — usually means no
 * dialer or sms app is installed), the modal stays open and surfaces a
 * fallback message; the user can still acknowledge to record the response.
 *
 * Visual: full-screen overlay on top of the InstrumentsScreen content,
 * theme-tokens for all colors / spacing. No hex literals.
 *
 * Hard rule from the agent definition: "The item-9 response is still
 * recorded as an observation AFTER the user acknowledges the safety
 * surface, not silently in the background." The caller is responsible
 * for deferring the observation insert until `onAcknowledge` fires.
 */
import React from "react";
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useTheme } from "@/theme/useTheme";

import { fw } from "./fontWeight";
import { CRISIS_988_COPY } from "./instruments/safety";

export interface Crisis988ModalProps {
  visible: boolean;
  /** Fires when the user taps "I understand". The caller then records the response. */
  onAcknowledge: () => void;
}

export function Crisis988Modal({
  visible,
  onAcknowledge,
}: Crisis988ModalProps): React.ReactElement {
  const { active, theme } = useTheme();

  const openUrl = React.useCallback(async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (!supported) {
        Alert.alert(
          "Cannot open",
          `This device cannot open ${url}. Please dial or text 988 directly.`,
        );
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert(
        "Cannot open",
        `Could not open ${url}. Please dial or text 988 directly.`,
      );
    }
  }, []);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: active.bgPrimary,
          padding: theme.spacing.lg,
          justifyContent: "center",
        },
        card: {
          backgroundColor: active.bgSecondary,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.xl,
          gap: theme.spacing.md,
          borderColor: theme.colors.conditions.light.healthRed.base,
          borderWidth: 2,
        },
        title: {
          fontSize: theme.typography.sizes["2xl"],
          fontFamily: theme.typography.fonts.serif,
          color: active.textPrimary,
          fontWeight: fw(theme.typography.weights.bold),
        },
        body: {
          fontSize: theme.typography.sizes.base,
          color: active.textPrimary,
          lineHeight:
            theme.typography.sizes.base * theme.typography.lineHeights.relaxed,
        },
        actions: {
          gap: theme.spacing.sm,
          marginTop: theme.spacing.sm,
        },
        actionButton: {
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radii.md,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
        },
        callButton: {
          backgroundColor: theme.colors.conditions.light.healthRed.base,
        },
        textButton: {
          backgroundColor: active.accentPrimary,
        },
        ackButton: {
          backgroundColor: active.bgTertiary,
          marginTop: theme.spacing.space5,
        },
        actionLabel: {
          color: active.bgPrimary,
          fontSize: theme.typography.sizes.base,
          fontWeight: fw(theme.typography.weights.semibold),
        },
        ackLabel: {
          color: active.textPrimary,
          fontSize: theme.typography.sizes.base,
          fontWeight: fw(theme.typography.weights.medium),
        },
      }),
    [active, theme],
  );

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      // Block back-press dismissal — the only exit is the acknowledge button.
      onRequestClose={() => {
        /* intentionally no-op */
      }}
    >
      <View
        testID="crisis988_modal"
        style={styles.backdrop}
        accessibilityViewIsModal
      >
        <View style={styles.card}>
          <Text
            style={styles.title}
            accessibilityRole="header"
            accessibilityLabel={CRISIS_988_COPY.title}
          >
            {CRISIS_988_COPY.title}
          </Text>
          <Text style={styles.body}>{CRISIS_988_COPY.body}</Text>
          <View style={styles.actions}>
            <Pressable
              testID="crisis988_call_button"
              style={[styles.actionButton, styles.callButton]}
              onPress={() => openUrl(CRISIS_988_COPY.callUrl)}
              accessibilityRole="button"
              accessibilityLabel={CRISIS_988_COPY.callLabel}
            >
              <Text style={styles.actionLabel}>{CRISIS_988_COPY.callLabel}</Text>
            </Pressable>
            <Pressable
              testID="crisis988_text_button"
              style={[styles.actionButton, styles.textButton]}
              onPress={() => openUrl(CRISIS_988_COPY.textUrl)}
              accessibilityRole="button"
              accessibilityLabel={CRISIS_988_COPY.textLabel}
            >
              <Text style={styles.actionLabel}>{CRISIS_988_COPY.textLabel}</Text>
            </Pressable>
            <Pressable
              testID="crisis988_acknowledge_button"
              style={[styles.actionButton, styles.ackButton]}
              onPress={onAcknowledge}
              accessibilityRole="button"
              accessibilityLabel={CRISIS_988_COPY.acknowledge}
            >
              <Text style={styles.ackLabel}>{CRISIS_988_COPY.acknowledge}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

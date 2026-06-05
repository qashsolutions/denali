/**
 * PrivacyNoticeScreen — plain-language data-locality notice.
 *
 * Surfaced BEFORE any data is collected (before CohortOnboardingScreen).
 * Per the agent spec § "Privacy / limitation notice", the user must
 * acknowledge before proceeding. The acknowledgement is local-only —
 * Phase 1 mobile does not have a server-side "privacy ack" record, but
 * the screen blocks navigation until the user taps the acknowledge
 * button, so the consent is recorded by the user reaching CohortOnboarding.
 *
 * No network calls. No DAL writes. Pure presentation.
 */
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useTheme } from "@/theme/useTheme";
import type { RootStackParamList } from "@/navigation/types";

import { fw } from "./fontWeight";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const POINTS: ReadonlyArray<string> = [
  "Your data lives on this device, encrypted.",
  "Nothing is backed up to the cloud in this version.",
  "If you lose this device, your data is lost. A backup option is coming in a later release.",
  "When you ask Denali for an analysis, your data is sent securely for that one analysis and is not stored on our servers.",
];

export function PrivacyNoticeScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const { active, theme } = useTheme();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          backgroundColor: active.bgPrimary,
        },
        scroll: {
          padding: theme.spacing.lg,
          gap: theme.spacing.lg,
        },
        title: {
          fontSize: theme.typography.sizes["3xl"],
          fontFamily: theme.typography.fonts.serif,
          color: active.textPrimary,
          fontWeight: fw(theme.typography.weights.bold),
          marginBottom: theme.spacing.sm,
        },
        subtitle: {
          fontSize: theme.typography.sizes.base,
          color: active.textSecondary,
          lineHeight:
            theme.typography.sizes.base * theme.typography.lineHeights.relaxed,
          marginBottom: theme.spacing.md,
        },
        card: {
          backgroundColor: active.bgSecondary,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.lg,
          borderColor: active.border,
          borderWidth: 1,
          gap: theme.spacing.md,
        },
        point: {
          fontSize: theme.typography.sizes.base,
          color: active.textPrimary,
          lineHeight:
            theme.typography.sizes.base * theme.typography.lineHeights.relaxed,
        },
        bullet: {
          color: active.accentPrimary,
          fontWeight: fw(theme.typography.weights.bold),
        },
        button: {
          backgroundColor: active.accentPrimary,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radii.md,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
          marginTop: theme.spacing.md,
        },
        buttonLabel: {
          color: active.bgPrimary,
          fontSize: theme.typography.sizes.base,
          fontWeight: fw(theme.typography.weights.semibold),
        },
      }),
    [active, theme],
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View>
          <Text style={styles.title}>Before we start</Text>
          <Text style={styles.subtitle}>
            A few things about how Denali handles your information.
          </Text>
        </View>
        <View style={styles.card}>
          {POINTS.map((point, idx) => (
            <Text key={idx} style={styles.point}>
              <Text style={styles.bullet}>• </Text>
              {point}
            </Text>
          ))}
        </View>
        <Pressable
          style={styles.button}
          onPress={() => navigation.navigate("CohortOnboarding")}
          accessibilityRole="button"
          accessibilityLabel="Acknowledge and continue"
        >
          <Text style={styles.buttonLabel}>Acknowledge and continue</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

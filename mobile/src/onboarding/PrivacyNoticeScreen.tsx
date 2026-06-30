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

import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";
import type { RootStackParamList } from "@/navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList>;

const POINTS: ReadonlyArray<string> = [
  "Your data lives on this device, encrypted.",
  "Nothing is backed up to the cloud in this version.",
  "If you lose this device, your data is lost. A backup option is coming in a later release.",
  "When you ask Denali for an analysis, your data is sent securely for that one analysis and is not stored on our servers.",
];

export function PrivacyNoticeScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        screen: {
          flex: 1,
          backgroundColor: redesign.paper,
        },
        scroll: {
          padding: theme.spacing.lg,
          gap: theme.spacing.lg,
        },
        title: {
          fontSize: theme.typography.sizes["3xl"],
          color: redesign.ink,
          letterSpacing: -0.5,
          marginBottom: theme.spacing.sm,
          ...fontStyle("display", 700, fontsLoaded),
        },
        subtitle: {
          fontSize: theme.typography.sizes.base,
          color: redesign.ink2,
          lineHeight:
            theme.typography.sizes.base * theme.typography.lineHeights.relaxed,
          marginBottom: theme.spacing.md,
          ...fontStyle("body", 400, fontsLoaded),
        },
        card: {
          backgroundColor: redesign.surface,
          borderRadius: redesign.rCard,
          padding: theme.spacing.lg,
          borderColor: redesign.line,
          borderWidth: 1,
          gap: theme.spacing.md,
        },
        point: {
          fontSize: theme.typography.sizes.base,
          color: redesign.ink,
          lineHeight:
            theme.typography.sizes.base * theme.typography.lineHeights.relaxed,
          ...fontStyle("body", 400, fontsLoaded),
        },
        bullet: {
          color: redesign.tealDeep,
          ...fontStyle("body", 600, fontsLoaded),
        },
        button: {
          backgroundColor: redesign.tealDeep,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.lg,
          borderRadius: theme.radii.xl - 2,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
          marginTop: theme.spacing.md,
        },
        buttonLabel: {
          color: redesign.surface,
          fontSize: theme.typography.sizes.base,
          ...fontStyle("body", 600, fontsLoaded),
        },
      }),
    [theme, redesign, fontsLoaded],
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
          testID="privacy_acknowledge_button"
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

/**
 * QuickAddSheet — the "+ Add" capture hub (bottom sheet).
 *
 * Surfaces the four intake sections (symptom · condition · family history ·
 * daily habits) as a low-friction sheet reachable from the Health tab, so
 * they stay enterable AFTER onboarding — not just during it. Each option
 * routes to IntakeOnboardingScreen via its standalone `section` param
 * (see navigation/types.ts). Built on RN's Modal — no new dependency.
 *
 * The scrim is a sibling `redesign.ink` layer at low opacity (not a
 * hardcoded rgba), so the sheet itself renders at full opacity above it.
 * Check-ins are logged from the per-card "New check-in" affordance and the
 * detail screen, so they're intentionally not duplicated here; Upload has
 * its own tab.
 */
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";

import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

export interface QuickAddOption {
  key: string;
  label: string;
  hint?: string;
  onPress: () => void;
}

export function QuickAddSheet({
  visible,
  onClose,
  options,
}: {
  visible: boolean;
  onClose: () => void;
  options: ReadonlyArray<QuickAddOption>;
}): React.ReactElement {
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const styles = React.useMemo(
    () => makeStyles(theme, redesign, fontsLoaded),
    [theme, redesign, fontsLoaded],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.container}>
        <Pressable
          style={styles.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <View style={styles.sheet} testID="quickadd_sheet">
          <View style={styles.handle} />
          <Text style={styles.title} accessibilityRole="header">
            Add to your health
          </Text>
          {options.map((o) => (
            <Pressable
              key={o.key}
              testID={`quickadd_${o.key}`}
              style={styles.option}
              onPress={o.onPress}
              accessibilityRole="button"
              accessibilityLabel={o.label}
            >
              <Text style={styles.optionLabel}>{o.label}</Text>
              {o.hint != null ? (
                <Text style={styles.optionHint}>{o.hint}</Text>
              ) : null}
            </Pressable>
          ))}
          <Pressable
            testID="quickadd_cancel"
            style={styles.cancel}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Cancel"
          >
            <Text style={styles.cancelLabel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(
  theme: ReturnType<typeof useTheme>["theme"],
  redesign: ReturnType<typeof useTheme>["redesign"],
  fontsLoaded: boolean,
) {
  return StyleSheet.create({
    container: { flex: 1, justifyContent: "flex-end" },
    backdrop: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: redesign.ink,
      opacity: 0.35,
    },
    sheet: {
      backgroundColor: redesign.surface,
      borderTopLeftRadius: redesign.rCard,
      borderTopRightRadius: redesign.rCard,
      paddingHorizontal: theme.spacing.space5,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xl,
    },
    handle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: theme.radii.sm,
      backgroundColor: redesign.line2,
      marginBottom: theme.spacing.sm,
    },
    title: {
      fontSize: theme.typography.sizes.lg,
      color: redesign.ink,
      marginBottom: theme.spacing.xs,
      ...fontStyle("display", 700, fontsLoaded),
    },
    option: {
      paddingVertical: theme.spacing.md,
      borderBottomColor: redesign.line,
      borderBottomWidth: 1,
      minHeight: 48,
      justifyContent: "center",
    },
    optionLabel: {
      fontSize: theme.typography.sizes.base,
      color: redesign.ink,
      ...fontStyle("body", 600, fontsLoaded),
    },
    optionHint: {
      fontSize: theme.typography.sizes.sm,
      color: redesign.ink2,
      marginTop: 2,
      ...fontStyle("body", 400, fontsLoaded),
    },
    cancel: {
      marginTop: theme.spacing.md,
      alignItems: "center",
      minHeight: 48,
      justifyContent: "center",
    },
    cancelLabel: {
      fontSize: theme.typography.sizes.base,
      color: redesign.tealDeep,
      ...fontStyle("body", 600, fontsLoaded),
    },
  });
}

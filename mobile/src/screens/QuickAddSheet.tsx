/**
 * QuickAddSheet — the "+ Add" capture hub (bottom sheet), now DRAG-TO-DISMISS.
 *
 * Surfaces the four intake sections (symptom · condition · family history ·
 * daily habits) as a low-friction sheet reachable from the Health tab. Each
 * option routes to IntakeOnboardingScreen via its standalone `section` param.
 *
 * Tier-4 gesture surface: the sheet rides a Reanimated `translateY` and a
 * gesture-handler `Pan` — drag it down to dismiss (snap-back if you don't pull
 * far/fast enough). Entrance stays the Modal's native slide; the scrim is a
 * `redesign.ink` layer at low opacity. Reanimated honors the OS reduce-motion
 * setting for the snap-back spring automatically.
 */
import React from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import { hapticSelection } from "@/feedback/haptics";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

export interface QuickAddOption {
  key: string;
  label: string;
  hint?: string;
  onPress: () => void;
}

// Drag this far (px) or flick this fast (px/s) to dismiss.
const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 800;

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
  const translateY = useSharedValue(0);

  // Reset the drag offset whenever we close so the next open starts at rest.
  const close = React.useCallback(() => {
    translateY.value = 0;
    onClose();
  }, [onClose, translateY]);

  const closeByDrag = React.useCallback(() => {
    hapticSelection();
    close();
  }, [close]);

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .onUpdate((e) => {
          // Only allow dragging DOWN; clamp upward pulls to 0.
          translateY.value = Math.max(0, e.translationY);
        })
        .onEnd((e) => {
          if (e.translationY > DISMISS_DISTANCE || e.velocityY > DISMISS_VELOCITY) {
            runOnJS(closeByDrag)();
          } else {
            translateY.value = withSpring(0, { damping: 18, stiffness: 220 });
          }
        }),
    [translateY, closeByDrag],
  );

  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  const styles = React.useMemo(
    () => makeStyles(theme, redesign, fontsLoaded),
    [theme, redesign, fontsLoaded],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={close}
    >
      <View style={styles.container}>
        <Pressable
          style={styles.backdrop}
          onPress={close}
          accessibilityRole="button"
          accessibilityLabel="Close"
        />
        <GestureDetector gesture={pan}>
          <Animated.View
            style={[styles.sheet, sheetStyle]}
            testID="quickadd_sheet"
          >
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
              onPress={close}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
            >
              <Text style={styles.cancelLabel}>Cancel</Text>
            </Pressable>
          </Animated.View>
        </GestureDetector>
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

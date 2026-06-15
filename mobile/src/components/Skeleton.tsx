/**
 * Skeleton — a calm pulsing placeholder block for loading states (perceived
 * performance over a bare spinner). Opacity-only pulse on the native driver, so
 * it's smooth on the New Architecture. Honors Reduce Motion (renders a static
 * block). Color comes from the theme (line2), so it adapts to light/dark.
 */

import React from "react";
import { Animated, StyleSheet, type ViewStyle } from "react-native";

import { useReducedMotion } from "@/a11y/useReducedMotion";
import { useTheme } from "@/theme/useTheme";

export interface SkeletonProps {
  width?: ViewStyle["width"];
  height?: number;
  radius?: number;
  style?: ViewStyle;
}

export function Skeleton({
  width = "100%",
  height = 16,
  radius = 8,
  style,
}: SkeletonProps): React.ReactElement {
  const { redesign } = useTheme();
  const reduced = useReducedMotion();
  const opacity = React.useRef(new Animated.Value(0.6)).current;

  React.useEffect(() => {
    if (reduced) {
      opacity.setValue(0.7);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, opacity]);

  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.block,
        { width, height, borderRadius: radius, backgroundColor: redesign.line2, opacity },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  block: { overflow: "hidden" },
});

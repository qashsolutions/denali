/**
 * PressableScale — a Pressable that gently scales down on press (0.97) for
 * tactile "this is a button" feedback. Native-driver transform (smooth on New
 * Arch); honors Reduce Motion (no scale). Drop-in for primary CTAs. Forwards
 * all Pressable props + an optional `haptic` cue on press-in.
 */

import React from "react";
import {
  Animated,
  Pressable,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useReducedMotion } from "@/a11y/useReducedMotion";
import { hapticTap } from "@/feedback/haptics";
import { motion } from "@/theme/motion";

export interface PressableScaleProps extends Omit<PressableProps, "style"> {
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
  /** Fire a light haptic on press-in. Default false. */
  haptic?: boolean;
}

export function PressableScale({
  style,
  children,
  haptic = false,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps): React.ReactElement {
  const reduced = useReducedMotion();
  const scale = React.useRef(new Animated.Value(1)).current;

  const to = React.useCallback(
    (value: number) => {
      if (reduced) return;
      Animated.timing(scale, {
        toValue: value,
        duration: motion.duration.fast,
        easing: motion.easing.standard,
        useNativeDriver: true,
      }).start();
    },
    [reduced, scale],
  );

  return (
    <Pressable
      onPressIn={(e) => {
        if (haptic) hapticTap();
        to(0.97);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        onPressOut?.(e);
      }}
      {...rest}
    >
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

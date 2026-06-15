/**
 * FadeInView — a subtle entrance: fade + a small upward slide on mount. Used to
 * make lists/cards feel alive without performing. Native-driver opacity +
 * translateY; honors Reduce Motion (renders fully visible, no motion). An
 * optional `delay` lets a list stagger its items gently.
 */

import React from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";

import { useReducedMotion } from "@/a11y/useReducedMotion";
import { motion } from "@/theme/motion";

export interface FadeInViewProps {
  children: React.ReactNode;
  /** Stagger offset in ms. */
  delay?: number;
  style?: StyleProp<ViewStyle>;
}

export function FadeInView({
  children,
  delay = 0,
  style,
}: FadeInViewProps): React.ReactElement {
  const reduced = useReducedMotion();
  const progress = React.useRef(new Animated.Value(reduced ? 1 : 0)).current;

  React.useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const anim = Animated.timing(progress, {
      toValue: 1,
      duration: motion.duration.base,
      delay,
      easing: motion.easing.standard,
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [reduced, progress, delay]);

  return (
    <Animated.View
      style={[
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [8, 0],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

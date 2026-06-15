/**
 * useReducedMotion — true when the OS "Reduce Motion" accessibility setting is
 * on. Every animation in the app gates on this so motion-sensitive users (and
 * the 45+ audience generally) get an instant, static UI. Defaults to false and
 * fails safe (no motion suppression) if the query throws.
 */

import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => {
        if (mounted) setReduced(v);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      (v) => setReduced(v),
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);

  return reduced;
}

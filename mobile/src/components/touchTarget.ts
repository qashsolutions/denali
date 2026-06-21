/**
 * Touch-target size constants + pure style helper (node-safe, no react-native
 * import) so the ≥48px guarantee is vitest-testable without a renderer.
 * `TouchTargetLink.tsx` consumes these; tests import them directly.
 */

/** The 45+ touch-target floor (D35). Effective target must reach this in BOTH dims. */
export const TOUCH_TARGET_MIN = 48;

/** Defense-in-depth slop on top of the ≥48 box (belt-and-braces if a parent clips). */
export const TOUCH_TARGET_HITSLOP = {
  top: 8,
  bottom: 8,
  left: 8,
  right: 8,
} as const;

/**
 * The base container style that GUARANTEES a ≥48px effective target in both
 * dimensions. Pure + node-testable (asserted in TouchTargetLink.test.ts).
 */
export function touchTargetBaseStyle(): {
  minHeight: number;
  minWidth: number;
  justifyContent: "center";
  alignItems: "center";
} {
  return {
    minHeight: TOUCH_TARGET_MIN,
    minWidth: TOUCH_TARGET_MIN,
    justifyContent: "center",
    alignItems: "center",
  };
}

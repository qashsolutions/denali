/**
 * TouchTargetLink — the ONE shared secondary-link control (A11Y-04).
 *
 * Every tappable text link (sign-in "Resend code" / "Use a different email",
 * the lock-screen "Sign in with a different email", Settings "Try again",
 * ReportDetail "Rename") routes through here so the TOUCH TARGET — not just the
 * visible text — always meets the 45+ floor: an effective ≥48px hit area in
 * BOTH dimensions (`minHeight` + `minWidth`), plus a defense-in-depth `hitSlop`.
 * The prior fix put a 48px style in SignInScreen alone; a reviewer flagged it as
 * screen-local, so the very next link (LockScreen) shipped bare again. A shared
 * component is the only thing that stops that recurrence — a future dev re-inlines
 * a raw <Pressable> and the touchTarget regression test (see __tests__) fails.
 *
 * COMPOSITION DECISION — standalone <Pressable>, deliberately NOT PressableScale.
 * PressableScale's press-scale bounce is a "this is a primary CTA" affordance;
 * inheriting it onto inline text links would read wrong (text shouldn't shrink
 * on tap) and is exactly the accidental-animation the spec warns against. So no
 * scale, no haptic — a plain, accessible Pressable.
 *
 * ALIGNMENT — the base box does NOT set `alignSelf`, so it inherits the parent's
 * cross-axis alignment (stretch/center/row) and reproduces each site's existing
 * layout. A site whose parent stretches its children but wants the link to hug
 * its content (ReportDetail "Rename", which must stay left-aligned) passes
 * `alignSelf: "flex-start"` via `containerStyle`. Per-site spacing (marginTop)
 * also comes through `containerStyle`.
 */
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import {
  TOUCH_TARGET_HITSLOP,
  touchTargetBaseStyle,
} from "./touchTarget";

export interface TouchTargetLinkProps {
  /** Visible link text (may differ from the screen-reader label, e.g. a cooldown). */
  label: string;
  onPress: () => void;
  /** MANDATORY screen-reader label (45+ cohort — labeling is in scope). */
  accessibilityLabel: string;
  /** Defaults to "button"; pass "link" for navigation-style links. */
  accessibilityRole?: "button" | "link";
  disabled?: boolean;
  testID?: string;
  /** Per-site text color/size/weight/align. */
  textStyle?: StyleProp<TextStyle>;
  /** Per-site spacing / alignSelf (the base box never sets alignSelf). */
  containerStyle?: StyleProp<ViewStyle>;
}

export function TouchTargetLink({
  label,
  onPress,
  accessibilityLabel,
  accessibilityRole = "button",
  disabled = false,
  testID,
  textStyle,
  containerStyle,
}: TouchTargetLinkProps): React.ReactElement {
  return (
    <Pressable
      testID={testID}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={TOUCH_TARGET_HITSLOP}
      style={[styles.base, disabled && styles.disabled, containerStyle]}
    >
      <Text style={textStyle}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: touchTargetBaseStyle(),
  // Uniform disabled affordance (SignIn already dimmed its disabled resend; this
  // makes every link consistent without changing tap behavior).
  disabled: { opacity: 0.5 },
});

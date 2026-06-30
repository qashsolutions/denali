/**
 * SliderInput — discrete numeric scale rendered without a native slider lib.
 *
 * Why no `@react-native-community/slider`: as of 2026-06, the canonical
 * community slider has no documented New-Architecture + RN-0.85 + SDK-56
 * support story. Adding a new turbo-module dependency is out of scope
 * for the Wave-2 redesign. The discrete-step rendering here is
 * functionally identical for our use cases (severity scales, BMI,
 * weight ranges) and matches the chip-style discrete severity already
 * used in the prior intake screen — extended to a continuous track
 * visual with a thumb indicator.
 *
 * The component renders:
 *   - The current value as a numeric readout (with optional unit)
 *   - The "min — max" endpoint labels
 *   - A horizontal track with a filled fraction proportional to value
 *   - Tappable hit zones aligned to each discrete step
 *
 * All values are snapped to `step` via the pure helper `snapToStep`.
 *
 * Theme tokens only — no hardcoded colors / spacing.
 */
import React from "react";
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import {
  clamp,
  sliderStepCount,
  snapToStep,
  valueAtStepIndex,
} from "./helpers";

export interface SliderInputProps {
  /** Inclusive minimum value. */
  min: number;
  /** Inclusive maximum value. */
  max: number;
  /** Step between adjacent positions. Must be > 0. */
  step: number;
  /** Current value. */
  value: number;
  /** Called with the snapped, clamped value when the user taps a position. */
  onChange: (value: number) => void;
  /** Optional unit displayed next to the readout (e.g. "kg", "BMI"). */
  unit?: string;
  /** Optional left-endpoint label (e.g. "No impact"). */
  minLabel?: string;
  /**
   * Optional midpoint anchor (e.g. "Moderate"). Renders centered between
   * the endpoints to give a subjective scale context without numeric
   * clutter — the live readout already shows the exact value.
   */
  midLabel?: string;
  /** Optional right-endpoint label (e.g. "Worst possible"). */
  maxLabel?: string;
  /** Accessibility label for the whole control. */
  accessibilityLabel?: string;
  /** Disables tap interaction. */
  disabled?: boolean;
}

const TRACK_HEIGHT = 6;
const THUMB_SIZE = 28;

export function SliderInput({
  min,
  max,
  step,
  value,
  onChange,
  unit,
  minLabel,
  midLabel,
  maxLabel,
  accessibilityLabel,
  disabled = false,
}: SliderInputProps): React.ReactElement {
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();

  const safeValue = React.useMemo(
    () => clamp(snapToStep(value, min, step), min, max),
    [value, min, step, max],
  );

  const stepCount = React.useMemo(
    () => sliderStepCount(min, max, step),
    [min, max, step],
  );

  // Layout-driven hit-zone width — measured once per layout pass.
  const [trackWidth, setTrackWidth] = React.useState(0);

  const handleTrackLayout = React.useCallback((e: LayoutChangeEvent) => {
    setTrackWidth(e.nativeEvent.layout.width);
  }, []);

  const handleStepTap = React.useCallback(
    (idx: number) => {
      if (disabled) return;
      const next = valueAtStepIndex(min, step, idx);
      onChange(clamp(next, min, max));
    },
    [disabled, max, min, onChange, step],
  );

  // Fraction of track filled, 0..1.
  const fillFraction = React.useMemo(() => {
    if (max <= min) return 0;
    return (safeValue - min) / (max - min);
  }, [max, min, safeValue]);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: theme.spacing.sm },
        readoutRow: {
          flexDirection: "row",
          alignItems: "baseline",
          gap: theme.spacing.xs,
        },
        readout: {
          fontSize: theme.typography.sizes["3xl"],
          color: redesign.ink,
          fontVariant: ["tabular-nums"],
          ...fontStyle("numbers", 600, fontsLoaded),
        },
        unit: {
          fontSize: theme.typography.sizes.base,
          color: redesign.ink2,
          ...fontStyle("body", 400, fontsLoaded),
        },
        trackOuter: {
          height: THUMB_SIZE,
          justifyContent: "center",
        },
        track: {
          height: TRACK_HEIGHT,
          borderRadius: theme.radii.sm,
          backgroundColor: redesign.line2,
          overflow: "hidden",
        },
        trackFill: {
          height: TRACK_HEIGHT,
          backgroundColor: redesign.tealDeep,
          borderRadius: theme.radii.sm,
        },
        thumb: {
          position: "absolute",
          width: THUMB_SIZE,
          height: THUMB_SIZE,
          borderRadius: THUMB_SIZE / 2,
          backgroundColor: redesign.tealDeep,
          borderColor: redesign.paper,
          borderWidth: 2,
        },
        hitOverlay: {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          flexDirection: "row",
        },
        hitZone: {
          flex: 1,
          height: THUMB_SIZE * 2, // generous vertical hit target
          // Center the row vertically over the track.
          marginVertical: -THUMB_SIZE / 2,
        },
        endpointRow: {
          flexDirection: "row",
        },
        endpointLabel: {
          flex: 1,
          fontSize: theme.typography.sizes.xs,
          color: redesign.ink2,
          ...fontStyle("body", 400, fontsLoaded),
        },
        labelLeft: { textAlign: "left" },
        labelMid: { textAlign: "center" },
        labelRight: { textAlign: "right" },
      }),
    [theme, redesign, fontsLoaded],
  );

  // Thumb x-position; clamp the centerline so the thumb stays fully
  // visible inside the track even at the endpoints.
  const thumbLeft = Math.max(
    0,
    Math.min(
      trackWidth - THUMB_SIZE,
      fillFraction * trackWidth - THUMB_SIZE / 2,
    ),
  );

  return (
    <View
      style={styles.wrap}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{
        min,
        max,
        now: safeValue,
        text: unit ? `${safeValue} ${unit}` : String(safeValue),
      }}
      accessibilityState={{ disabled }}
    >
      <View style={styles.readoutRow}>
        <Text style={styles.readout}>{safeValue}</Text>
        {unit ? <Text style={styles.unit}>{unit}</Text> : null}
      </View>
      <View style={styles.trackOuter} onLayout={handleTrackLayout}>
        <View style={styles.track}>
          <View
            style={[styles.trackFill, { width: `${fillFraction * 100}%` }]}
          />
        </View>
        {trackWidth > 0 ? (
          <View
            style={[
              styles.thumb,
              { left: thumbLeft, top: (THUMB_SIZE - THUMB_SIZE) / 2 },
            ]}
            accessible={false}
          />
        ) : null}
        <View style={styles.hitOverlay} pointerEvents="box-none">
          {Array.from({ length: stepCount }).map((_, idx) => (
            <Pressable
              key={idx}
              style={styles.hitZone}
              onPress={() => handleStepTap(idx)}
              disabled={disabled}
              accessibilityRole="adjustable"
              accessibilityLabel={`Step ${idx + 1} of ${stepCount}`}
            />
          ))}
        </View>
      </View>
      {minLabel != null || midLabel != null || maxLabel != null ? (
        <View style={styles.endpointRow}>
          <Text style={[styles.endpointLabel, styles.labelLeft]}>
            {minLabel ?? String(min)}
          </Text>
          {midLabel != null ? (
            <Text style={[styles.endpointLabel, styles.labelMid]}>
              {midLabel}
            </Text>
          ) : null}
          <Text style={[styles.endpointLabel, styles.labelRight]}>
            {maxLabel ?? String(max)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

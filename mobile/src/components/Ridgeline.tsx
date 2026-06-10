/**
 * Ridgeline — the redesign's one signature mark.
 *
 * Two layered Denali ridgelines (calm blue behind, glacier teal in front)
 * at low opacity, translated from the mockup's `.ridge` SVG
 * (docs/design/denali-redesign-mockups.html, frame 1):
 *
 *   viewBox 0 0 348 170, preserveAspectRatio="none"
 *   blue polyline  stroke-width 1.5, opacity .16
 *   teal polyline  stroke-width 1.6, opacity .18
 *
 * Rendered absolutely behind a screen's header — quiet, never competing
 * with data. pointerEvents="none" so it never intercepts taps.
 */

import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";

import { useTheme } from "@/theme/useTheme";

const BLUE_POINTS =
  "-10,120 50,96 96,112 150,72 210,104 268,66 320,108 358,84";
const TEAL_POINTS =
  "-10,150 44,124 92,140 150,96 214,132 276,92 330,134 358,112";

export interface RidgelineProps {
  /** Rendered height in dp. Mockup uses 170. */
  height?: number;
  /** Opacity overrides — frames 2/3 of the mockup use slightly fainter lines. */
  blueOpacity?: number;
  tealOpacity?: number;
}

export function Ridgeline({
  height = 170,
  blueOpacity = 0.16,
  tealOpacity = 0.18,
}: RidgelineProps): React.ReactElement {
  const { redesign } = useTheme();
  return (
    <View pointerEvents="none" style={[styles.container, { height }]}>
      <Svg
        width="100%"
        height="100%"
        viewBox="0 0 348 170"
        preserveAspectRatio="none"
      >
        <Polyline
          points={BLUE_POINTS}
          fill="none"
          stroke={redesign.blue}
          strokeWidth={1.5}
          opacity={blueOpacity}
        />
        <Polyline
          points={TEAL_POINTS}
          fill="none"
          stroke={redesign.teal}
          strokeWidth={1.6}
          opacity={tealOpacity}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
});

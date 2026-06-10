/**
 * MiniSparkline — Increment 2 dashboard card mini-trend.
 *
 * A quiet teal dot-trend of the last few session scores with a solid
 * end dot, per the mockup `.dash-spark` (viewBox 0 0 308 38). Pure
 * presentation over the pure helpers in ./sparkline; renders null when
 * the honesty gate (≥2 complete sessions) isn't met, so the card shows
 * the pill alone. No interpretation, no labels, no axes — the calm
 * dot-trend the design notes prescribe for sparse ordinal screeners.
 */

import React from "react";
import Svg, { Circle, Polyline } from "react-native-svg";

import type { TimelineCard } from "../grouping";
import { useTheme } from "@/theme/useTheme";

import { recentSessionScores, sparklinePolyline } from "./sparkline";

const VB_WIDTH = 308;
const VB_HEIGHT = 38;
const RENDER_HEIGHT = 34;

export interface MiniSparklineProps {
  /** Chronological scores from useSparklineScores (caller owns the hook). */
  scores: ReadonlyArray<number>;
  scoreRange: { min: number; max: number };
}

/**
 * Chronological scores the sparkline would plot (also what the meta
 * line counts), or [] under the honesty gate. The card calls this ONCE
 * at top level (unconditional hook) and decides whether to render the
 * sparkline + meta from the length.
 */
export function useSparklineScores(
  sessions: ReadonlyArray<TimelineCard>,
): number[] {
  return React.useMemo(() => recentSessionScores(sessions), [sessions]);
}

export function MiniSparkline({
  scores,
  scoreRange,
}: MiniSparklineProps): React.ReactElement | null {
  const { redesign } = useTheme();
  const geo = sparklinePolyline(scores, scoreRange, VB_WIDTH, VB_HEIGHT);
  if (geo == null) return null; // honesty gate: <2 points → nothing.

  return (
    <Svg
      testID="dashboard_card_sparkline"
      width="100%"
      height={RENDER_HEIGHT}
      viewBox={`0 0 ${VB_WIDTH} ${VB_HEIGHT}`}
      preserveAspectRatio="none"
    >
      <Polyline
        points={geo.points}
        fill="none"
        stroke={redesign.teal}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx={geo.endX} cy={geo.endY} r={3} fill={redesign.teal} />
    </Svg>
  );
}

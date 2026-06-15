/**
 * TrendChart — per-instrument score-over-time chart (Step-3 Part C).
 *
 * Plain react-native-svg, no chart dependency: shaded horizontal band
 * rects from the v1.3 table (wash tints at low opacity, clamped to the
 * instrument's scoreRange), plain-language band labels at the left
 * edge, light gridlines at band boundaries, score polyline,
 * white-filled dots, solid teal latest dot, month labels on the X axis
 * (mockup frame 3 treatment).
 *
 * Data: useInstrumentSessions(instrumentId, range) for the plotted
 * points; a second "all" query feeds the delta line (latest vs the
 * immediately previous check-in, independent of the selected range —
 * rule 13) and the band/score for the accessibility label.
 *
 * States: <2 sessions in the selected range → the versioned quiet-state
 * line (testID trend_empty_state), no chart and no placeholder axes.
 *
 * Clinical boundary: every string here comes from the versioned
 * trend-strings module or the interpretation table; band shading uses
 * the same tint classes as the pills (tintClassForBand) so chart and
 * pill can never disagree. The chart explains; it never recommends.
 */

import React from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, {
  Circle,
  Line,
  Polyline,
  Rect,
  Text as SvgText,
} from "react-native-svg";

import type { SexAtBirth } from "@/contracts";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import { getInstrumentName } from "../displayMapping";
import { dateKeyOf, formatGroupHeader } from "../groupObservations";
import { lookupInterpretation } from "../interpretation/lookup";
import { INTERPRETATION_TABLE_V1 } from "../interpretation/tableV1";
import {
  formatTrendAccessibilityLabel,
  formatTrendDelta,
  TREND_EMPTY_STATE,
} from "../interpretation/trendStrings";
import { tintClassForBand } from "../pill";
import {
  chartBandsFor,
  deltaPair,
  type ScoredSession,
  type TrendRange,
} from "./sessions";
import { useInstrumentSessions } from "./useInstrumentSessions";

const PLOT_HEIGHT = 140;
const X_LABELS_HEIGHT = 20;
const PAD_TOP = 6;
const PAD_LEFT = 10;
const PAD_RIGHT = 14;
const SVG_HEIGHT = PAD_TOP + PLOT_HEIGHT + X_LABELS_HEIGHT;
/** Minimum band height (px) before its left-edge label is drawn. */
const MIN_LABEL_BAND_PX = 13;

/** Short month label for an X tick; the latest tick adds the day. */
function monthLabel(iso: string, withDay: boolean): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    ...(withDay ? { day: "numeric" } : {}),
  });
}

/** Up to four evenly-spread tick indices, always including first/last. */
function tickIndices(n: number): number[] {
  if (n <= 4) return Array.from({ length: n }, (_, i) => i);
  const picks = [0, Math.round((n - 1) / 3), Math.round((2 * (n - 1)) / 3), n - 1];
  return [...new Set(picks)];
}

export interface TrendChartProps {
  instrumentId: string;
  range: TrendRange;
  userSexAtBirth: SexAtBirth | null;
}

export function TrendChart({
  instrumentId,
  range,
  userSexAtBirth,
}: TrendChartProps): React.ReactElement | null {
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const styles = React.useMemo(
    () => makeStyles(theme, redesign, fontsLoaded),
    [theme, redesign, fontsLoaded],
  );
  const [width, setWidth] = React.useState(0);
  const onLayout = React.useCallback((e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  }, []);

  const { sessions: ranged, loading: rangedLoading } = useInstrumentSessions(
    instrumentId,
    range,
  );
  // Full history — delta is independent of the selected range (rule 13).
  const { sessions: all, loading: allLoading } = useInstrumentSessions(
    instrumentId,
    "all",
  );

  const name = getInstrumentName(instrumentId);
  const scoreRange = INTERPRETATION_TABLE_V1.instruments[instrumentId]?.scoreRange;

  if (scoreRange == null) return null; // not chartable (ADAM et al.)
  if (rangedLoading || allLoading) return null;

  // Delta line: latest vs immediately previous check-in, full history.
  const pair = deltaPair(all);
  const deltaText = pair
    ? formatTrendDelta(
        pair.previous.score,
        pair.latest.score,
        formatGroupHeader(dateKeyOf(pair.previous.effective_at)),
      )
    : null;

  // n=1 (or range-empty) quiet state — no chart, no placeholder axes.
  if (ranged.length < 2) {
    return (
      <View style={styles.card}>
        <Text style={styles.instrumentName}>{name}</Text>
        <Text testID="trend_empty_state" style={styles.emptyState}>
          {TREND_EMPTY_STATE}
        </Text>
      </View>
    );
  }

  const latest = ranged[ranged.length - 1];
  const latestBand = lookupInterpretation({
    key: instrumentId,
    score: latest.score,
    sexAtBirth: userSexAtBirth,
    ageYears: null,
    kind: "instrument",
  })?.band;
  const accessibilityLabel = formatTrendAccessibilityLabel(
    name,
    latest.score,
    latestBand?.pill ?? String(latest.score),
    deltaText,
  );

  return (
    <View
      testID={`trend_chart_${instrumentId}`}
      accessible
      accessibilityLabel={accessibilityLabel}
      style={styles.card}
      onLayout={onLayout}
    >
      <Text style={styles.instrumentName}>{name}</Text>
      {width > 0 ? (
        <ChartSvg
          width={width - theme.spacing.md * 2}
          sessions={ranged}
          instrumentId={instrumentId}
          userSexAtBirth={userSexAtBirth}
          scoreRange={scoreRange}
          redesign={redesign}
          fontsLoaded={fontsLoaded}
        />
      ) : null}
      {deltaText != null ? (
        <Text testID="trend_delta" style={styles.delta}>
          {deltaText}
        </Text>
      ) : null}
    </View>
  );
}

interface ChartSvgProps {
  width: number;
  sessions: ScoredSession[];
  instrumentId: string;
  userSexAtBirth: SexAtBirth | null;
  scoreRange: { min: number; max: number };
  redesign: ReturnType<typeof useTheme>["redesign"];
  fontsLoaded: boolean;
}

function ChartSvg({
  width,
  sessions,
  instrumentId,
  userSexAtBirth,
  scoreRange,
  redesign,
  fontsLoaded,
}: ChartSvgProps): React.ReactElement {
  // Half-step domain so integer-inclusive bands tile without gaps.
  const lo = scoreRange.min - 0.5;
  const hi = scoreRange.max + 0.5;
  const plotW = Math.max(width - PAD_LEFT - PAD_RIGHT, 1);
  const yOf = (v: number) =>
    PAD_TOP + (1 - (v - lo) / (hi - lo)) * PLOT_HEIGHT;
  const n = sessions.length;
  const xOf = (i: number) =>
    PAD_LEFT + (n === 1 ? plotW / 2 : (i * plotW) / (n - 1));

  // Chart band fill per tint class — the brighter band tokens (NOT the pale
  // pill washes) so large band areas read as clearly distinct at a glance.
  // Same green / neutral / amber / red severity semantics as the pills.
  const washFor = (cls: ReturnType<typeof tintClassForBand>): string =>
    cls === "ok"
      ? redesign.bandOk
      : cls === "soft"
        ? redesign.bandSoft
        : cls === "watch"
          ? redesign.bandWatch
          : redesign.bandAlarm;

  const bands = chartBandsFor(instrumentId, userSexAtBirth).map((band) => {
    const topVal = Math.min(band.maxScore, scoreRange.max) + 0.5;
    const bottomVal = Math.max(band.minScore, scoreRange.min) - 0.5;
    const y = yOf(topVal);
    const h = yOf(bottomVal) - y;
    return {
      key: band.bandId,
      label: band.pill,
      y,
      h,
      fill: washFor(tintClassForBand(band)),
      boundary: band.minScore > scoreRange.min ? yOf(band.minScore - 0.5) : null,
    };
  });

  const points = sessions
    .map((s, i) => `${xOf(i)},${yOf(s.score)}`)
    .join(" ");
  const ticks = tickIndices(n);
  const labelFont = fontStyle("body", 400, fontsLoaded).fontFamily;

  return (
    <Svg width={width} height={SVG_HEIGHT}>
      {/* Severity band backgrounds, clamped to scoreRange. */}
      {bands.map((b) => (
        <Rect
          key={`band-${b.key}`}
          x={0}
          y={b.y}
          width={width}
          height={b.h}
          fill={b.fill}
        />
      ))}
      {/* Separator hairline at each band boundary (stronger than line2 so the
          bands read as cleanly divided). */}
      {bands.map((b) =>
        b.boundary != null ? (
          <Line
            key={`grid-${b.key}`}
            x1={0}
            y1={b.boundary}
            x2={width}
            y2={b.boundary}
            stroke={redesign.line}
            strokeWidth={1}
          />
        ) : null,
      )}
      {/* Plain-language band labels at the left edge (tall bands only). */}
      {bands.map((b) =>
        b.h >= MIN_LABEL_BAND_PX ? (
          <SvgText
            key={`label-${b.key}`}
            x={6}
            y={b.y + Math.min(b.h / 2 + 3.5, 12)}
            fontSize={9}
            fill={redesign.ink}
            {...(labelFont ? { fontFamily: labelFont } : {})}
          >
            {b.label}
          </SvgText>
        ) : null,
      )}
      {/* Score line + dots; latest dot solid teal (mockup treatment). */}
      <Polyline
        points={points}
        fill="none"
        stroke={redesign.teal}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {sessions.map((s, i) =>
        i < n - 1 ? (
          <Circle
            key={`dot-${s.effective_at}`}
            cx={xOf(i)}
            cy={yOf(s.score)}
            r={3.5}
            fill={redesign.surface}
            stroke={redesign.teal}
            strokeWidth={2}
          />
        ) : (
          <Circle
            key={`dot-${s.effective_at}`}
            cx={xOf(i)}
            cy={yOf(s.score)}
            r={4.5}
            fill={redesign.teal}
          />
        ),
      )}
      {/* Month labels on X — latest tick carries the day. */}
      {ticks.map((i) => (
        <SvgText
          key={`tick-${i}`}
          x={xOf(i)}
          y={PAD_TOP + PLOT_HEIGHT + 14}
          fontSize={10}
          fill={redesign.ink3}
          textAnchor={i === n - 1 ? "end" : "middle"}
          {...(labelFont ? { fontFamily: labelFont } : {})}
        >
          {monthLabel(sessions[i].effective_at, i === n - 1)}
        </SvgText>
      ))}
    </Svg>
  );
}

function makeStyles(
  theme: ReturnType<typeof useTheme>["theme"],
  redesign: ReturnType<typeof useTheme>["redesign"],
  fontsLoaded: boolean,
) {
  return StyleSheet.create({
    // Same surface-card construction as the other detail cards.
    card: {
      backgroundColor: redesign.surface,
      borderColor: redesign.line,
      borderWidth: 1,
      borderRadius: redesign.rCard,
      padding: theme.spacing.md,
      marginHorizontal: theme.spacing.space5,
      marginBottom: theme.spacing.space3,
      gap: theme.spacing.sm,
      shadowColor: redesign.ink,
      shadowOpacity: 0.05,
      shadowRadius: 7,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    instrumentName: {
      color: redesign.ink,
      fontSize: theme.typography.sizes.base,
      letterSpacing: -0.16,
      ...fontStyle("display", 600, fontsLoaded),
    },
    emptyState: {
      color: redesign.ink2,
      fontSize: theme.typography.sizes.sm,
      lineHeight: theme.typography.sizes.sm * 1.5,
      ...fontStyle("body", 400, fontsLoaded),
    },
    delta: {
      color: redesign.ink2,
      fontSize: theme.typography.sizes.sm,
      fontVariant: ["tabular-nums"],
      ...fontStyle("body", 500, fontsLoaded),
    },
  });
}

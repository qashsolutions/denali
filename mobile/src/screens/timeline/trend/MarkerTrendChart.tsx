/**
 * MarkerTrendChart — value-over-time chart for ONE health marker (a LOINC
 * code), used on the per-marker detail screen (D28).
 *
 * Generic sibling of BmiTrendChart: plots a marker's raw stored readings
 * rather than a derived/score value, reusing the shared TrendChartSvg.
 *
 * Bands:
 *   - If the interpretation table ships a UNIFORM band set for this code
 *     (e.g. bone-density T-score 38264-8), the chart shades those bands
 *     (provisional, ‡ via the screen's standing disclaimer).
 *   - Otherwise the chart is BAND-LESS: a plain factual line with value
 *     gridlines (yRefs) at the data min/max to anchor it — NO severity
 *     claim, which is the clinically honest default for a raw value
 *     (weight, waist) that has no validated cutoffs.
 *
 * Clinical boundary (mobile/CLAUDE.md § Display + clinical boundary):
 *   - Bands come from the versioned table; never synthesized here.
 *   - The delta string comes from the versioned trendStrings module only.
 *   - Factual/navigational copy; no advice, no population comparison.
 *   - scoreRange/yRefs are display chrome (data-aware axis), never clinical
 *     cutoffs and never added to the interpretation table.
 *
 * testID: `marker_trend_chart_<code>`.
 */

import React from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

import type { ObservationRow } from "@/contracts";
import { formatMarkerValue } from "@/screens/markers/markerCatalog";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import { dateKeyOf, formatGroupHeader } from "../groupObservations";
import {
  INTERPRETATION_TABLE_V1,
  type InterpretationBand,
} from "../interpretation/tableV1";
import {
  formatMarkerTrendDelta,
  TREND_EMPTY_STATE,
} from "../interpretation/trendStrings";
import { deriveMarkerChartModel } from "./markerChartModel";
import { type TrendRange } from "./sessions";
import { TrendChartSvg } from "./TrendChart";

/** Bands the chart shades for a marker code; [] → band-less (no cutoffs). */
function resolveMarkerBands(code: string): ReadonlyArray<InterpretationBand> {
  const entry = INTERPRETATION_TABLE_V1.biomarkers[code];
  if (entry == null) return [];
  if (entry.strategy.kind !== "uniform") return [];
  return entry.strategy.bands;
}

export interface MarkerTrendChartProps {
  /** ALL readings for this user; the chart filters to `code` itself. */
  rows: ReadonlyArray<ObservationRow>;
  code: string;
  /** Plain-language marker name, e.g. "Weight". */
  markerName: string;
  /** Canonical unit string for labels, e.g. "kg"; null → no unit suffix. */
  unit: string | null;
  range: TrendRange;
}

export function MarkerTrendChart({
  rows,
  code,
  markerName,
  unit,
  range,
}: MarkerTrendChartProps): React.ReactElement | null {
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

  const bands = React.useMemo(() => resolveMarkerBands(code), [code]);
  const label = React.useCallback(
    (v: number) => `${formatMarkerValue(code, v)}${unit ? ` ${unit}` : ""}`,
    [code, unit],
  );

  // Pure data model — points, data-aware axis, band-less value refs. Components
  // may use `new Date()`; the pure helper takes `now` explicitly (stale-closure
  // rule). Re-derive each render (cheap; rows/range are the only inputs).
  const { allPoints, chartPoints, scoreRange, yRefValues } = React.useMemo(
    () => deriveMarkerChartModel(rows, code, bands, range, new Date()),
    [rows, code, bands, range],
  );

  // Band-less charts get value gridlines at the data min/max to anchor the line
  // (banded charts → null → no yRefs, byte-identical render).
  const yRefs = React.useMemo(
    () =>
      yRefValues == null
        ? undefined
        : yRefValues.map((value) => ({ value, label: label(value) })),
    [yRefValues, label],
  );

  // Delta: latest vs immediately previous reading in FULL history (range-
  // independent, same rule as instruments/BMI).
  const deltaText = React.useMemo(() => {
    if (allPoints.length < 2) return null;
    const prev = allPoints[allPoints.length - 2];
    const latest = allPoints[allPoints.length - 1];
    return formatMarkerTrendDelta(
      markerName,
      label(prev.score),
      label(latest.score),
      formatGroupHeader(dateKeyOf(prev.effective_at)),
    );
  }, [allPoints, markerName, label]);

  // n<2 in range → quiet state (no chart, no placeholder axes).
  if (chartPoints.length < 2) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{markerName}</Text>
        <Text testID="trend_empty_state" style={styles.emptyState}>
          {TREND_EMPTY_STATE}
        </Text>
      </View>
    );
  }

  const latest = chartPoints[chartPoints.length - 1];

  return (
    <View
      testID={`marker_trend_chart_${code}`}
      accessible
      accessibilityLabel={`${markerName} trend chart. Latest ${label(latest.score)}.${deltaText ? ` ${deltaText}` : ""}`}
      style={styles.card}
      onLayout={onLayout}
    >
      <Text style={styles.title}>{markerName}</Text>
      {width > 0 ? (
        <TrendChartSvg
          width={width - theme.spacing.md * 2}
          points={chartPoints}
          bands={bands}
          scoreRange={scoreRange}
          yRefs={yRefs}
          redesign={redesign}
          fontsLoaded={fontsLoaded}
        />
      ) : null}
      {deltaText != null ? (
        <Text testID={`marker_trend_delta_${code}`} style={styles.delta}>
          {deltaText}
        </Text>
      ) : null}
    </View>
  );
}

function makeStyles(
  theme: ReturnType<typeof useTheme>["theme"],
  redesign: ReturnType<typeof useTheme>["redesign"],
  fontsLoaded: boolean,
) {
  return StyleSheet.create({
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
    title: {
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

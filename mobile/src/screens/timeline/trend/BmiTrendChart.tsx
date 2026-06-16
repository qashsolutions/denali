/**
 * BmiTrendChart — BMI-over-time chart for the Health Markers detail screen.
 *
 * Renders the same band-shaded line chart as the instrument TrendChart,
 * but for the DERIVED BMI value rather than a questionnaire score.
 *
 * Data path:
 *   deriveBmiTrend(rows)          — all-history BMI points
 *   → filter to range window      — via rangeStartIso (same UTC math as instruments)
 *   → TrendChartSvg               — shared renderer (no instrument coupling)
 *
 * Band resolution: INTERPRETATION_TABLE_V1.biomarkers["39156-5"] (WHO BMI
 * categories, uniform strategy, no age/sex branching — adult BMI has no
 * validated age/sex-specific standard; D23 rule).
 *
 * scoreRange { min: 15, max: 40 } — display axis chrome only (not a clinical
 * cutoff). Defined here, not in the interpretation table.
 *
 * Clinical boundary (mobile/CLAUDE.md § Display + clinical boundary):
 *   - Bands sourced from tableV1 (WHO-cited, provisional:true, ‡ deferred to
 *     the standing disclaimer on the detail screen).
 *   - Delta strings from the versioned trendStrings module only.
 *   - Factual/navigational copy; no advice, no population comparison.
 *
 * testID: "trend_chart_bmi".
 */

import React from "react";
import { StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";

import type { ObservationRow } from "@/contracts";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import { dateKeyOf, formatGroupHeader } from "../groupObservations";
import { INTERPRETATION_TABLE_V1 } from "../interpretation/tableV1";
import {
  formatBmiTrendDelta,
  TREND_EMPTY_STATE,
} from "../interpretation/trendStrings";
import { deriveBmiTrend } from "../../markers/bmi";
import { rangeStartIso, type TrendRange } from "./sessions";
import { TrendChartSvg } from "./TrendChart";

/**
 * Display-only Y-axis bounds for the BMI chart — chart chrome, not a clinical
 * cutoff. Chosen to fit the full WHO band range with comfortable headroom.
 * Must NOT be added to the clinical interpretation table.
 */
const BMI_SCORE_RANGE = { min: 15, max: 40 } as const;

/**
 * WHO BMI bands resolved once at module load — the table is a static constant.
 * Null when the entry is absent or the strategy is not uniform (neither should
 * happen in practice; guards keep the renderer safe against future table edits).
 */
function resolveBmiBands() {
  const entry = INTERPRETATION_TABLE_V1.biomarkers["39156-5"];
  if (entry == null) return null;
  if (entry.strategy.kind !== "uniform") return null;
  return entry.strategy.bands;
}
const BMI_BANDS = resolveBmiBands();

export interface BmiTrendChartProps {
  /** All health-marker ObservationRows for this user (unfiltered by range). */
  rows: ReadonlyArray<ObservationRow>;
  range: TrendRange;
}

export function BmiTrendChart({
  rows,
  range,
}: BmiTrendChartProps): React.ReactElement | null {
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

  // Derive all-history BMI trend points from the raw observations.
  const allPoints = React.useMemo(() => deriveBmiTrend(rows), [rows]);

  // Filter to the selected range window using the same UTC month math as
  // the instrument sessions path (rangeStartIso). Components may use
  // `new Date()` — the pure helper receives `now` explicitly per the
  // stale-closure rule (mobile/CLAUDE.md § Engineering rules).
  const rangedPoints = React.useMemo(() => {
    const now = new Date();
    const since = rangeStartIso(range, now);
    if (since == null) return allPoints;
    return allPoints.filter((p) => p.effectiveAt >= since);
  }, [allPoints, range]);

  // Map to the shape TrendChartSvg expects.
  const chartPoints = React.useMemo(
    () => rangedPoints.map((p) => ({ score: p.bmi, effective_at: p.effectiveAt })),
    [rangedPoints],
  );

  // Y-axis must encompass BOTH the WHO band range (so every category shows)
  // AND the actual plotted data — otherwise an out-of-band BMI (severe
  // obesity > 40, or a very low value) would render OUTSIDE the plot. Expand
  // the fixed [15, 40] band range to fit the data with a 1-unit margin.
  const scoreRange = React.useMemo(() => {
    if (chartPoints.length === 0) return BMI_SCORE_RANGE;
    const vals = chartPoints.map((p) => p.score);
    return {
      min: Math.min(BMI_SCORE_RANGE.min, Math.floor(Math.min(...vals)) - 1),
      max: Math.max(BMI_SCORE_RANGE.max, Math.ceil(Math.max(...vals)) + 1),
    };
  }, [chartPoints]);

  // Delta: latest vs immediately previous point in full history (same
  // independence rule as instruments — rule 13; delta is never range-scoped).
  const deltaText = React.useMemo(() => {
    if (allPoints.length < 2) return null;
    const previous = allPoints[allPoints.length - 2];
    const latest = allPoints[allPoints.length - 1];
    return formatBmiTrendDelta(
      previous.bmi,
      latest.bmi,
      formatGroupHeader(dateKeyOf(previous.effectiveAt)),
    );
  }, [allPoints]);

  // n<2 in range, or BMI_BANDS unavailable (table guard) → quiet state.
  // BMI_BANDS is a module-level constant resolved at load time; the null
  // branch is a safety net against future table edits, not a runtime path.
  if (chartPoints.length < 2 || BMI_BANDS == null) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>BMI</Text>
        <Text testID="trend_empty_state" style={styles.emptyState}>
          {TREND_EMPTY_STATE}
        </Text>
      </View>
    );
  }

  // At this point BMI_BANDS is guaranteed non-null (guarded above).
  const bands = BMI_BANDS;
  const latestScore = chartPoints[chartPoints.length - 1].score;

  return (
    <View
      testID="trend_chart_bmi"
      accessible
      accessibilityLabel={`BMI trend chart. Latest BMI ${latestScore.toFixed(1)}.${deltaText ? ` ${deltaText}` : ""}`}
      style={styles.card}
      onLayout={onLayout}
    >
      <Text style={styles.title}>BMI</Text>
      {width > 0 ? (
        <TrendChartSvg
          width={width - theme.spacing.md * 2}
          points={chartPoints}
          bands={bands}
          scoreRange={scoreRange}
          redesign={redesign}
          fontsLoaded={fontsLoaded}
        />
      ) : null}
      {deltaText != null ? (
        <Text testID="trend_delta_bmi" style={styles.delta}>
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
    // Same surface-card construction as TrendChart.
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

/**
 * TrendRangeControl — segmented 3M / 6M / Y / All toggle (Step-3 rule 11),
 * styled per the mockup's .range control: neutral wash track, white
 * selected segment with a soft shadow. One control per DomainDetail
 * screen; all charts on the screen share the selection.
 *
 * testIDs: trend_range_3m | trend_range_6m | trend_range_y | trend_range_all.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import { TREND_RANGES, type TrendRange } from "./sessions";

const RANGE_LABEL: Readonly<Record<TrendRange, string>> = {
  "3m": "3M",
  "6m": "6M",
  y: "Y",
  all: "All",
};

export interface TrendRangeControlProps {
  value: TrendRange;
  onChange: (next: TrendRange) => void;
}

export function TrendRangeControl({
  value,
  onChange,
}: TrendRangeControlProps): React.ReactElement {
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const styles = React.useMemo(
    () => makeStyles(theme, redesign, fontsLoaded),
    [theme, redesign, fontsLoaded],
  );

  return (
    <View style={styles.track} accessibilityRole="tablist">
      {TREND_RANGES.map((range) => {
        const selected = range === value;
        return (
          <Pressable
            key={range}
            testID={`trend_range_${range}`}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={`Show ${RANGE_LABEL[range]} range`}
            onPress={() => onChange(range)}
            style={[styles.segment, selected ? styles.segmentOn : null]}
          >
            <Text style={[styles.label, selected ? styles.labelOn : null]}>
              {RANGE_LABEL[range]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(
  theme: ReturnType<typeof useTheme>["theme"],
  redesign: ReturnType<typeof useTheme>["redesign"],
  fontsLoaded: boolean,
) {
  return StyleSheet.create({
    // Mockup .range: wash track, r=12, 4px padding.
    track: {
      flexDirection: "row",
      gap: theme.spacing.xs + 2,
      backgroundColor: redesign.pillSoft,
      borderRadius: theme.radii.lg,
      padding: theme.spacing.xs,
    },
    segment: {
      flex: 1,
      alignItems: "center",
      paddingVertical: theme.spacing.sm - 1,
      borderRadius: theme.radii.md + 1,
    },
    segmentOn: {
      backgroundColor: redesign.surface,
      shadowColor: redesign.ink,
      shadowOpacity: 0.1,
      shadowRadius: 3,
      shadowOffset: { width: 0, height: 1 },
      elevation: 1,
    },
    label: {
      color: redesign.ink2,
      fontSize: 13,
      ...fontStyle("body", 600, fontsLoaded),
    },
    labelOn: {
      color: redesign.ink,
    },
  });
}

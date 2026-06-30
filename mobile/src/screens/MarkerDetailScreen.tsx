/**
 * MarkerDetailScreen — per-marker history drill-down (D28).
 *
 * Reached by tapping a "Latest readings" card on the Health-markers
 * DomainDetailScreen. Shows ONE marker's full history:
 *
 *   1. Header — back chip + category icon + plain marker name.
 *   2. Trend chart (MarkerTrendChart) — all readings over time, band-shaded
 *      if the marker has validated bands, else a band-less factual line.
 *   3. "All readings" — every stored reading (date + value + source),
 *      newest first. This is the surface that resolves the D27 tradeoff:
 *      the full reading history (hidden from the consolidated latest-only
 *      cards) lives here.
 *   4. Standing disclaimer + ‡ legend, pinned once at the bottom.
 *
 * Read-only: loads observations via the DAL (same pattern as
 * DomainDetailScreen), filters to this user + this LOINC code. No writes.
 * Storage/export are untouched — this only reads and displays.
 */

import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronLeft, type LucideIcon } from "lucide-react-native";
import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApiClient } from "@/auth";
import { FadeInView } from "@/components/FadeInView";
import { Ridgeline } from "@/components/Ridgeline";
import { Skeleton } from "@/components/Skeleton";
import type { ObservationRow } from "@/contracts";
import { useDal } from "@/db/DalProvider";
import { formatMarkerValue } from "@/screens/markers/markerCatalog";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import { dateKeyOf, formatGroupHeader } from "./timeline/groupObservations";
import {
  getCategoryIcon,
  getSourceName,
  resolveSingleRowDisplay,
  STANDING_DISCLAIMER,
} from "./timeline/displayMapping";
import { MarkerTrendChart } from "./timeline/trend/MarkerTrendChart";
import { TrendRangeControl } from "./timeline/trend/TrendRangeControl";
import type { TrendRange } from "./timeline/trend/sessions";

import type { RootStackParamList } from "@/navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList, "MarkerDetail">;
type Route = RouteProp<RootStackParamList, "MarkerDetail">;

const PAGE_SIZE = 2000;

/** One reading row in the "All readings" list. */
function ReadingRow({
  row,
  styles,
}: {
  row: ObservationRow;
  styles: ReturnType<typeof makeStyles>;
}): React.ReactElement {
  const value =
    row.value_num != null
      ? row.unit
        ? `${formatMarkerValue(row.code, row.value_num)} ${row.unit}`
        : formatMarkerValue(row.code, row.value_num)
      : (row.value_text ?? "—");
  return (
    <View style={styles.readingRow}>
      <View style={styles.readingLeft}>
        <Text style={styles.readingDate}>
          {formatGroupHeader(dateKeyOf(row.effective_at))}
        </Text>
        <Text style={styles.readingSource}>Source: {getSourceName(row.source)}</Text>
      </View>
      <Text style={styles.readingValue}>{value}</Text>
    </View>
  );
}

export function MarkerDetailScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { code } = route.params;
  const dal = useDal();
  const api = useApiClient();
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const insets = useSafeAreaInsets();

  const [rows, setRows] = React.useState<ObservationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [trendRange, setTrendRange] = React.useState<TrendRange>("6m");

  useFocusEffect(
    React.useCallback(() => {
      if (!dal) return;
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          const user = api.getCurrentUser();
          const list = await dal.listObservations({
            latest_only: true,
            limit: PAGE_SIZE,
          });
          if (cancelled) return;
          const mine = list.filter(
            (o) =>
              o.code === code && (user == null || o.user_id === user.userId),
          );
          setRows(mine);
        } catch (err) {
          console.warn("[MarkerDetail] load failed", err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [api, dal, code]),
  );

  // Newest-first for the readings list.
  const readings = React.useMemo(
    () =>
      [...rows].sort((a, b) => (a.effective_at < b.effective_at ? 1 : -1)),
    [rows],
  );
  const latest = readings[0] ?? null;
  const display =
    latest != null
      ? resolveSingleRowDisplay({
          category: latest.category,
          code_system: latest.code_system,
          code: latest.code,
          display: latest.display,
        })
      : null;
  const markerName = display?.name ?? "Marker";
  const unit = latest?.unit ?? null;
  const Icon: LucideIcon = getCategoryIcon(latest?.category ?? "biomarker");

  const styles = React.useMemo(
    () => makeStyles(theme, redesign, fontsLoaded, insets.top, insets.bottom),
    [theme, redesign, fontsLoaded, insets.top, insets.bottom],
  );

  const onRangeChange = React.useCallback((next: TrendRange) => {
    setTrendRange(next);
  }, []);

  const ListHeader = (
    <View>
      <View style={styles.trendControlWrap}>
        <TrendRangeControl value={trendRange} onChange={onRangeChange} />
      </View>
      <MarkerTrendChart
        rows={rows}
        code={code}
        markerName={markerName}
        unit={unit}
        range={trendRange}
      />
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>All readings</Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.screen}>
        <Ridgeline blueOpacity={0.13} tealOpacity={0.15} />
        <View style={styles.header}>
          <Skeleton width={44} height={44} radius={redesign.rChip} />
          <Skeleton width={30} height={30} radius={redesign.rChip - 1} />
          <Skeleton width={140} height={24} radius={8} />
        </View>
        <View
          style={{
            paddingHorizontal: theme.spacing.space5,
            gap: theme.spacing.space3,
            marginTop: theme.spacing.md,
          }}
        >
          <Skeleton height={180} radius={redesign.rCard} />
          <Skeleton height={64} radius={redesign.rCard} />
          <Skeleton height={64} radius={redesign.rCard} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Ridgeline blueOpacity={0.13} tealOpacity={0.15} />
      <View style={styles.header}>
        <Pressable
          testID="marker_detail_back"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
          hitSlop={12}
        >
          <ChevronLeft color={redesign.tealDeep} size={22} />
        </Pressable>
        <View style={styles.iconDot}>
          <Icon color={redesign.teal} size={17} />
        </View>
        <Text style={styles.headerTitle}>{markerName}</Text>
      </View>
      <FadeInView style={{ flex: 1 }}>
        <FlatList
          style={{ flex: 1 }}
          data={readings}
          keyExtractor={(item) => item.id}
          ListHeaderComponent={ListHeader}
          renderItem={({ item }) => <ReadingRow row={item} styles={styles} />}
        />
      </FadeInView>
      <View style={styles.disclaimerStrip}>
        <Text style={styles.disclaimerText}>{STANDING_DISCLAIMER}</Text>
        <Text
          testID="marker_detail_provisional_footnote"
          style={styles.disclaimerText}
        >
          ‡ Interpretation pending clinical review.
        </Text>
      </View>
    </View>
  );
}

function makeStyles(
  theme: ReturnType<typeof useTheme>["theme"],
  redesign: ReturnType<typeof useTheme>["redesign"],
  fontsLoaded: boolean,
  insetTop: number,
  insetBottom: number,
) {
  return StyleSheet.create({
    screen: { flex: 1, backgroundColor: redesign.paper },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.space3 - 2,
      paddingHorizontal: theme.spacing.space5,
      paddingTop: insetTop + theme.spacing.md,
      paddingBottom: theme.spacing.md,
    },
    backButton: {
      minWidth: 44,
      minHeight: 44,
      borderRadius: redesign.rChip,
      backgroundColor: redesign.tealWash,
      alignItems: "center",
      justifyContent: "center",
    },
    iconDot: {
      width: theme.spacing.xl - 2,
      height: theme.spacing.xl - 2,
      borderRadius: redesign.rChip - 1,
      backgroundColor: redesign.tealWash,
      alignItems: "center",
      justifyContent: "center",
    },
    headerTitle: {
      color: redesign.ink,
      fontSize: theme.typography.sizes["2xl"] - 2,
      letterSpacing: -0.44,
      flexShrink: 1,
      ...fontStyle("display", 700, fontsLoaded),
    },
    trendControlWrap: {
      marginHorizontal: theme.spacing.space5,
      paddingTop: theme.spacing.xs,
      marginBottom: theme.spacing.space3,
    },
    sectionHeader: {
      paddingHorizontal: theme.spacing.space5,
      paddingTop: theme.spacing.space3,
      paddingBottom: theme.spacing.sm,
    },
    sectionHeaderText: {
      color: redesign.ink3,
      fontSize: 11,
      letterSpacing: 11 * 0.12,
      textTransform: "uppercase",
      ...fontStyle("body", 600, fontsLoaded),
    },
    // One reading: date + source on the left, value on the right.
    readingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: redesign.surface,
      borderColor: redesign.line,
      borderWidth: 1,
      borderRadius: redesign.rCard,
      paddingVertical: theme.spacing.sm + 2,
      paddingHorizontal: theme.spacing.md,
      marginHorizontal: theme.spacing.space5,
      marginBottom: theme.spacing.space3,
    },
    readingLeft: { flexShrink: 1, gap: 2 },
    readingDate: {
      color: redesign.ink,
      fontSize: theme.typography.sizes.base,
      ...fontStyle("body", 500, fontsLoaded),
    },
    readingSource: {
      color: redesign.ink3,
      fontSize: theme.typography.sizes.xs,
      ...fontStyle("body", 400, fontsLoaded),
    },
    readingValue: {
      color: redesign.ink,
      fontSize: theme.typography.sizes.lg,
      fontVariant: ["tabular-nums"],
      ...fontStyle("numbers", 600, fontsLoaded),
    },
    disclaimerStrip: {
      paddingHorizontal: theme.spacing.space5,
      paddingTop: theme.spacing.space3,
      paddingBottom: insetBottom + theme.spacing.space3,
      backgroundColor: redesign.paper,
      gap: theme.spacing.xs,
    },
    disclaimerText: {
      color: redesign.ink3,
      fontSize: theme.typography.sizes.xs,
      lineHeight: theme.typography.sizes.xs * 1.45,
      textAlign: "center",
      ...fontStyle("body", 400, fontsLoaded),
    },
  });
}

/**
 * TimelineScreen — Phase 1 mobile (Wave 3 / mobile-app-shell Pass 2).
 *
 * Chronological list of `observations` rows from the on-device DAL,
 * grouped by `effective_at` calendar day, newest-first. Read-only: this
 * screen never writes. The supersede chain is hidden behind the DAL's
 * default `latest_only: true` filter; expanding the history walk is
 * deferred to a later phase per spec scope.
 *
 * Phase 1 decision: list-only timeline, no charts. Charting libs
 * compatible with SDK 56 + RN 0.85 + New Architecture are not yet
 * broadly validated (see mobile/src/theme/tokens.ts header for the same
 * rationale on NativeWind). When a charting library is adopted, it
 * lives on top of this list rather than replacing it.
 *
 * Contracts consumed: LocalDataDAL, Theme.
 */

import React from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";

import { useApiClient } from "@/auth";
import type { ObservationRow } from "@/contracts";
import { useDal } from "@/db/DalProvider";
import { useTheme } from "@/theme/useTheme";

import {
  formatGroupHeader,
  groupObservationsByDate,
  type TimelineGroup,
} from "./timeline/groupObservations";

const PAGE_SIZE = 200;

type ListItem =
  | { kind: "header"; dateKey: string }
  | { kind: "row"; row: ObservationRow };

export function TimelineScreen(): React.ReactElement {
  const dal = useDal();
  const api = useApiClient();
  const { active, theme } = useTheme();

  const [rows, setRows] = React.useState<ObservationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Single load on mount + whenever the dal becomes available. The DAL
  // is local — no debounce needed. A pull-to-refresh affordance is a
  // Phase 2 nicety.
  React.useEffect(() => {
    if (!dal) return; // wait until the SQLCipher open settles
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const user = api.getCurrentUser();
        const list = await dal.listObservations({
          latest_only: true,
          limit: PAGE_SIZE,
        });
        if (cancelled) return;
        // Defensive: even though the DAL is user-scoped by design, if a
        // future change ever returns mixed-user rows, scope here.
        const scoped = user
          ? list.filter((o) => o.user_id === user.userId)
          : list;
        setRows(scoped);
      } catch (err) {
        if (cancelled) return;
        setError("Couldn't load your history. Pull to refresh.");
        console.warn("[Timeline] listObservations failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, dal]);

  const groups: TimelineGroup[] = React.useMemo(
    () => groupObservationsByDate(rows),
    [rows],
  );

  // Flatten {header, row, row, header, row} for FlatList. FlatList is
  // perf-friendly on long lists; the 45+ audience may accumulate hundreds
  // of rows over time.
  const items: ListItem[] = React.useMemo(() => {
    const out: ListItem[] = [];
    for (const group of groups) {
      out.push({ kind: "header", dateKey: group.dateKey });
      for (const row of group.rows) {
        out.push({ kind: "row", row });
      }
    }
    return out;
  }, [groups]);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: active.bgPrimary },
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: theme.spacing.lg,
        },
        title: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.serif,
          fontSize: theme.typography.sizes["2xl"],
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
        },
        sectionHeader: {
          backgroundColor: active.bgSecondary,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm,
        },
        sectionHeaderText: {
          color: active.textSecondary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.sm,
          fontWeight: "600",
        },
        row: {
          backgroundColor: active.bgPrimary,
          borderBottomColor: active.border,
          borderBottomWidth: StyleSheet.hairlineWidth,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.md,
          gap: theme.spacing.xs,
        },
        rowHeader: {
          flexDirection: "row",
          justifyContent: "space-between",
          gap: theme.spacing.sm,
        },
        display: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
          fontWeight: "600",
          flexShrink: 1,
        },
        category: {
          color: active.textMuted,
          fontFamily: theme.typography.fonts.mono,
          fontSize: theme.typography.sizes.xs,
          textTransform: "uppercase",
        },
        valueLine: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
        },
        metaLine: {
          color: active.textSecondary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.sm,
        },
        emptyTitle: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.serif,
          fontSize: theme.typography.sizes.xl,
          textAlign: "center",
          marginBottom: theme.spacing.sm,
        },
        emptyBody: {
          color: active.textSecondary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
          textAlign: "center",
        },
        errorBox: {
          backgroundColor: active.bgSecondary,
          borderColor: active.error,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          margin: theme.spacing.lg,
          padding: theme.spacing.md,
        },
        errorText: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.sm,
        },
      }),
    [active, theme],
  );

  if (!dal || loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={active.accentPrimary} />
      </View>
    );
  }

  if (error != null) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Your timeline</Text>
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  if (rows.length === 0) {
    return (
      <View style={styles.screen}>
        <Text style={styles.title}>Your timeline</Text>
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>Nothing here yet</Text>
          <Text style={styles.emptyBody}>
            Upload a lab result, EHR export, or visit summary to start
            building your history.
          </Text>
        </View>
      </View>
    );
  }

  const renderItem: ListRenderItem<ListItem> = ({ item }) => {
    if (item.kind === "header") {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>
            {formatGroupHeader(item.dateKey)}
          </Text>
        </View>
      );
    }
    return <ObservationRowView row={item.row} styles={styles} />;
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Your timeline</Text>
      <FlatList
        data={items}
        keyExtractor={keyForItem}
        renderItem={renderItem}
      />
    </View>
  );
}

function keyForItem(item: ListItem): string {
  return item.kind === "header" ? `h:${item.dateKey}` : `r:${item.row.id}`;
}

interface ObservationRowViewProps {
  row: ObservationRow;
  styles: ReturnType<typeof StyleSheet.create>;
}

function ObservationRowView({
  row,
  styles,
}: ObservationRowViewProps): React.ReactElement {
  const valueDisplay = formatValue(row);
  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <Text style={styles.display} numberOfLines={2}>
          {row.display || row.code}
        </Text>
        <Text style={styles.category}>{row.category}</Text>
      </View>
      {valueDisplay != null && (
        <Text style={styles.valueLine}>{valueDisplay}</Text>
      )}
      <Text style={styles.metaLine}>
        {row.code_system} {row.code} · {row.source.replace("_", " ")}
      </Text>
    </View>
  );
}

/** Pure-helper formatting; exported only for the test suite. */
export function formatValue(row: ObservationRow): string | null {
  if (row.value_num != null) {
    return row.unit ? `${row.value_num} ${row.unit}` : String(row.value_num);
  }
  if (row.value_text != null) {
    return row.value_text;
  }
  return null;
}

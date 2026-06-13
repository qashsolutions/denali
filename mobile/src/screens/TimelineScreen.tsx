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
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApiClient } from "@/auth";
import type { ObservationRow, SexAtBirth } from "@/contracts";
import { useDal } from "@/db/DalProvider";
import { useTheme } from "@/theme/useTheme";

import { dateKeyOf, formatGroupHeader } from "./timeline/groupObservations";
import {
  groupByInstrumentSession,
  type TimelineCard,
} from "./timeline/grouping";
import { TimelineCardView } from "./timeline/TimelineCardView";

const PAGE_SIZE = 200;

type ListItem =
  | { kind: "header"; dateKey: string }
  | { kind: "card"; card: TimelineCard };

function cardEffectiveAt(card: TimelineCard): string {
  return card.kind === "instrument-session"
    ? card.effective_at
    : card.row.effective_at;
}

function cardId(card: TimelineCard): string {
  return card.kind === "instrument-session"
    ? `s:${card.instrumentId}|${card.effective_at}`
    : `r:${card.row.id}`;
}

export function TimelineScreen(): React.ReactElement {
  const dal = useDal();
  const api = useApiClient();
  const { active, theme } = useTheme();
  const insets = useSafeAreaInsets();

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

  // Two-stage transformation:
  //   1. groupByInstrumentSession collapses questionnaire items into
  //      one card per submission, filters source='derived' rows out
  //      (operator delta 1), and lets non-instrument rows through as
  //      `kind: "single"`.
  //   2. Bucket the resulting cards by calendar day for section headers.
  // No coded data is dropped — Details on each card surfaces the raw
  // codes, and any export path reads the DAL directly.
  const cards: TimelineCard[] = React.useMemo(
    () => groupByInstrumentSession(rows),
    [rows],
  );

  const items: ListItem[] = React.useMemo(() => {
    if (cards.length === 0) return [];
    const buckets = new Map<string, TimelineCard[]>();
    for (const card of cards) {
      const key = dateKeyOf(cardEffectiveAt(card));
      const bucket = buckets.get(key);
      if (bucket) bucket.push(card);
      else buckets.set(key, [card]);
    }
    for (const bucket of buckets.values()) {
      bucket.sort((a, b) =>
        cardEffectiveAt(a) < cardEffectiveAt(b) ? 1 : -1,
      );
    }
    const sortedKeys = [...buckets.keys()].sort((a, b) =>
      a < b ? 1 : -1,
    );
    const out: ListItem[] = [];
    for (const key of sortedKeys) {
      out.push({ kind: "header", dateKey: key });
      for (const card of buckets.get(key) ?? []) {
        out.push({ kind: "card", card });
      }
    }
    return out;
  }, [cards]);

  // Expand-state per card id. Defaults to collapsed; tapping "Show
  // details" toggles membership in the set.
  const [expandedCardIds, setExpandedCardIds] = React.useState<Set<string>>(
    () => new Set<string>(),
  );
  const toggleExpand = React.useCallback((id: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // User's sex_at_birth — feeds AUDIT-C's sex-dependent interpretation.
  // Loaded from the local profile if present. Null falls back to the
  // more-sensitive female bands per delta 3 with a surfaced note.
  const [userSexAtBirth, setUserSexAtBirth] = React.useState<SexAtBirth | null>(
    null,
  );
  React.useEffect(() => {
    if (!dal) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await dal.getProfile();
        if (cancelled) return;
        setUserSexAtBirth(profile?.sex_at_birth ?? null);
      } catch (err) {
        console.warn("[Timeline] getProfile failed", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, dal]);

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
          paddingTop: insets.top + theme.spacing.lg,
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
    [active, theme, insets.top],
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
    const id = cardId(item.card);
    return (
      <TimelineCardView
        card={item.card}
        isExpanded={expandedCardIds.has(id)}
        onToggleExpand={() => toggleExpand(id)}
        formattedDate={formatGroupHeader(dateKeyOf(cardEffectiveAt(item.card)))}
        userSexAtBirth={userSexAtBirth}
      />
    );
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
  return item.kind === "header" ? `h:${item.dateKey}` : cardId(item.card);
}


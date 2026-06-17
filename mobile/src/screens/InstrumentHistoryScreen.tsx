/**
 * InstrumentHistoryScreen — full check-in history for one instrument domain (D30).
 *
 * Reached by tapping the "Latest check-in" card on an instrument DomainDetail
 * (Mood, Anxiety, Sleep, Alcohol, Urinary, Menopause, Hormonal). When that
 * screen consolidated to chart + latest-card (so the chart's dots aren't
 * duplicated by a card-per-session wall), the full date-bucketed session list
 * moved here — the sibling of MarkerDetailScreen for instruments.
 *
 * Renders every past check-in session as a TimelineCardView (expandable for the
 * per-item breakdown). Read-only: loads via the DAL, rolls up to this domain.
 * Storage/export untouched.
 */

import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronLeft } from "lucide-react-native";
import React from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApiClient } from "@/auth";
import { FadeInView } from "@/components/FadeInView";
import { Ridgeline } from "@/components/Ridgeline";
import { Skeleton } from "@/components/Skeleton";
import type { ObservationRow, SexAtBirth } from "@/contracts";
import { useDal } from "@/db/DalProvider";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import { dateKeyOf, formatGroupHeader } from "./timeline/groupObservations";
import {
  getDomainIcon,
  getDomainName,
  STANDING_DISCLAIMER,
} from "./timeline/displayMapping";
import { groupByInstrumentSession, type TimelineCard } from "./timeline/grouping";
import { rollupCardsByDomain } from "./timeline/rollup";
import { TimelineCardView } from "./timeline/TimelineCardView";

import type { RootStackParamList } from "@/navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList, "InstrumentHistory">;
type Route = RouteProp<RootStackParamList, "InstrumentHistory">;

const PAGE_SIZE = 2000;

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

export function InstrumentHistoryScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { domainId } = route.params;
  const dal = useDal();
  const api = useApiClient();
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const insets = useSafeAreaInsets();

  const [rows, setRows] = React.useState<ObservationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [userSexAtBirth, setUserSexAtBirth] = React.useState<SexAtBirth | null>(
    null,
  );
  const [expandedCardIds, setExpandedCardIds] = React.useState<
    ReadonlySet<string>
  >(() => new Set<string>());
  const toggleCardExpanded = React.useCallback((id: string) => {
    setExpandedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

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
          setRows(
            user ? list.filter((o) => o.user_id === user.userId) : list,
          );
          const profile = await dal.getProfile();
          if (!cancelled) setUserSexAtBirth(profile?.sex_at_birth ?? null);
        } catch (err) {
          console.warn("[InstrumentHistory] load failed", err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [api, dal]),
  );

  // rows → cards → rollups → this domain's sessions, date-bucketed newest-first.
  const items: ListItem[] = React.useMemo(() => {
    const cards = groupByInstrumentSession(rows);
    const rollups = rollupCardsByDomain(cards, userSexAtBirth);
    const mine = rollups.find((r) => r.domainId === domainId);
    if (mine == null || mine.kind !== "instrument-domain") return [];

    const buckets = new Map<string, TimelineCard[]>();
    for (const card of mine.sessions) {
      const key = dateKeyOf(cardEffectiveAt(card));
      const bucket = buckets.get(key);
      if (bucket) bucket.push(card);
      else buckets.set(key, [card]);
    }
    for (const bucket of buckets.values()) {
      bucket.sort((a, b) => (cardEffectiveAt(a) < cardEffectiveAt(b) ? 1 : -1));
    }
    const sortedKeys = [...buckets.keys()].sort((a, b) => (a < b ? 1 : -1));
    const out: ListItem[] = [];
    for (const key of sortedKeys) {
      out.push({ kind: "header", dateKey: key });
      for (const c of buckets.get(key) ?? []) out.push({ kind: "card", card: c });
    }
    return out;
  }, [rows, userSexAtBirth, domainId]);

  const styles = React.useMemo(
    () => makeStyles(theme, redesign, fontsLoaded, insets.top, insets.bottom),
    [theme, redesign, fontsLoaded, insets.top, insets.bottom],
  );

  const Icon = getDomainIcon(domainId);
  const friendlyName = getDomainName(domainId);

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
        onToggleExpand={() => toggleCardExpanded(id)}
        formattedDate={formatGroupHeader(dateKeyOf(cardEffectiveAt(item.card)))}
        userSexAtBirth={userSexAtBirth}
        showDisclaimer={false}
      />
    );
  };

  if (loading) {
    return (
      <View style={styles.screen}>
        <Ridgeline blueOpacity={0.13} tealOpacity={0.15} />
        <View style={styles.header}>
          <Skeleton width={44} height={44} radius={redesign.rChip} />
          <Skeleton width={30} height={30} radius={redesign.rChip - 1} />
          <Skeleton width={150} height={24} radius={8} />
        </View>
        <View
          style={{
            paddingHorizontal: theme.spacing.space5,
            gap: theme.spacing.space3,
            marginTop: theme.spacing.md,
          }}
        >
          <Skeleton height={120} radius={redesign.rCard} />
          <Skeleton height={120} radius={redesign.rCard} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Ridgeline blueOpacity={0.13} tealOpacity={0.15} />
      <View style={styles.header}>
        <Pressable
          testID="instrument_history_back"
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
        <Text style={styles.headerTitle}>{friendlyName}</Text>
      </View>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionHeaderText}>All check-ins</Text>
      </View>
      <FadeInView style={{ flex: 1 }}>
        <FlatList
          style={{ flex: 1 }}
          data={items}
          keyExtractor={(item) =>
            item.kind === "header" ? `h:${item.dateKey}` : cardId(item.card)
          }
          renderItem={renderItem}
        />
      </FadeInView>
      <View style={styles.disclaimerStrip}>
        <Text style={styles.disclaimerText}>{STANDING_DISCLAIMER}</Text>
        <Text
          testID="instrument_history_provisional_footnote"
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
      minWidth: 48,
      minHeight: 48,
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

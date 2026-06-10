/**
 * DomainDetailScreen — Phase-3 increment 1.
 *
 * Reached by tapping a DomainCard on the HealthDashboardScreen. Renders:
 *
 *   1. Header — back button + domain icon + plain name.
 *   2. Body — the domain's history as a list of TimelineCardView rows
 *      (reused verbatim from Part B). For instrument-domain rollups
 *      this is each session as a card; for single-domain rollups
 *      each row as a card.
 *   3. Empty-state — domain prompt + standing disclaimer when the
 *      domain has no data.
 *
 * Increment 2 adds the full-history chart above the list. Increment 3
 * adds trend statements derived from the session history.
 *
 * No DAL writes. Reads observations once on mount via the same
 * pattern HealthDashboardScreen uses, then rolls up + filters to
 * this domain. All theme tokens via useTheme().
 */

import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ChevronLeft } from "lucide-react-native";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApiClient } from "@/auth";
import { Ridgeline } from "@/components/Ridgeline";
import type { ObservationRow, SexAtBirth } from "@/contracts";
import { useDal } from "@/db/DalProvider";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import { dateKeyOf, formatGroupHeader } from "./timeline/groupObservations";
import {
  getDomainIcon,
  getDomainName,
  getDomainPrompt,
  STANDING_DISCLAIMER,
} from "./timeline/displayMapping";
import { groupByInstrumentSession, type TimelineCard } from "./timeline/grouping";
import { rollupCardsByDomain } from "./timeline/rollup";
import { TimelineCardView } from "./timeline/TimelineCardView";

import type { RootStackParamList } from "@/navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList, "DomainDetail">;
type Route = RouteProp<RootStackParamList, "DomainDetail">;

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

export function DomainDetailScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { domainId } = route.params;
  const dal = useDal();
  const api = useApiClient();
  const { active, theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  // Safe-area top inset keeps the custom header below the status bar.
  // Without this, the back arrow sits underneath the system clock and
  // the OS captures the tap before our Pressable sees it — that's why
  // the back button appeared dead on first ship.
  const insets = useSafeAreaInsets();

  const [rows, setRows] = React.useState<ObservationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [userSexAtBirth, setUserSexAtBirth] = React.useState<SexAtBirth | null>(null);

  React.useEffect(() => {
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
        const scoped = user ? list.filter((o) => o.user_id === user.userId) : list;
        setRows(scoped);
        const profile = await dal.getProfile();
        if (!cancelled) setUserSexAtBirth(profile?.sex_at_birth ?? null);
      } catch (err) {
        console.warn("[DomainDetail] load failed", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api, dal]);

  // Two-stage transform mirrors the dashboard: rows → cards → rollups.
  // Then filter to just THIS domain.
  const items: ListItem[] = React.useMemo(() => {
    const cards = groupByInstrumentSession(rows);
    const rollups = rollupCardsByDomain(cards, userSexAtBirth);
    const mine = rollups.find((r) => r.domainId === domainId);
    if (mine == null || mine.kind === "empty-domain") return [];

    // Flatten the rollup back to TimelineCard[] for date-bucketing.
    const cardsInDomain: TimelineCard[] = [];
    if (mine.kind === "instrument-domain") {
      cardsInDomain.push(...mine.sessions);
    } else {
      // single-domain — wrap each row back as a single card.
      for (const row of mine.rows) {
        cardsInDomain.push({ kind: "single", row });
      }
    }

    // Bucket by date for section headers.
    const buckets = new Map<string, TimelineCard[]>();
    for (const card of cardsInDomain) {
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
    const sortedKeys = [...buckets.keys()].sort((a, b) => (a < b ? 1 : -1));
    const out: ListItem[] = [];
    for (const key of sortedKeys) {
      out.push({ kind: "header", dateKey: key });
      for (const c of buckets.get(key) ?? []) out.push({ kind: "card", card: c });
    }
    return out;
  }, [rows, userSexAtBirth, domainId]);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: redesign.paper },
        // Mockup .navh: back chip + icon dot + display-face title.
        header: {
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.space3 - 2,
          paddingHorizontal: theme.spacing.space5,
          // Stack the device's status-bar inset on top of our own spacing
          // so the header always clears the system clock.
          paddingTop: insets.top + theme.spacing.md,
          paddingBottom: theme.spacing.md,
        },
        backButton: {
          // Mockup .navh .back is a 34×34 teal-wash chip; we keep the
          // 44×44 minimum tap target by padding the Pressable and round
          // the chip look onto it. Pairs with hitSlop for forgiveness.
          minWidth: 44,
          minHeight: 44,
          borderRadius: redesign.rChip,
          backgroundColor: redesign.tealWash,
          alignItems: "center",
          justifyContent: "center",
        },
        // Mockup .navh .dot: 30×30, r=9, teal on teal-wash.
        iconDot: {
          width: theme.spacing.xl - 2,
          height: theme.spacing.xl - 2,
          borderRadius: redesign.rChip - 1,
          backgroundColor: redesign.tealWash,
          alignItems: "center",
          justifyContent: "center",
        },
        // Mockup .navh .ttl: display 700, 22px, -.02em.
        headerTitle: {
          color: redesign.ink,
          fontSize: theme.typography.sizes["2xl"] - 2,
          letterSpacing: -0.44,
          flexShrink: 1,
          ...fontStyle("display", 700, fontsLoaded),
        },
        // Date bucket headers — eyebrow treatment on paper (no band).
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
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: theme.spacing.lg,
        },
        emptyTitle: {
          color: redesign.ink,
          fontSize: theme.typography.sizes.xl,
          textAlign: "center",
          marginBottom: theme.spacing.sm,
          ...fontStyle("display", 700, fontsLoaded),
        },
        emptyBody: {
          color: redesign.ink2,
          fontSize: theme.typography.sizes.base,
          lineHeight: theme.typography.sizes.base * 1.5,
          textAlign: "center",
          ...fontStyle("body", 400, fontsLoaded),
        },
        // Mockup .disclaimer: borderless, paper, 12px ink-3, centered.
        disclaimerStrip: {
          paddingHorizontal: theme.spacing.space5,
          paddingTop: theme.spacing.space3,
          paddingBottom: insets.bottom + theme.spacing.space3,
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
      }),
    [theme, redesign, insets.top, insets.bottom, fontsLoaded],
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
    return (
      <TimelineCardView
        card={item.card}
        isExpanded={true /* details always expanded on the detail screen */}
        onToggleExpand={() => {}}
        formattedDate={formatGroupHeader(dateKeyOf(cardEffectiveAt(item.card)))}
        userSexAtBirth={userSexAtBirth}
      />
    );
  };

  if (loading) {
    return (
      <View style={[styles.screen, styles.center]}>
        <ActivityIndicator color={active.accentPrimary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Signature ridgeline — fainter on detail screens (mockup frame 2). */}
      <Ridgeline blueOpacity={0.13} tealOpacity={0.15} />
      <View style={styles.header}>
        <Pressable
          testID="domain_detail_back"
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
      {items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptyBody}>{getDomainPrompt(domainId)}</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) =>
            item.kind === "header" ? `h:${item.dateKey}` : cardId(item.card)
          }
          renderItem={renderItem}
        />
      )}
      <View style={styles.disclaimerStrip}>
        <Text style={styles.disclaimerText}>{STANDING_DISCLAIMER}</Text>
        <Text
          testID="domain_detail_provisional_footnote"
          style={styles.disclaimerText}
        >
          ‡ Interpretation pending clinical review.
        </Text>
      </View>
    </View>
  );
}

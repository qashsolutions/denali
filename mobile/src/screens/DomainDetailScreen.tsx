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

import {
  useFocusEffect,
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Check, ChevronLeft } from "lucide-react-native";
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
import { PressableScale } from "@/components/PressableScale";
import { Ridgeline } from "@/components/Ridgeline";
import { Skeleton } from "@/components/Skeleton";
import type { ObservationRow, SexAtBirth } from "@/contracts";
import { useDal } from "@/db/DalProvider";
import { hapticSelection } from "@/feedback/haptics";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import { dateKeyOf, formatGroupHeader } from "./timeline/groupObservations";
import {
  getDomainIcon,
  getDomainName,
  getDomainPrompt,
  STANDING_DISCLAIMER,
} from "./timeline/displayMapping";
import { checkInAvailable } from "./instrumentsFocus";
import { groupByInstrumentSession, type TimelineCard } from "./timeline/grouping";
import { rollupCardsByDomain } from "./timeline/rollup";
import { TimelineCardView } from "./timeline/TimelineCardView";
import { BmiTrendChart } from "./timeline/trend/BmiTrendChart";
import { isChartableInstrument, type TrendRange } from "./timeline/trend/sessions";
import { TrendChart } from "./timeline/trend/TrendChart";
import { TrendRangeControl } from "./timeline/trend/TrendRangeControl";
import { deriveBmiTrend } from "./markers/bmi";
import { latestPerCode } from "./markers/latestPerCode";

import type { RootStackParamList } from "@/navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList, "DomainDetail">;
type Route = RouteProp<RootStackParamList, "DomainDetail">;

const PAGE_SIZE = 200;

type ListItem =
  | { kind: "header"; dateKey: string }
  /** Plain section label (non-date) — e.g. "Latest readings" for markers. */
  | { kind: "label"; text: string }
  | { kind: "card"; card: TimelineCard }
  /** Trend section (Step 3): range control + one chart per chartable
   *  instrument, placed below the latest-session card. */
  | { kind: "trend"; instrumentIds: string[] }
  /** BMI trend section: range control + BmiTrendChart for health_markers. */
  | { kind: "bmi-trend"; rows: ObservationRow[] };

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

/** Short clock time ("12:27 pm") for the "last check-in" status line. */
function formatClockTime(iso: string): string {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? "pm" : "am";
  h = h % 12;
  if (h === 0) h = 12;
  return `${h}:${m < 10 ? `0${m}` : m} ${ampm}`;
}

/**
 * "Start a check-in" CTA (Step 4) — mockup frame-2 .cta treatment.
 * Navigation chrome only (clinical pre-review Finding 4); the same
 * button serves the trend section and the empty state.
 */
function StartCheckInButton({
  onPress,
  styles,
}: {
  onPress: () => void;
  styles: { cta: object; ctaLabel: object };
}): React.ReactElement {
  return (
    <Pressable
      testID="domain_detail_start_checkin"
      accessibilityRole="button"
      accessibilityLabel="Start a check-in"
      onPress={onPress}
      style={styles.cta}
    >
      <Text style={styles.ctaLabel}>Start a check-in</Text>
    </Pressable>
  );
}

export function DomainDetailScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { domainId } = route.params;
  const dal = useDal();
  const api = useApiClient();
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  // Safe-area top inset keeps the custom header below the status bar.
  // Without this, the back arrow sits underneath the system clock and
  // the OS captures the tap before our Pressable sees it — that's why
  // the back button appeared dead on first ship.
  const insets = useSafeAreaInsets();

  const [rows, setRows] = React.useState<ObservationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [userSexAtBirth, setUserSexAtBirth] = React.useState<SexAtBirth | null>(null);
  // Shared by every chart on this screen; default 6M (Step-3 rule 11).
  const [trendRange, setTrendRange] = React.useState<TrendRange>("6m");
  // Light tick when the user picks a different range (navigation chrome — the
  // range control is not clinical content; the charts it scopes are untouched).
  const onTrendRangeChange = React.useCallback((next: TrendRange) => {
    hapticSelection();
    setTrendRange(next);
  }, []);
  // Cards start COLLAPSED on the detail screen (operator review 2026-06-12):
  // the trend chart is the hero at the top, and the per-session text tucks
  // into collapsible cards below. Track the EXPANDED set (empty = all
  // collapsed); the headline + pill still show collapsed, details on tap.
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
  // One-shot "Saved" confirmation after returning from a completed check-in
  // (status chrome only — never a clinical claim). `lastSavedShownRef` keeps
  // it from re-firing on every focus for the same session.
  const [showSaved, setShowSaved] = React.useState(false);
  const lastSavedShownRef = React.useRef<string | null>(null);
  // Today's sessions via a non-collapsed query — drives the "N× today"
  // count. `rows` (latest_only) collapses same-day repeats, so it can't
  // count them.
  const [todayRows, setTodayRows] = React.useState<ObservationRow[]>([]);

  // Reload on every screen FOCUS (not just mount) — returning from a
  // repeat check-in (Step 4) must show the new session immediately.
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
          const scoped = user ? list.filter((o) => o.user_id === user.userId) : list;
          setRows(scoped);
          const profile = await dal.getProfile();
          if (!cancelled) setUserSexAtBirth(profile?.sex_at_birth ?? null);
          // Today-only, non-collapsed — for the "N× today" count.
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const todayList = await dal.listObservations({
            latest_only: false,
            since: todayStart.toISOString(),
            limit: PAGE_SIZE,
          });
          if (!cancelled) {
            setTodayRows(
              user
                ? todayList.filter((o) => o.user_id === user.userId)
                : todayList,
            );
          }
        } catch (err) {
          console.warn("[DomainDetail] load failed", err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [api, dal]),
  );

  // Two-stage transform mirrors the dashboard: rows → cards → rollups.
  // Then filter to just THIS domain.
  const items: ListItem[] = React.useMemo(() => {
    const cards = groupByInstrumentSession(rows);
    const rollups = rollupCardsByDomain(cards, userSexAtBirth);
    const mine = rollups.find((r) => r.domainId === domainId);
    if (mine == null || mine.kind === "empty-domain") return [];

    // Health markers consolidate to ONE card per marker (latest reading) under
    // a single "Latest readings" label — the trend chart carries the full
    // history, so a card-per-entry wall is redundant (D27). Date-bucketing is
    // dropped here on purpose: each marker's latest reading has its own date
    // (shown on the card), so buckets would fragment to one card each. Every
    // OTHER domain keeps the date-bucketed, all-entries view — health_history
    // diagnoses are distinct facts, not a "latest value", and instrument
    // sessions are each meaningful.
    const isMarkers =
      mine.kind === "single-domain" && domainId === "health_markers";
    const out: ListItem[] = [];

    if (isMarkers) {
      // latestPerCode is fed the same rows; the BMI chart below still gets the
      // FULL unfiltered history (mine.rows) for its dots.
      const latest = latestPerCode(mine.rows); // newest-first, one per code
      if (latest.length > 0) {
        out.push({ kind: "label", text: "Latest readings" });
        for (const row of latest) {
          out.push({ kind: "card", card: { kind: "single", row } });
        }
      }
    } else {
      // Flatten the rollup back to TimelineCard[] for date-bucketing.
      const cardsInDomain: TimelineCard[] = [];
      if (mine.kind === "instrument-domain") {
        cardsInDomain.push(...mine.sessions);
      } else {
        // single-domain (e.g. health_history) — wrap each row as a card.
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
      for (const key of sortedKeys) {
        out.push({ kind: "header", dateKey: key });
        for (const c of buckets.get(key) ?? []) {
          out.push({ kind: "card", card: c });
        }
      }
    }

    // Trend section (Step 3) — chartable instruments in this domain,
    // ordered by most-recent session (cardsInDomain is newest-first
    // within buckets; walk in list order for first-appearance recency).
    if (mine.kind === "instrument-domain") {
      const seen = new Set<string>();
      const instrumentIds: string[] = [];
      for (const item of out) {
        if (item.kind !== "card" || item.card.kind !== "instrument-session") continue;
        const id = item.card.instrumentId;
        if (seen.has(id)) continue;
        seen.add(id);
        // PHQ-2 is the quick SCREEN that gates the full PHQ-9 check-in — not a
        // severity-tracking instrument, so the Mood domain charts only the full
        // check-in (operator review 2026-06-12). Scoped here, not in
        // isChartableInstrument, to leave the dashboard sparkline untouched.
        if (id === "PHQ-2") continue;
        if (isChartableInstrument(id)) instrumentIds.push(id);
      }
      if (instrumentIds.length > 0) {
        // The chart is the hero — pin it to the TOP, above the session history.
        out.unshift({ kind: "trend", instrumentIds });
      }
    }

    // BMI trend section — health_markers single-domain only.
    // Pin above the value cards if ≥1 BMI point is computable from the rows
    // (deriveBmiTrend returns [] when there is no height+weight pair, so this
    // guard is the only gate needed — the chart itself handles n<2 quietly).
    if (isMarkers) {
      const bmiPoints = deriveBmiTrend(mine.rows);
      if (bmiPoints.length >= 1) {
        // Pass the raw rows (not the points) so BmiTrendChart can re-derive
        // full history and apply its own range filter reactively as trendRange
        // changes without re-running the useMemo.
        out.unshift({ kind: "bmi-trend", rows: [...mine.rows] });
      }
    }

    return out;
  }, [rows, userSexAtBirth, domainId]);

  // Most-recent session timestamp in this domain — drives "checked in
  // today" + the recency window that triggers the one-shot "Saved" banner.
  const latestAt = React.useMemo(() => {
    let max: string | null = null;
    for (const it of items) {
      if (it.kind !== "card") continue;
      const t = cardEffectiveAt(it.card);
      if (max == null || t > max) max = t;
    }
    return max;
  }, [items]);

  // Count of distinct check-in sessions today for this domain (drives the
  // "N× today" line). Same group→rollup pipeline as `items`, run over the
  // non-collapsed today query.
  const todayCount = React.useMemo(() => {
    const cards = groupByInstrumentSession(todayRows);
    const rollups = rollupCardsByDomain(cards, userSexAtBirth);
    const mine = rollups.find((r) => r.domainId === domainId);
    if (mine == null || mine.kind !== "instrument-domain") return 0;
    return mine.sessions.length;
  }, [todayRows, userSexAtBirth, domainId]);

  // Show "Saved" once per distinct just-written session: a session whose
  // effective_at is within the last 90s means we returned straight from a
  // completed check-in. The ref guards against re-showing on later focuses.
  React.useEffect(() => {
    if (latestAt == null) return;
    const ageMs = Date.now() - Date.parse(latestAt);
    if (ageMs >= 0 && ageMs < 90_000 && lastSavedShownRef.current !== latestAt) {
      lastSavedShownRef.current = latestAt;
      setShowSaved(true);
      const t = setTimeout(() => setShowSaved(false), 2500);
      return () => clearTimeout(t);
    }
  }, [latestAt]);

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
        // Trend section — range control sits above the per-instrument
        // charts; charts carry their own card margins.
        trendSection: {
          paddingTop: theme.spacing.xs,
          gap: theme.spacing.space3,
        },
        trendControlWrap: {
          marginHorizontal: theme.spacing.space5,
        },
        // Mockup .cta: teal primary, white 600 label, r=14, soft teal shadow.
        cta: {
          marginHorizontal: theme.spacing.space5,
          marginTop: theme.spacing.xs,
          paddingVertical: theme.spacing.md - 1,
          borderRadius: theme.radii.xl - 2,
          backgroundColor: redesign.teal,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
          shadowColor: redesign.teal,
          shadowOpacity: 0.28,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 6 },
          elevation: 3,
        },
        ctaLabel: {
          color: redesign.surface,
          fontSize: theme.typography.sizes.base,
          ...fontStyle("body", 600, fontsLoaded),
        },
        ctaSecondary: {
          marginHorizontal: theme.spacing.space5,
          marginTop: theme.spacing.sm,
          paddingVertical: theme.spacing.md - 1,
          borderRadius: theme.radii.xl - 2,
          backgroundColor: redesign.surface,
          borderColor: redesign.line,
          borderWidth: 1,
          alignItems: "center",
          justifyContent: "center",
          minHeight: 48,
        },
        ctaSecondaryLabel: {
          color: redesign.tealDeep,
          fontSize: theme.typography.sizes.base,
          ...fontStyle("body", 600, fontsLoaded),
        },
        // "Saved" pill (teal-wash chip, centered) — transient confirmation.
        savedBanner: {
          flexDirection: "row",
          alignItems: "center",
          gap: theme.spacing.xs,
          alignSelf: "center",
          marginTop: theme.spacing.sm,
          paddingVertical: theme.spacing.xs,
          paddingHorizontal: theme.spacing.md,
          borderRadius: redesign.rChip,
          backgroundColor: redesign.tealWash,
        },
        savedBannerText: {
          color: redesign.tealDeep,
          fontSize: theme.typography.sizes.sm,
          ...fontStyle("body", 600, fontsLoaded),
        },
        // Persistent "checked in today" line once the banner fades.
        checkedInLine: {
          color: redesign.tealDeep,
          fontSize: theme.typography.sizes.sm,
          textAlign: "center",
          marginTop: theme.spacing.sm,
          ...fontStyle("body", 600, fontsLoaded),
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
    if (item.kind === "label") {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{item.text}</Text>
        </View>
      );
    }
    if (item.kind === "trend") {
      return (
        <View style={styles.trendSection}>
          <View style={styles.trendControlWrap}>
            <TrendRangeControl value={trendRange} onChange={onTrendRangeChange} />
          </View>
          {item.instrumentIds.map((id) => (
            <TrendChart
              key={id}
              instrumentId={id}
              range={trendRange}
              userSexAtBirth={userSexAtBirth}
            />
          ))}
        </View>
      );
    }
    if (item.kind === "bmi-trend") {
      return (
        <View style={styles.trendSection}>
          <View style={styles.trendControlWrap}>
            <TrendRangeControl value={trendRange} onChange={onTrendRangeChange} />
          </View>
          <BmiTrendChart rows={item.rows} range={trendRange} />
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
        // The screen pins the standing disclaimer + ‡ legend once at the
        // bottom; suppress the per-card copy of the SAME two lines
        // (2026-06-09 operator review — no double display).
        showDisclaimer={false}
      />
    );
  };

  if (loading) {
    // Content-shaped skeletons (header chip + title, then a few cards) read as
    // "loading your history" far better than a centered spinner.
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
          <Skeleton height={140} radius={redesign.rCard} />
          <Skeleton height={92} radius={redesign.rCard} />
          <Skeleton height={92} radius={redesign.rCard} />
        </View>
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
      {/* Populated instrument domains: the saved result is the hero, so the
          re-check-in CTA is a quiet SECONDARY action — a just-finished
          check-in must not read as an unmet "start" prompt. A one-shot
          "Saved" pill then a "checked in today" line confirm the write
          landed. Status + navigation chrome only — no clinical claims. */}
      {items.length > 0 && checkInAvailable(domainId, userSexAtBirth) ? (
        <>
          {showSaved ? (
            <View testID="domain_detail_saved_banner" style={styles.savedBanner}>
              <Check color={redesign.tealDeep} size={16} />
              <Text style={styles.savedBannerText}>Saved</Text>
            </View>
          ) : todayCount > 0 && latestAt != null ? (
            <Text
              testID="domain_detail_checked_in_today"
              style={styles.checkedInLine}
            >
              {todayCount === 1
                ? `✓ Checked in today at ${formatClockTime(latestAt)}`
                : `✓ Checked in ${todayCount}× today · last at ${formatClockTime(latestAt)}`}
            </Text>
          ) : null}
          <PressableScale
            testID="domain_detail_start_checkin"
            haptic
            accessibilityRole="button"
            accessibilityLabel="Check in again"
            onPress={() =>
              navigation.navigate("Instruments", { focus: domainId })
            }
            style={styles.ctaSecondary}
          >
            <Text style={styles.ctaSecondaryLabel}>Check in again</Text>
          </PressableScale>
        </>
      ) : null}
      {items.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>No data yet</Text>
          <Text style={styles.emptyBody}>{getDomainPrompt(domainId)}</Text>
          {checkInAvailable(domainId, userSexAtBirth) ? (
            <StartCheckInButton
              onPress={() => navigation.navigate("Instruments", { focus: domainId })}
              styles={styles}
            />
          ) : domainId === "health_markers" ? (
            // Health markers: log a value by hand OR upload a report — both
            // populate markers, without backing out to the dashboard.
            <>
              <Pressable
                testID="domain_detail_log_value"
                accessibilityRole="button"
                accessibilityLabel="Log a value"
                onPress={() => navigation.navigate("LogMarker")}
                style={styles.cta}
              >
                <Text style={styles.ctaLabel}>Log a value</Text>
              </Pressable>
              <Pressable
                testID="domain_detail_upload_cta"
                accessibilityRole="button"
                accessibilityLabel="Upload a report"
                onPress={() =>
                  navigation.navigate("MainTabs", { screen: "Upload" })
                }
                style={styles.ctaSecondary}
              >
                <Text style={styles.ctaSecondaryLabel}>Upload a report</Text>
              </Pressable>
            </>
          ) : null}
        </View>
      ) : (
        <FadeInView style={{ flex: 1 }}>
          <FlatList
            style={{ flex: 1 }}
            data={items}
            keyExtractor={(item) => {
              if (item.kind === "header") return `h:${item.dateKey}`;
              if (item.kind === "label") return `l:${item.text}`;
              if (item.kind === "trend") return "trend";
              if (item.kind === "bmi-trend") return "bmi-trend";
              return cardId(item.card);
            }}
            renderItem={renderItem}
          />
        </FadeInView>
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

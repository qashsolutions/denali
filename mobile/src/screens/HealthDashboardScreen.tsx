/**
 * HealthDashboardScreen — Phase-3 increment 1, redesign step-1 skin
 * ("Alpine clarity" — docs/design/denali-redesign-mockups.html frame 1,
 * "Your health").
 *
 * The Timeline-tab landing. Renders:
 *
 *   1. Ridgeline signature behind the header (two layered polylines).
 *   2. Header: "Your health" (display face) + today's date.
 *   3. "YOUR CHECKS" eyebrow: every cohort-relevant domain except the
 *      markers umbrella — data-bearing rollups first, then empty ones
 *      (same rollup logic and relative ordering as before; the split
 *      into a separate "Available" section was presentation-only and
 *      is replaced by the mockup's two-eyebrow layout).
 *   4. "YOUR MARKERS" eyebrow: the health_markers umbrella domain —
 *      the educational markers card when empty.
 *   5. Footer (conditional on EXPO_PUBLIC_LEGACY_TIMELINE === "true"):
 *      "All activity" entry → LegacyTimeline.
 *   6. Single pinned bottom disclaimer (+ ‡ provisional legend, which
 *      stays per the clinical-boundary rule in mobile/CLAUDE.md).
 *
 * Behavior unchanged from the pre-redesign screen: same data loads,
 * same rollups, same cards, same navigation targets, same testIDs.
 * Increment 2 adds sparklines; increment 3 adds trend statements.
 */

import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Plus } from "lucide-react-native";
import React from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
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
import { hapticSelection } from "@/feedback/haptics";
import type { ObservationRow, SexAtBirth } from "@/contracts";
import { useDal } from "@/db/DalProvider";
import { DueForCard } from "@/preventive/DueForCard";
import {
  deriveLastDoneByRecId,
  dueScreenings,
  PREVENTIVE_RECOMMENDATIONS,
  type DueScreening,
} from "@/preventive/uspstf";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import { checkInAvailable } from "./instrumentsFocus";
import { QuickAddSheet, type QuickAddOption } from "./QuickAddSheet";
import { DomainCard } from "./timeline/DomainCard";
import { dateKeyOf, formatGroupHeader } from "./timeline/groupObservations";
import { groupByInstrumentSession } from "./timeline/grouping";
import { rollupCardsByDomain, type DomainRollup } from "./timeline/rollup";
import { STANDING_DISCLAIMER } from "./timeline/displayMapping";

import type { IntakeSection, RootStackParamList } from "@/navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList, "MainTabs">;

const PAGE_SIZE = 200;

type ListItem =
  | { kind: "section-header"; title: string }
  | { kind: "rollup"; rollup: DomainRollup }
  | { kind: "due-for"; due: ReadonlyArray<DueScreening> }
  | { kind: "footer-legacy-timeline" };

const PROVISIONAL_FOOTNOTE = "‡ Interpretation pending clinical review.";

const LEGACY_TIMELINE_ENABLED =
  process.env.EXPO_PUBLIC_LEGACY_TIMELINE === "true";

/**
 * Compute the user's age in years from birth_year, using the device's
 * current calendar year. Returns null when birth_year is null. Phase-3
 * plan: age is OPTIONAL — null means "no age-specific normal/abnormal
 * claim", handled at the lookup layer.
 */
function computeAgeYears(birthYear: number | null): number | null {
  if (birthYear == null) return null;
  const now = new Date().getFullYear();
  const age = now - birthYear;
  return Number.isFinite(age) && age >= 0 && age < 150 ? age : null;
}

export function HealthDashboardScreen(): React.ReactElement {
  const navigation = useNavigation<Nav>();
  const dal = useDal();
  const api = useApiClient();
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  // Safe-area insets keep the header below the status bar and the sticky
  // disclaimer footer above any home-indicator / gesture bar.
  const insets = useSafeAreaInsets();

  const [rows, setRows] = React.useState<ObservationRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [userSexAtBirth, setUserSexAtBirth] = React.useState<SexAtBirth | null>(null);
  const [userBirthYear, setUserBirthYear] = React.useState<number | null>(null);
  const [quickAddVisible, setQuickAddVisible] = React.useState(false);

  // "+ Add" capture hub — routes to the standalone intake sections so they
  // stay enterable after onboarding. (Check-ins log from the per-card CTA;
  // uploads have their own tab.)
  const quickAddOptions = React.useMemo<QuickAddOption[]>(() => {
    const close = () => setQuickAddVisible(false);
    const goSection = (section: IntakeSection) => () => {
      close();
      navigation.navigate("Intake", { section });
    };
    return [
      {
        key: "marker",
        label: "A lab or vital value",
        hint: "Log A1c, blood pressure, weight…",
        onPress: () => {
          close();
          navigation.navigate("LogMarker");
        },
      },
      {
        key: "upload",
        label: "Upload a report",
        hint: "A lab result or visit summary",
        onPress: () => {
          close();
          navigation.navigate("MainTabs", { screen: "Upload" });
        },
      },
      {
        key: "complaint",
        label: "A symptom or concern",
        hint: "Something that's on your mind",
        onPress: goSection("complaint"),
      },
      {
        key: "history",
        label: "A past diagnosis",
        hint: "A condition you've been diagnosed with",
        onPress: goSection("history"),
      },
      {
        key: "family",
        label: "Family history",
        hint: "What runs in the family",
        onPress: goSection("family"),
      },
      {
        key: "lifestyle",
        label: "Daily habits",
        hint: "Smoking, alcohol, activity, food, sleep",
        onPress: goSection("lifestyle"),
      },
    ];
  }, [navigation]);

  // Core load — shared by the focus effect + pull-to-refresh.
  const loadData = React.useCallback(async () => {
    if (!dal) return;
    const user = api.getCurrentUser();
    const list = await dal.listObservations({
      latest_only: true,
      limit: PAGE_SIZE,
    });
    const scoped = user ? list.filter((o) => o.user_id === user.userId) : list;
    setRows(scoped);
    const profile = await dal.getProfile();
    setUserSexAtBirth(profile?.sex_at_birth ?? null);
    setUserBirthYear(profile?.birth_year ?? null);
  }, [api, dal]);

  // Reload on every screen FOCUS (not just mount) — returning from a
  // repeat check-in (Step 4) or the detail stack must refresh the pills.
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      (async () => {
        setLoading(true);
        try {
          await loadData();
        } catch (err) {
          console.warn("[HealthDashboard] load failed", err);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [loadData]),
  );

  // Pull-to-refresh — keeps the content visible (no skeleton) + a light tick.
  const onRefresh = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await loadData();
      hapticSelection();
    } catch (err) {
      console.warn("[HealthDashboard] refresh failed", err);
    } finally {
      setRefreshing(false);
    }
  }, [loadData]);

  const userAgeYears = React.useMemo(
    () => computeAgeYears(userBirthYear),
    [userBirthYear],
  );

  const items: ListItem[] = React.useMemo(() => {
    const cards = groupByInstrumentSession(rows);
    const rollups = rollupCardsByDomain(cards, userSexAtBirth);
    // Mockup layout: two eyebrows. "Your checks" carries every domain
    // except the markers umbrella (data-bearing first, then empty —
    // preserving the previous yours/available relative order);
    // "Your markers" carries the health_markers umbrella.
    const checks = rollups.filter((r) => r.domainId !== "health_markers");
    const markers = rollups.filter((r) => r.domainId === "health_markers");
    const checksOrdered = [
      ...checks.filter((r) => r.kind !== "empty-domain"),
      ...checks.filter((r) => r.kind === "empty-domain"),
    ];

    const out: ListItem[] = [];
    // "Due for…" preventive layer — sex/age-filtered, hidden when nothing is
    // due. PREVENTIVE_RECOMMENDATIONS ships empty (reviewer/USPSTF-gated), so
    // `due` is [] today and no card renders; the wiring lights up when the set
    // lands. lastDone resolves from LOCAL observations only (no PHI leaves).
    const due = dueScreenings({
      sexAtBirth: userSexAtBirth,
      ageYears: userAgeYears,
      lastDoneByRecId: deriveLastDoneByRecId(rows, PREVENTIVE_RECOMMENDATIONS),
      now: new Date(),
    });
    if (due.length > 0) {
      out.push({ kind: "section-header", title: "Due for" });
      out.push({ kind: "due-for", due });
    }
    if (checksOrdered.length > 0) {
      out.push({ kind: "section-header", title: "Your checks" });
      for (const r of checksOrdered) out.push({ kind: "rollup", rollup: r });
    }
    if (markers.length > 0) {
      out.push({ kind: "section-header", title: "Your markers" });
      for (const r of markers) out.push({ kind: "rollup", rollup: r });
    }
    if (LEGACY_TIMELINE_ENABLED) {
      out.push({ kind: "footer-legacy-timeline" });
    }
    return out;
  }, [rows, userSexAtBirth, userAgeYears]);

  // Today's date — formatted via the shared `formatGroupHeader` helper so
  // the locale handling matches the per-day section headers used on the
  // detail screen. Recomputed once per render; the value is cheap.
  const todayLabel = React.useMemo(
    () => formatGroupHeader(dateKeyOf(new Date().toISOString())),
    [],
  );

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: redesign.paper },
        header: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: theme.spacing.space5,
          // Stack the device's status-bar inset on top of our own spacing
          // so the title clears the system clock.
          paddingTop: insets.top + theme.spacing.md,
          paddingBottom: theme.spacing.sm,
        },
        headerTextBlock: { flexShrink: 1 },
        addBtn: {
          // 44px min touch target (WCAG 2.5.5 / iOS HIG).
          width: 44,
          height: 44,
          borderRadius: redesign.rChip,
          backgroundColor: redesign.tealWash,
          alignItems: "center",
          justifyContent: "center",
        },
        // Mockup .scr-title: display 700, 30px, -.025em, ink.
        title: {
          color: redesign.ink,
          fontSize: 30,
          letterSpacing: -0.75,
          ...fontStyle("display", 700, fontsLoaded),
        },
        // Mockup .scr-date: body, 14px, ink-2.
        todayLabel: {
          color: redesign.ink2,
          fontSize: theme.typography.sizes.sm,
          marginTop: theme.spacing.xs,
          ...fontStyle("body", 400, fontsLoaded),
        },
        // Mockup .eyebrow: body 600, 11px, .15em tracking, uppercase, ink-3.
        sectionHeader: {
          paddingHorizontal: theme.spacing.space5,
          paddingTop: theme.spacing.space5,
          paddingBottom: theme.spacing.space3 - 1,
        },
        sectionHeaderText: {
          color: redesign.ink3,
          fontSize: 11,
          letterSpacing: 11 * 0.15,
          textTransform: "uppercase",
          ...fontStyle("body", 600, fontsLoaded),
        },
        center: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: theme.spacing.lg,
        },
        legacyEntry: {
          marginHorizontal: theme.spacing.space5,
          marginVertical: theme.spacing.lg,
          padding: theme.spacing.md,
          borderRadius: redesign.rCard,
          borderColor: redesign.line,
          borderWidth: 1,
          backgroundColor: redesign.surface,
        },
        legacyEntryText: {
          color: redesign.ink2,
          fontSize: theme.typography.sizes.sm,
          textAlign: "center",
          ...fontStyle("body", 500, fontsLoaded),
        },
        // Mockup .disclaimer: borderless, paper, 12px ink-3, centered.
        disclaimerStrip: {
          paddingHorizontal: theme.spacing.space5,
          paddingTop: theme.spacing.space3,
          // Bottom inset keeps the disclaimer above any home-indicator
          // or gesture bar; stacked with our own padding for breathing room.
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

  const renderItem: ListRenderItem<ListItem> = ({ item }) => {
    if (item.kind === "section-header") {
      return (
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionHeaderText}>{item.title}</Text>
        </View>
      );
    }
    if (item.kind === "rollup") {
      const r = item.rollup;
      // Surface a per-card "New check-in" only for instrument domains the
      // user can re-log (checkInAvailable); single/empty domains don't.
      const canLog =
        r.kind === "instrument-domain" &&
        checkInAvailable(r.domainId, userSexAtBirth);
      return (
        <DomainCard
          rollup={r}
          userSexAtBirth={userSexAtBirth}
          userAgeYears={userAgeYears}
          onPress={() =>
            navigation.navigate("DomainDetail", { domainId: r.domainId })
          }
          onLogPress={
            canLog
              ? () => navigation.navigate("Instruments", { focus: r.domainId })
              : undefined
          }
        />
      );
    }
    if (item.kind === "due-for") {
      return <DueForCard items={item.due} />;
    }
    return (
      <Pressable
        testID="dashboard_all_activity"
        accessibilityRole="button"
        accessibilityLabel="All activity (chronological)"
        onPress={() => navigation.navigate("LegacyTimeline")}
        style={styles.legacyEntry}
      >
        <Text style={styles.legacyEntryText}>
          See all activity (chronological) →
        </Text>
      </Pressable>
    );
  };

  if (loading) {
    // Skeleton placeholders (title + a few cards) read as "loading your health"
    // far better than a centered spinner.
    return (
      <View style={styles.screen}>
        <Ridgeline />
        <View style={styles.header}>
          <View style={styles.headerTextBlock}>
            <Skeleton width={170} height={28} radius={8} />
            <Skeleton
              width={110}
              height={13}
              radius={6}
              style={{ marginTop: theme.spacing.xs }}
            />
          </View>
        </View>
        <View
          style={{
            paddingHorizontal: theme.spacing.space5,
            gap: theme.spacing.space3,
            marginTop: theme.spacing.md,
          }}
        >
          <Skeleton height={92} radius={redesign.rCard} />
          <Skeleton height={92} radius={redesign.rCard} />
          <Skeleton height={92} radius={redesign.rCard} />
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      {/* Signature ridgeline — absolutely positioned behind the header. */}
      <Ridgeline />
      <View style={styles.header}>
        <View style={styles.headerTextBlock}>
          <Text style={styles.title}>Your health</Text>
          <Text testID="dashboard_today_label" style={styles.todayLabel}>
            {todayLabel}
          </Text>
        </View>
        <PressableScale
          testID="dashboard_quick_add"
          haptic
          onPress={() => setQuickAddVisible(true)}
          style={styles.addBtn}
          accessibilityRole="button"
          accessibilityLabel="Add to your health"
          hitSlop={8}
        >
          <Plus color={redesign.teal} size={24} />
        </PressableScale>
      </View>
      <FadeInView style={{ flex: 1 }}>
        <FlatList
          style={{ flex: 1 }}
          data={items}
          keyExtractor={(item) => {
            if (item.kind === "section-header") return `s:${item.title}`;
            if (item.kind === "rollup") return `r:${item.rollup.domainId}`;
            if (item.kind === "due-for") return "due-for";
            return "footer:legacy";
          }}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={redesign.teal}
              colors={[redesign.teal]}
            />
          }
        />
      </FadeInView>
      {/*
       * Sticky disclaimer block — rendered OUTSIDE the FlatList so it
       * stays pinned at the bottom while the card list scrolls. Two
       * lines: the standing "not medical advice" disclaimer, and the
       * ‡ footnote that legends the provisional mark which still
       * appears on each verdict pill (clinical-boundary rule).
       */}
      <View style={styles.disclaimerStrip}>
        <Text testID="dashboard_disclaimer" style={styles.disclaimerText}>
          {STANDING_DISCLAIMER}
        </Text>
        <Text testID="dashboard_provisional_footnote" style={styles.disclaimerText}>
          {PROVISIONAL_FOOTNOTE}
        </Text>
      </View>
      <QuickAddSheet
        visible={quickAddVisible}
        onClose={() => setQuickAddVisible(false)}
        options={quickAddOptions}
      />
    </View>
  );
}

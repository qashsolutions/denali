/**
 * DomainCard — Phase-3 increment 1, redesign step-1 skin ("Alpine
 * clarity", docs/design/denali-redesign-mockups.html frame 1).
 *
 * The lean card: one row of [icon chip · domain name · verdict pill ·
 * chevron] on a white surface card. The wordy interpretation explanation
 * moved to the detail screen per the mockup; clinical-integrity captions
 * (AUDIT-C sex fallback, birth-year nudge) stay as small lines because
 * they qualify what the pill claims. Three variants by DomainRollup kind:
 *
 *   - instrument-domain → verdict pill from the versioned interpretation
 *     table (‡ appended while provisional).
 *   - single-domain     → "N values tracked" + latest value preview.
 *   - empty-domain      → the domain's educational prompt (e.g. the
 *     "Your markers" card) — neutral icon chip, no pill.
 *
 * Behavior identical to the pre-redesign card: same tap target, same
 * navigation, same testIDs (`dashboard_card_${domainId}`,
 * `dashboard_card_pill`). All colors/radii from useTheme() — no
 * hardcoding. Increment 2 adds the sparkline between row and meta.
 */

import { ChevronRight } from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { SexAtBirth } from "@/contracts";
import { fontStyle, MAX_FONT_SCALE, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import {
  formatDomainSummary,
  getDomainIcon,
  getDomainName,
  getDomainPrompt,
} from "./displayMapping";
import { deriveBmi, deriveBmiTrend, LOINC_BMI } from "../markers/bmi";
import {
  markerPreviewItems,
  type MarkerPreviewItem,
} from "../markers/markerPreview";
import type { TimelineCard } from "./grouping";
import { dateKeyOf, formatGroupHeader } from "./groupObservations";
import { lookupInterpretation } from "./interpretation/lookup";
import { INTERPRETATION_TABLE_V1 } from "./interpretation/tableV1";
import { formatLastCheckins } from "./interpretation/trendStrings";
import { makePillStyles, pillTintForBand, tintByClass } from "./pill";
import type { DomainRollup } from "./rollup";
import { MiniSparkline, useSparklineScores } from "./trend/MiniSparkline";

/** Stable empty list so the top-level sparkline hook memo stays stable
 *  for non-instrument rollups. */
const NO_SESSIONS: ReadonlyArray<TimelineCard> = [];

export interface DomainCardProps {
  rollup: DomainRollup;
  /** From the user's profile; feeds AUDIT-C sex-dependent lookup. */
  userSexAtBirth: SexAtBirth | null;
  /** Computed from birth_year; unused for uniform screeners. */
  userAgeYears: number | null;
  onPress: () => void;
  /**
   * When provided (instrument domains the user can re-log), renders a
   * "New check-in" action on the card so logging doesn't require opening
   * the detail screen first. Tapping it captures a new entry; tapping
   * elsewhere on the card still opens the detail.
   */
  onLogPress?: () => void;
}

/**
 * Latest marker VALUES preview for the "Your markers" card. Each row is a
 * plain-language name + value, with the REPORT's own flag as a chip (sourced,
 * never invented — a value with no stated flag shows no chip). The items are
 * numeric-only + markers-scoped upstream (markerPreviewItems), so no free-text
 * can render here. Renders nothing when there are no items.
 */
function MarkerPreviewList({
  items,
  styles,
  redesign,
}: {
  items: ReadonlyArray<MarkerPreviewItem>;
  styles: ReturnType<typeof makeStyles>;
  redesign: ReturnType<typeof useTheme>["redesign"];
}): React.ReactElement | null {
  if (items.length === 0) return null;
  return (
    <View testID="dashboard_card_marker_preview" style={styles.previewList}>
      {items.map((it) => {
        const chip = it.rag ? tintByClass(redesign, it.rag.tint) : null;
        return (
          <View key={it.id} style={styles.previewRow}>
            <Text style={styles.previewName} numberOfLines={1}>
              {it.label}
            </Text>
            <Text
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              style={styles.previewValue}
            >
              {it.value}
            </Text>
            {it.rag && chip ? (
              <View style={[styles.previewChip, { backgroundColor: chip.bg }]}>
                <Text
                  maxFontSizeMultiplier={MAX_FONT_SCALE}
                  style={[styles.previewChipText, { color: chip.fg }]}
                >
                  {it.rag.label}
                </Text>
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

export function DomainCard({
  rollup,
  userSexAtBirth,
  userAgeYears,
  onPress,
  onLogPress,
}: DomainCardProps): React.ReactElement {
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const styles = React.useMemo(
    () => makeStyles(theme, redesign, fontsLoaded),
    [theme, redesign, fontsLoaded],
  );
  const Icon = getDomainIcon(rollup.domainId);
  const name = getDomainName(rollup.domainId);

  // Sparkline scores (Increment 2) — computed once at top level so the
  // hook is unconditional; empty for non-instrument rollups. The card
  // shows the sparkline only when its honesty gate (≥2) is met AND the
  // instrument is chartable (scoreRange present — excludes ADAM).
  const sparkScores = useSparklineScores(
    rollup.kind === "instrument-domain" ? rollup.sessions : NO_SESSIONS,
  );

  const chevron = <ChevronRight color={redesign.ink3} size={18} />;

  // INSTRUMENT-DOMAIN — instrument session with interpretation pill.
  if (rollup.kind === "instrument-domain") {
    const scoreRange =
      INTERPRETATION_TABLE_V1.instruments[rollup.latestInstrumentId]?.scoreRange;
    const showSparkline = scoreRange != null && sparkScores.length >= 2;
    const lookup =
      rollup.latestScore == null
        ? null
        : lookupInterpretation({
            key: rollup.latestInstrumentId,
            score: rollup.latestScore,
            sexAtBirth: userSexAtBirth,
            ageYears: userAgeYears,
            kind: "instrument",
          });
    const tint = lookup ? pillTintForBand(redesign, lookup.band) : null;
    const pillText = lookup
      ? `${lookup.band.pill}${lookup.band.provisional ? "‡" : ""}`
      : rollup.latestScore == null
        ? "Check-in incomplete"
        : `Score ${rollup.latestScore}`;
    return (
      <Pressable
        testID={`dashboard_card_${rollup.domainId}`}
        accessibilityRole="button"
        accessibilityLabel={`${name} — open details`}
        onPress={onPress}
        style={styles.card}
      >
        <View style={styles.row}>
          <View style={styles.iconChip}>
            <Icon color={redesign.teal} size={18} />
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.spacer} />
          <View
            testID="dashboard_card_pill"
            style={[
              styles.pill,
              { backgroundColor: tint ? tint.bg : redesign.pillSoft },
            ]}
          >
            <Text
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              style={[
                styles.pillText,
                { color: tint ? tint.fg : redesign.ink2 },
              ]}
            >
              {pillText}
            </Text>
          </View>
          {chevron}
        </View>
        {lookup?.fallbackNote ? (
          <Text style={styles.caption}>{lookup.fallbackNote}</Text>
        ) : null}
        {lookup?.gentleNudge ? (
          <Text style={styles.caption}>
            Adding your birth year sharpens this comparison.
          </Text>
        ) : null}
        {showSparkline ? (
          <View style={styles.sparkWrap}>
            <MiniSparkline scores={sparkScores} scoreRange={scoreRange} />
            <Text style={styles.sparkMeta}>
              {formatLastCheckins(sparkScores.length)}
            </Text>
          </View>
        ) : null}
        {onLogPress != null ? (
          <Pressable
            testID={`dashboard_card_log_${rollup.domainId}`}
            accessibilityRole="button"
            accessibilityLabel={`New ${name} check-in`}
            onPress={onLogPress}
            hitSlop={8}
            style={styles.logBtn}
          >
            <Text
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              style={styles.logLabel}
            >
              New check-in
            </Text>
          </Pressable>
        ) : null}
      </Pressable>
    );
  }

  // SINGLE-DOMAIN — non-instrument observations (labs, vitals,
  // conditions, etc.). Raw values only in increment 1.
  if (rollup.kind === "single-domain") {
    const count = rollup.rows.length;
    const latest = rollup.rows[0];
    // Curated summary (redesign step-2 fix): count + last-updated date
    // only. The previous raw latest-value preview leaked intake answer
    // text onto the dashboard; full values live on the detail screen.
    const summary = formatDomainSummary(
      count,
      formatGroupHeader(dateKeyOf(latest.effective_at)),
    );
    // Derived BMI — shown only on the health_markers card when both
    // height and weight observations are present. The WHO category pill
    // comes from the versioned interpretation table (provisional → ‡, D23);
    // it is never synthesized here. Trend direction (≥2 points): plain arrow.
    const bmiResult =
      rollup.domainId === "health_markers"
        ? deriveBmi(rollup.rows)
        : null;
    const bmiTrend =
      bmiResult != null && rollup.domainId === "health_markers"
        ? deriveBmiTrend(rollup.rows)
        : [];
    // Trend arrow: compare last two points (ascending → last two).
    let trendArrow: string | null = null;
    if (bmiTrend.length >= 2) {
      const prev = bmiTrend[bmiTrend.length - 2]!.bmi;
      const curr = bmiTrend[bmiTrend.length - 1]!.bmi;
      if (curr > prev) trendArrow = "↑";
      else if (curr < prev) trendArrow = "↓";
      else trendArrow = "→";
    }
    // WHO BMI category (provisional → ‡). Versioned table, never render-time.
    const bmiBand =
      bmiResult != null
        ? lookupInterpretation({
            key: LOINC_BMI,
            score: bmiResult.bmi,
            sexAtBirth: userSexAtBirth,
            ageYears: userAgeYears,
            kind: "biomarker",
          })
        : null;
    const bmiTint = bmiBand ? pillTintForBand(redesign, bmiBand.band) : null;
    // Latest marker VALUES preview — health_markers only. markerPreviewItems is
    // numeric-only + sourced-flag (see its header), so no free-text leaks here
    // (the reason the old raw preview was removed, line ~191). Read-only.
    const previewItems =
      rollup.domainId === "health_markers"
        ? markerPreviewItems(rollup.rows, 3)
        : [];
    return (
      <Pressable
        testID={`dashboard_card_${rollup.domainId}`}
        accessibilityRole="button"
        accessibilityLabel={`${name} — open details`}
        onPress={onPress}
        style={styles.card}
      >
        <View style={styles.row}>
          <View style={styles.iconChip}>
            <Icon color={redesign.teal} size={18} />
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <View style={styles.spacer} />
          {bmiResult != null ? (
            <View style={styles.bmiCluster}>
              {bmiBand != null && bmiTint != null ? (
                <View
                  testID="dashboard_card_bmi_pill"
                  style={[styles.pill, { backgroundColor: bmiTint.bg }]}
                >
                  <Text
                    maxFontSizeMultiplier={MAX_FONT_SCALE}
                    style={[styles.pillText, { color: bmiTint.fg }]}
                  >
                    {bmiBand.band.pill}
                    {bmiBand.band.provisional ? "‡" : ""}
                  </Text>
                </View>
              ) : null}
              <Text testID="dashboard_card_bmi_value" style={styles.bmiValue}>
                BMI {bmiResult.bmi.toFixed(1)}
                {trendArrow != null ? ` ${trendArrow}` : ""}
              </Text>
            </View>
          ) : null}
          {chevron}
        </View>
        <Text style={styles.prompt}>{summary}</Text>
        <MarkerPreviewList
          items={previewItems}
          styles={styles}
          redesign={redesign}
        />
      </Pressable>
    );
  }

  // EMPTY-DOMAIN — cohort-relevant, no data yet. Educational prompt
  // (this is the mockup's "Your markers" card treatment).
  return (
    <Pressable
      testID={`dashboard_card_${rollup.domainId}`}
      accessibilityRole="button"
      accessibilityLabel={`${name} — start a check-in`}
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.row}>
        <View style={[styles.iconChip, styles.iconChipNeutral]}>
          <Icon color={redesign.ink2} size={18} />
        </View>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        <View style={styles.spacer} />
        {chevron}
      </View>
      <Text style={styles.prompt}>{getDomainPrompt(rollup.domainId)}</Text>
    </Pressable>
  );
}

function makeStyles(
  theme: ReturnType<typeof useTheme>["theme"],
  redesign: ReturnType<typeof useTheme>["redesign"],
  fontsLoaded: boolean,
) {
  const pillStyles = makePillStyles(theme, fontsLoaded);
  return StyleSheet.create({
    // Mockup .card: surface, 1px line border, r=18, soft slate shadow.
    card: {
      backgroundColor: redesign.surface,
      borderColor: redesign.line,
      borderWidth: 1,
      borderRadius: redesign.rCard,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.md,
      marginHorizontal: theme.spacing.space5,
      marginBottom: theme.spacing.space3,
      shadowColor: redesign.ink,
      shadowOpacity: 0.05,
      shadowRadius: 7,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.space3,
    },
    // Mockup .cicon: 32×32, r=10, teal on teal-wash.
    iconChip: {
      width: theme.spacing.xl,
      height: theme.spacing.xl,
      borderRadius: redesign.rChip,
      backgroundColor: redesign.tealWash,
      alignItems: "center",
      justifyContent: "center",
    },
    iconChipNeutral: {
      backgroundColor: redesign.pillSoft,
    },
    // Mockup .cname: display 600, 18px, ink, -.01em.
    name: {
      color: redesign.ink,
      fontSize: theme.typography.sizes.lg,
      letterSpacing: -0.18,
      flexShrink: 1,
      ...fontStyle("display", 600, fontsLoaded),
    },
    spacer: { flex: 1 },
    // Shared verdict-pill construction — see ./pill.ts.
    pill: pillStyles.pill,
    pillText: pillStyles.pillText,
    // Clinical-integrity captions (AUDIT-C fallback, birth-year nudge).
    caption: {
      color: redesign.ink3,
      fontSize: theme.typography.sizes.xs,
      fontStyle: "italic",
      marginTop: theme.spacing.sm,
      ...fontStyle("body", 400, fontsLoaded),
    },
    // Sparkline + meta (Increment 2) — mockup .dash-spark / .last.
    sparkWrap: {
      marginTop: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    sparkMeta: {
      color: redesign.ink3,
      fontSize: theme.typography.sizes.xs,
      ...fontStyle("body", 400, fontsLoaded),
    },
    // "New check-in" chip — teal-wash, teal-deep label. Surfaces logging
    // on populated cards (modern capture-everywhere pattern).
    logBtn: {
      marginTop: theme.spacing.sm,
      alignSelf: "flex-start",
      backgroundColor: redesign.tealWash,
      paddingHorizontal: theme.spacing.md,
      borderRadius: redesign.rChip,
      // 44px min touch target (WCAG 2.5.5 / iOS HIG).
      minHeight: 48,
      justifyContent: "center",
    },
    logLabel: {
      color: redesign.tealDeep,
      fontSize: theme.typography.sizes.sm,
      ...fontStyle("body", 600, fontsLoaded),
    },
    // Mockup markers-card prompt: 13.5px, ink-2, 11 top margin.
    prompt: {
      color: redesign.ink2,
      fontSize: 13.5,
      lineHeight: 13.5 * 1.45,
      marginTop: theme.spacing.space3 - 1,
      ...fontStyle("body", 400, fontsLoaded),
    },
    // Derived BMI inline value — shown in the health_markers card row
    // when both height + weight are present. Number only; no category
    // label (WHO bands are reviewer-gated).
    bmiValue: {
      color: redesign.ink2,
      fontSize: theme.typography.sizes.sm,
      fontVariant: ["tabular-nums"] as const,
      ...fontStyle("numbers", 500, fontsLoaded),
    },
    bmiCluster: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      flexShrink: 1,
    },
    // Latest marker VALUES preview (health_markers card) — a thin divider then
    // one [name … value · flag-chip] row per marker. Numeric values only.
    previewList: {
      marginTop: theme.spacing.space3 - 1,
      paddingTop: theme.spacing.sm,
      borderTopWidth: 1,
      borderTopColor: redesign.line,
      gap: theme.spacing.xs + 1,
    },
    previewRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    previewName: {
      flex: 1,
      color: redesign.ink2,
      fontSize: theme.typography.sizes.sm,
      ...fontStyle("body", 400, fontsLoaded),
    },
    previewValue: {
      color: redesign.ink,
      fontSize: theme.typography.sizes.sm,
      fontVariant: ["tabular-nums"] as const,
      ...fontStyle("numbers", 500, fontsLoaded),
    },
    previewChip: {
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
      borderRadius: redesign.rChip,
    },
    previewChipText: {
      fontSize: theme.typography.sizes.xs,
      ...fontStyle("body", 600, fontsLoaded),
    },
  });
}

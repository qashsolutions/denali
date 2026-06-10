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
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import {
  formatDomainSummary,
  getDomainIcon,
  getDomainName,
  getDomainPrompt,
} from "./displayMapping";
import type { TimelineCard } from "./grouping";
import { dateKeyOf, formatGroupHeader } from "./groupObservations";
import { lookupInterpretation } from "./interpretation/lookup";
import { INTERPRETATION_TABLE_V1 } from "./interpretation/tableV1";
import { formatLastCheckins } from "./interpretation/trendStrings";
import { makePillStyles, pillTintForBand } from "./pill";
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
}

export function DomainCard({
  rollup,
  userSexAtBirth,
  userAgeYears,
  onPress,
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
          {chevron}
        </View>
        <Text style={styles.prompt}>{summary}</Text>
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
    // Mockup markers-card prompt: 13.5px, ink-2, 11 top margin.
    prompt: {
      color: redesign.ink2,
      fontSize: 13.5,
      lineHeight: 13.5 * 1.45,
      marginTop: theme.spacing.space3 - 1,
      ...fontStyle("body", 400, fontsLoaded),
    },
  });
}

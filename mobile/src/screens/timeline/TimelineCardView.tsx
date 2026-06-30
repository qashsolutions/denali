/**
 * TimelineCardView — render one card from `groupByInstrumentSession`.
 *
 * Redesign step-2 skin ("Alpine clarity"): white r-18 surface cards on
 * paper, icon chips, display-face titles, and the shared verdict-pill
 * construction from ./pill.ts (teal-wash ok / neutral soft / amber-wash
 * watch / alarm-wash severe). CONTENT AND BEHAVIOR ARE UNCHANGED from
 * the pre-redesign card — clinical invariants:
 *
 *   - kind: "instrument-session"  → friendly name, plain headline (+ ‡
 *     when provisional), explanation string, band pill, Show/Hide
 *     details expand (per-item scores + Source line), two-line
 *     disclaimer (standing + ‡ legend).
 *   - kind: "single"              → friendly name, value, category pill,
 *     Details shows Source / clinical name / code-system reference.
 *
 * No coded data is hidden from EXPORT — Details is purely a visual
 * accordion for the user. Storage and any export path still see the
 * full DAL row.
 *
 * All theme tokens resolved via useTheme(); no hardcoded hex. All
 * testIDs preserved (timeline_card, timeline_card_pill,
 * timeline_card_details_toggle, timeline_card_disclaimer,
 * timeline_card_provisional_footnote).
 */

import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  type LucideIcon,
} from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ObservationRow, SexAtBirth } from "@/contracts";
import { getInstrumentById } from "@/onboarding/instruments";
import { formatMarkerValue } from "@/screens/markers/markerCatalog";
import { fontStyle, MAX_FONT_SCALE, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import {
  getCategoryIcon,
  getCategoryName,
  getInstrumentIcon,
  getInstrumentName,
  getSourceName,
  resolveSingleRowDisplay,
  STANDING_DISCLAIMER,
} from "./displayMapping";
import type { TimelineCard } from "./grouping";
import { parseObservationMetadata } from "./grouping";
import {
  computeAdamOutcome,
  lookupInterpretation,
} from "./interpretation/lookup";
import type { InterpretationBand } from "./interpretation/tableV1";
import { makePillStyles, pillTintForBand } from "./pill";

// ─── score computation ───────────────────────────────────────────────────

function computeInstrumentScore(
  instrumentId: string,
  items: ReadonlyArray<ObservationRow>,
): number | null {
  // ADAM is binary: convert items (sorted by itemNumber) into yes/no.
  if (instrumentId === "ADAM") {
    if (items.length !== 10) return null;
    const responses: Array<number | null> = items.map((r) =>
      r.value_num == null ? null : r.value_num >= 1 ? 1 : 0,
    );
    return computeAdamOutcome(responses);
  }
  // All other instruments: sum numeric values.
  let total = 0;
  for (const r of items) {
    if (r.value_num == null) return null;
    total += r.value_num;
  }
  return total;
}

/**
 * Response SCALE (min/max) for an instrument, read from its registry
 * definition's responseOptions. Sizes the per-item bars (a neutral
 * visual of the user's OWN answer — never a severity verdict). Returns
 * null for an unknown id or a degenerate scale, in which case the bar is
 * omitted and only the numeric value shows.
 */
function instrumentScale(
  instrumentId: string,
): { min: number; max: number } | null {
  const inst = getInstrumentById(instrumentId);
  if (inst == null || inst.responseOptions.length === 0) return null;
  let min = inst.responseOptions[0].value;
  let max = min;
  for (const o of inst.responseOptions) {
    if (o.value < min) min = o.value;
    if (o.value > max) max = o.value;
  }
  return max > min ? { min, max } : null;
}

// ─── instrument-session sub-renderer ─────────────────────────────────────

interface SessionCardProps {
  instrumentId: string;
  items: ReadonlyArray<ObservationRow>;
  effective_at: string;
  formattedDate: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  userSexAtBirth: SexAtBirth | null;
  showDisclaimer: boolean;
  /**
   * When provided, the WHOLE card navigates (drill-down to check-in history)
   * on press and the footer shows a "View past check-ins ›" cue instead of the
   * inline "Show details" expander (D30). Absent → byte-identical expand
   * behavior (every existing caller unchanged).
   */
  onPress?: () => void;
}

function InstrumentSessionCard({
  instrumentId,
  items,
  effective_at: _effective_at,
  formattedDate,
  isExpanded,
  onToggleExpand,
  userSexAtBirth,
  showDisclaimer,
  onPress,
}: SessionCardProps): React.ReactElement {
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const Icon: LucideIcon = getInstrumentIcon(instrumentId);
  const friendlyName = getInstrumentName(instrumentId);
  const score = computeInstrumentScore(instrumentId, items);
  const interp =
    score == null
      ? null
      : lookupInterpretation(instrumentId, score, userSexAtBirth);

  const styles = sessionStyles(theme, redesign, fontsLoaded);
  const tint =
    interp != null ? pillTintForBand(redesign, interp.band) : null;
  const band: InterpretationBand | null = interp?.band ?? null;

  const navigable = onPress != null;
  const Container: React.ElementType = navigable ? Pressable : View;
  const containerProps = navigable
    ? {
        onPress,
        accessibilityRole: "button" as const,
        accessibilityLabel: `${friendlyName}, ${band?.pill ?? "check-in"}. View past check-ins.`,
      }
    : {};

  return (
    <Container testID="timeline_card" style={styles.card} {...containerProps}>
      <View style={styles.headerRow}>
        <View style={styles.iconChip}>
          <Icon color={redesign.teal} size={18} />
        </View>
        <Text style={styles.titleText} numberOfLines={1}>
          {friendlyName}
        </Text>
      </View>
      <Text style={styles.dateText}>{formattedDate}</Text>

      {band != null ? (
        <>
          <Text style={styles.headline}>
            {band.headline}
            {band.provisional ? "‡" : ""}
          </Text>
          <Text style={styles.explanation}>{band.explanation}</Text>
        </>
      ) : (
        <Text style={styles.headline}>
          Score: {score == null ? "incomplete" : String(score)}
        </Text>
      )}

      {interp?.fallbackNote != null ? (
        <Text style={styles.fallbackNote}>{interp.fallbackNote}</Text>
      ) : null}

      <View style={styles.footerRow}>
        {band != null && tint != null ? (
          <View
            testID="timeline_card_pill"
            style={[styles.pill, { backgroundColor: tint.bg }]}
          >
            <Text
              maxFontSizeMultiplier={MAX_FONT_SCALE}
              style={[styles.pillText, { color: tint.fg }]}
            >
              {band.pill}
            </Text>
          </View>
        ) : (
          <View />
        )}
        {navigable ? (
          // Drill-down affordance — the card itself is the touch target, so
          // this is a non-interactive visual cue (no nested Pressable).
          <View style={styles.detailsButton} pointerEvents="none">
            <Text style={styles.detailsText}>View past check-ins</Text>
            <ChevronRight color={redesign.tealDeep} size={16} />
          </View>
        ) : (
          <Pressable
            testID="timeline_card_details_toggle"
            onPress={onToggleExpand}
            accessibilityRole="button"
            accessibilityLabel={isExpanded ? "Hide details" : "Show details"}
            style={styles.detailsButton}
          >
            <Text style={styles.detailsText}>
              {isExpanded ? "Hide details" : "Show details"}
            </Text>
            {isExpanded ? (
              <ChevronUp color={redesign.tealDeep} size={16} />
            ) : (
              <ChevronDown color={redesign.tealDeep} size={16} />
            )}
          </Pressable>
        )}
      </View>

      {!navigable && isExpanded ? (
        <SessionDetails
          instrumentId={instrumentId}
          items={items}
          userSexAtBirthKnown={userSexAtBirth != null}
        />
      ) : null}

      {showDisclaimer ? (
        <View style={styles.disclaimerRow}>
          <Text testID="timeline_card_disclaimer" style={styles.disclaimer}>
            {STANDING_DISCLAIMER}
          </Text>
          {band?.provisional ? (
            <Text testID="timeline_card_provisional_footnote" style={styles.footnote}>
              ‡ Interpretation pending clinical review.
            </Text>
          ) : null}
        </View>
      ) : null}
    </Container>
  );
}

// ─── instrument-session expanded body ────────────────────────────────────

interface SessionDetailsProps {
  instrumentId: string;
  items: ReadonlyArray<ObservationRow>;
  userSexAtBirthKnown: boolean;
}

function SessionDetails({
  instrumentId,
  items,
  userSexAtBirthKnown: _userSexAtBirthKnown,
}: SessionDetailsProps): React.ReactElement {
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const styles = sessionStyles(theme, redesign, fontsLoaded);
  // Derive source from the first item — all items in a session share a
  // source by construction (persistInstrument writes them uniformly).
  const firstSource = items.length > 0 ? items[0].source : null;
  // Per-item bar scale (neutral magnitude of the user's own answer — never
  // a severity color/verdict). Null → omit the bar, show value only.
  const scale = instrumentScale(instrumentId);
  return (
    <View style={styles.detailsBlock}>
      {items.map((row, idx) => {
        const meta = parseObservationMetadata(row);
        const label =
          meta.itemText != null && meta.itemText.length > 0
            ? meta.itemText
            : row.display;
        const num = row.value_num;
        const value = num != null ? String(num) : "—";
        const fillPct =
          scale != null && num != null
            ? Math.max(
                0,
                Math.min(1, (num - scale.min) / (scale.max - scale.min)),
              ) * 100
            : null;
        return (
          <View key={row.id} style={styles.itemRow}>
            <Text style={styles.itemNumber}>{idx + 1}.</Text>
            <Text style={styles.itemLabel} numberOfLines={2}>
              {label}
            </Text>
            {fillPct != null ? (
              <View style={styles.itemBarTrack}>
                <View
                  style={[styles.itemBarFill, { width: `${fillPct}%` }]}
                />
              </View>
            ) : null}
            <Text style={styles.itemValue}>{value}</Text>
          </View>
        );
      })}
      {firstSource != null ? (
        <Text style={styles.provenance}>
          Source: {getSourceName(firstSource)}
        </Text>
      ) : null}
    </View>
  );
}

// ─── single-row card ─────────────────────────────────────────────────────

interface SingleCardProps {
  row: ObservationRow;
  formattedDate: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  showDisclaimer: boolean;
  /**
   * When provided, the WHOLE card navigates (drill-down) on press and the
   * footer shows a "View history ›" affordance instead of the inline
   * "Show details" expander — the destination screen carries the detail.
   * Absent (default) → the card keeps its byte-identical expand behavior.
   */
  onPress?: () => void;
}

function SingleRowCard({
  row,
  formattedDate,
  isExpanded,
  onToggleExpand,
  showDisclaimer,
  onPress,
}: SingleCardProps): React.ReactElement {
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const styles = sessionStyles(theme, redesign, fontsLoaded);
  const display = resolveSingleRowDisplay({
    category: row.category,
    code_system: row.code_system,
    code: row.code,
    display: row.display,
  });
  const Icon: LucideIcon = getCategoryIcon(row.category);
  const value =
    row.value_num != null
      ? row.unit
        ? `${formatMarkerValue(row.code, row.value_num)} ${row.unit}`
        : formatMarkerValue(row.code, row.value_num)
      : row.value_text;

  const navigable = onPress != null;
  const Container: React.ElementType = navigable ? Pressable : View;
  const containerProps = navigable
    ? {
        onPress,
        accessibilityRole: "button" as const,
        accessibilityLabel: `${display.name}${value ? `, ${value}` : ""}. View history.`,
      }
    : {};

  return (
    <Container testID="timeline_card" style={styles.card} {...containerProps}>
      <View style={styles.headerRow}>
        <View style={styles.iconChip}>
          <Icon color={redesign.teal} size={18} />
        </View>
        <Text style={styles.titleText} numberOfLines={1}>
          {display.name}
        </Text>
      </View>
      <Text style={styles.dateText}>{formattedDate}</Text>
      {value != null && value !== "" ? (
        <Text style={styles.singleValue}>{value}</Text>
      ) : null}

      <View style={styles.footerRow}>
        <View
          testID="timeline_card_pill"
          style={[styles.pill, { backgroundColor: redesign.pillSoft }]}
        >
          <Text
            maxFontSizeMultiplier={MAX_FONT_SCALE}
            style={[styles.pillText, { color: redesign.ink2 }]}
          >
            {getCategoryName(row.category)}
          </Text>
        </View>
        {navigable ? (
          // Drill-down affordance — the card itself is the touch target, so
          // this is a non-interactive visual cue (no nested Pressable).
          <View style={styles.detailsButton} pointerEvents="none">
            <Text style={styles.detailsText}>View history</Text>
            <ChevronRight color={redesign.tealDeep} size={16} />
          </View>
        ) : (
          <Pressable
            testID="timeline_card_details_toggle"
            onPress={onToggleExpand}
            accessibilityRole="button"
            accessibilityLabel={isExpanded ? "Hide details" : "Show details"}
            style={styles.detailsButton}
          >
            <Text style={styles.detailsText}>
              {isExpanded ? "Hide details" : "Show details"}
            </Text>
            {isExpanded ? (
              <ChevronUp color={redesign.tealDeep} size={16} />
            ) : (
              <ChevronDown color={redesign.tealDeep} size={16} />
            )}
          </Pressable>
        )}
      </View>

      {!navigable && isExpanded ? (
        <View style={styles.detailsBlock}>
          <Text style={styles.provenance}>
            Source: {getSourceName(row.source)}
          </Text>
          {!display.isMapped && row.display.length > 0 ? (
            <Text style={styles.provenance}>
              Clinical name: {row.display}
            </Text>
          ) : null}
          {/* LOINC code is intentionally NOT shown — it's storage/export-only
              jargon. The plain-language name is the card title (or the
              "Clinical name" line above for unmapped codes). */}
        </View>
      ) : null}

      {showDisclaimer ? (
        <View style={styles.disclaimerRow}>
          <Text testID="timeline_card_disclaimer" style={styles.disclaimer}>
            {STANDING_DISCLAIMER}
          </Text>
        </View>
      ) : null}
    </Container>
  );
}

// ─── unified card view ───────────────────────────────────────────────────

export interface TimelineCardViewProps {
  card: TimelineCard;
  isExpanded: boolean;
  onToggleExpand: () => void;
  /** Date formatted in the screen using formatGroupHeader semantics. */
  formattedDate: string;
  /** User's sex_at_birth — feeds AUDIT-C's sex-dependent lookup. */
  userSexAtBirth: SexAtBirth | null;
  /**
   * Per-card disclaimer block (standing line + ‡ legend). Default true.
   * Screens that PIN the same two lines at screen level (DomainDetail)
   * pass false so the text doesn't show twice (2026-06-09 operator
   * review). Screens without a pinned strip (legacy timeline) keep the
   * default — the every-clinical-surface disclaimer rule holds either way.
   */
  showDisclaimer?: boolean;
  /**
   * When provided, the card navigates (drill-down) on press with a "View …›"
   * cue instead of the inline expander — single-row cards → "View history"
   * (D28), instrument-session cards → "View past check-ins" (D30). Absent →
   * byte-identical expand behavior.
   */
  onPress?: () => void;
}

export function TimelineCardView({
  card,
  isExpanded,
  onToggleExpand,
  formattedDate,
  userSexAtBirth,
  showDisclaimer = true,
  onPress,
}: TimelineCardViewProps): React.ReactElement {
  if (card.kind === "instrument-session") {
    return (
      <InstrumentSessionCard
        instrumentId={card.instrumentId}
        items={card.items}
        effective_at={card.effective_at}
        formattedDate={formattedDate}
        isExpanded={isExpanded}
        onToggleExpand={onToggleExpand}
        userSexAtBirth={userSexAtBirth}
        showDisclaimer={showDisclaimer}
        onPress={onPress}
      />
    );
  }
  return (
    <SingleRowCard
      row={card.row}
      formattedDate={formattedDate}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
      showDisclaimer={showDisclaimer}
      onPress={onPress}
    />
  );
}

// ─── styles ──────────────────────────────────────────────────────────────

function sessionStyles(
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
      padding: theme.spacing.md,
      marginHorizontal: theme.spacing.space5,
      marginBottom: theme.spacing.space3,
      gap: theme.spacing.xs,
      shadowColor: redesign.ink,
      shadowOpacity: 0.05,
      shadowRadius: 7,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    headerRow: {
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
    // Mockup .cname: display 600, 18px, ink, -.01em.
    titleText: {
      color: redesign.ink,
      fontSize: theme.typography.sizes.lg,
      letterSpacing: -0.18,
      flexShrink: 1,
      ...fontStyle("display", 600, fontsLoaded),
    },
    dateText: {
      color: redesign.ink3,
      fontSize: theme.typography.sizes.sm,
      ...fontStyle("body", 400, fontsLoaded),
    },
    headline: {
      color: redesign.ink,
      fontSize: theme.typography.sizes.base,
      lineHeight: theme.typography.sizes.base * 1.4,
      marginTop: theme.spacing.sm,
      ...fontStyle("body", 500, fontsLoaded),
    },
    explanation: {
      color: redesign.ink2,
      fontSize: theme.typography.sizes.sm,
      lineHeight: theme.typography.sizes.sm * 1.5,
      ...fontStyle("body", 400, fontsLoaded),
    },
    fallbackNote: {
      color: redesign.ink3,
      fontSize: theme.typography.sizes.xs,
      fontStyle: "italic",
      ...fontStyle("body", 400, fontsLoaded),
    },
    // Numeric values use the numbers role (Inter Tight, tabular).
    singleValue: {
      color: redesign.ink,
      fontSize: theme.typography.sizes.xl,
      marginTop: theme.spacing.sm,
      fontVariant: ["tabular-nums"],
      ...fontStyle("numbers", 600, fontsLoaded),
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: theme.spacing.sm,
    },
    // Shared verdict-pill construction — see ./pill.ts.
    pill: pillStyles.pill,
    pillText: pillStyles.pillText,
    detailsButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
    },
    // Interactive affordance — contrast-safe teal text (tealDeep rule).
    detailsText: {
      color: redesign.tealDeep,
      fontSize: theme.typography.sizes.sm,
      ...fontStyle("body", 500, fontsLoaded),
    },
    detailsBlock: {
      marginTop: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      borderTopColor: redesign.line,
      borderTopWidth: 1,
      gap: theme.spacing.xs,
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },
    itemNumber: {
      color: redesign.ink3,
      fontSize: theme.typography.sizes.sm,
      width: 20,
      ...fontStyle("body", 400, fontsLoaded),
    },
    itemLabel: {
      color: redesign.ink,
      fontSize: theme.typography.sizes.sm,
      flex: 1,
      ...fontStyle("body", 400, fontsLoaded),
    },
    // Neutral magnitude bar for the user's own answer (NOT a severity
    // color). Fill width = value within the instrument's response scale.
    itemBarTrack: {
      width: 44,
      height: 6,
      borderRadius: theme.radii.sm,
      backgroundColor: redesign.line2,
      overflow: "hidden",
      alignSelf: "center",
    },
    itemBarFill: {
      height: 6,
      borderRadius: theme.radii.sm,
      backgroundColor: redesign.tealDeep,
    },
    itemValue: {
      color: redesign.ink,
      fontSize: theme.typography.sizes.sm,
      minWidth: 14,
      textAlign: "right",
      fontVariant: ["tabular-nums"],
      ...fontStyle("numbers", 600, fontsLoaded),
    },
    provenance: {
      color: redesign.ink2,
      fontSize: theme.typography.sizes.sm,
      ...fontStyle("body", 400, fontsLoaded),
    },
    disclaimerRow: {
      marginTop: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      borderTopColor: redesign.line,
      borderTopWidth: 1,
      gap: theme.spacing.xs,
    },
    disclaimer: {
      color: redesign.ink3,
      fontSize: theme.typography.sizes.xs,
      fontStyle: "italic",
      ...fontStyle("body", 400, fontsLoaded),
    },
    footnote: {
      color: redesign.ink3,
      fontSize: theme.typography.sizes.xs,
      ...fontStyle("body", 400, fontsLoaded),
    },
  });
}

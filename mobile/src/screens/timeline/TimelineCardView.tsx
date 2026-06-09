/**
 * TimelineCardView — render one card from `groupByInstrumentSession`.
 *
 * Two variants in one component:
 *   - kind: "instrument-session"  → friendly name, plain headline,
 *     descriptive pill, optional Details (per-item list + raw codes
 *     + provenance). Standing disclaimer at the bottom.
 *   - kind: "single"              → friendly name (from displayMapping),
 *     value, source. Details shows raw code + clinical name + source.
 *
 * No coded data is hidden from EXPORT — Details is purely a visual
 * accordion for the user. Storage and any export path still see the
 * full DAL row.
 *
 * All theme tokens resolved via useTheme(); no hardcoded hex.
 */

import {
  ChevronDown,
  ChevronUp,
  type LucideIcon,
} from "lucide-react-native";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { ObservationRow, SexAtBirth } from "@/contracts";
import { fw } from "@/onboarding/fontWeight";
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
import type {
  BandId,
  InterpretationBand,
} from "./interpretation/tableV1";

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

// ─── band palette: stable id → calm tint (theme-token-friendly) ──────────

function pillTintFor(active: ReturnType<typeof useTheme>["active"], bandId: BandId): {
  bg: string;
  fg: string;
} {
  // Map band ids to existing theme tokens. The "calm palette" the operator
  // wants comes from the existing condition tokens — they're already
  // tuned for legibility on the warm reference background.
  switch (bandId) {
    case "negative":
    case "minimal":
    case "lower-normal":
    case "lower-risk":
      return { bg: active.bgTertiary, fg: active.textPrimary };
    case "higher-normal":
    case "mild":
      return { bg: active.bgSecondary, fg: active.accentPrimary };
    case "moderate":
    case "higher-risk":
      return { bg: active.bgSecondary, fg: active.warning ?? active.accentPrimary };
    case "moderately-severe":
    case "severe":
    case "likely-aud":
    case "positive":
      return { bg: active.bgSecondary, fg: active.error };
  }
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
}

function InstrumentSessionCard({
  instrumentId,
  items,
  effective_at: _effective_at,
  formattedDate,
  isExpanded,
  onToggleExpand,
  userSexAtBirth,
}: SessionCardProps): React.ReactElement {
  const { active, theme } = useTheme();
  const Icon: LucideIcon = getInstrumentIcon(instrumentId);
  const friendlyName = getInstrumentName(instrumentId);
  const score = computeInstrumentScore(instrumentId, items);
  const interp =
    score == null
      ? null
      : lookupInterpretation(instrumentId, score, userSexAtBirth);

  const styles = sessionStyles(active, theme);
  const tint =
    interp != null ? pillTintFor(active, interp.band.bandId) : null;
  const band: InterpretationBand | null = interp?.band ?? null;

  return (
    <View testID="timeline_card" style={styles.card}>
      <View style={styles.headerRow}>
        <Icon color={active.accentPrimary} size={20} />
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
            <Text style={[styles.pillText, { color: tint.fg }]}>
              {band.pill}
            </Text>
          </View>
        ) : (
          <View />
        )}
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
            <ChevronUp color={active.textSecondary} size={16} />
          ) : (
            <ChevronDown color={active.textSecondary} size={16} />
          )}
        </Pressable>
      </View>

      {isExpanded ? (
        <SessionDetails items={items} userSexAtBirthKnown={userSexAtBirth != null} />
      ) : null}

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
    </View>
  );
}

// ─── instrument-session expanded body ────────────────────────────────────

interface SessionDetailsProps {
  items: ReadonlyArray<ObservationRow>;
  userSexAtBirthKnown: boolean;
}

function SessionDetails({
  items,
  userSexAtBirthKnown: _userSexAtBirthKnown,
}: SessionDetailsProps): React.ReactElement {
  const { active, theme } = useTheme();
  const styles = sessionStyles(active, theme);
  // Derive source from the first item — all items in a session share a
  // source by construction (persistInstrument writes them uniformly).
  const firstSource = items.length > 0 ? items[0].source : null;
  return (
    <View style={styles.detailsBlock}>
      {items.map((row, idx) => {
        const meta = parseObservationMetadata(row);
        const label =
          meta.itemText != null && meta.itemText.length > 0
            ? meta.itemText
            : row.display;
        const value = row.value_num != null ? String(row.value_num) : "—";
        return (
          <View key={row.id} style={styles.itemRow}>
            <Text style={styles.itemNumber}>{idx + 1}.</Text>
            <Text style={styles.itemLabel} numberOfLines={2}>
              {label}
            </Text>
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
}

function SingleRowCard({
  row,
  formattedDate,
  isExpanded,
  onToggleExpand,
}: SingleCardProps): React.ReactElement {
  const { active, theme } = useTheme();
  const styles = sessionStyles(active, theme);
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
        ? `${row.value_num} ${row.unit}`
        : String(row.value_num)
      : row.value_text;

  return (
    <View testID="timeline_card" style={styles.card}>
      <View style={styles.headerRow}>
        <Icon color={active.accentPrimary} size={20} />
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
          style={[styles.pill, { backgroundColor: active.bgTertiary }]}
        >
          <Text style={[styles.pillText, { color: active.textPrimary }]}>
            {getCategoryName(row.category)}
          </Text>
        </View>
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
            <ChevronUp color={active.textSecondary} size={16} />
          ) : (
            <ChevronDown color={active.textSecondary} size={16} />
          )}
        </Pressable>
      </View>

      {isExpanded ? (
        <View style={styles.detailsBlock}>
          <Text style={styles.provenance}>
            Source: {getSourceName(row.source)}
          </Text>
          {!display.isMapped && row.display.length > 0 ? (
            <Text style={styles.provenance}>
              Clinical name: {row.display}
            </Text>
          ) : null}
          <Text style={styles.provenance}>
            Reference: {row.code_system} {row.code}
          </Text>
        </View>
      ) : null}

      <View style={styles.disclaimerRow}>
        <Text testID="timeline_card_disclaimer" style={styles.disclaimer}>
          {STANDING_DISCLAIMER}
        </Text>
      </View>
    </View>
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
}

export function TimelineCardView({
  card,
  isExpanded,
  onToggleExpand,
  formattedDate,
  userSexAtBirth,
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
      />
    );
  }
  return (
    <SingleRowCard
      row={card.row}
      formattedDate={formattedDate}
      isExpanded={isExpanded}
      onToggleExpand={onToggleExpand}
    />
  );
}

// ─── styles ──────────────────────────────────────────────────────────────

function sessionStyles(
  active: ReturnType<typeof useTheme>["active"],
  theme: ReturnType<typeof useTheme>["theme"],
) {
  return StyleSheet.create({
    card: {
      backgroundColor: active.bgPrimary,
      borderColor: active.border,
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: theme.radii.md,
      padding: theme.spacing.lg,
      marginHorizontal: theme.spacing.lg,
      marginVertical: theme.spacing.sm,
      gap: theme.spacing.xs,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.sm,
    },
    titleText: {
      color: active.textPrimary,
      fontFamily: theme.typography.fonts.serif,
      fontSize: theme.typography.sizes.xl,
      fontWeight: fw(theme.typography.weights.semibold),
      flexShrink: 1,
    },
    dateText: {
      color: active.textSecondary,
      fontFamily: theme.typography.fonts.sans,
      fontSize: theme.typography.sizes.sm,
    },
    headline: {
      color: active.textPrimary,
      fontFamily: theme.typography.fonts.sans,
      fontSize: theme.typography.sizes.base,
      fontWeight: fw(theme.typography.weights.medium),
      marginTop: theme.spacing.sm,
    },
    explanation: {
      color: active.textSecondary,
      fontFamily: theme.typography.fonts.sans,
      fontSize: theme.typography.sizes.sm,
    },
    fallbackNote: {
      color: active.textMuted,
      fontFamily: theme.typography.fonts.sans,
      fontSize: theme.typography.sizes.xs,
      fontStyle: "italic",
    },
    singleValue: {
      color: active.textPrimary,
      fontFamily: theme.typography.fonts.mono,
      fontSize: theme.typography.sizes.xl,
      marginTop: theme.spacing.sm,
    },
    footerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: theme.spacing.sm,
    },
    pill: {
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      borderRadius: theme.radii.full ?? 999,
    },
    pillText: {
      fontFamily: theme.typography.fonts.sans,
      fontSize: theme.typography.sizes.sm,
      fontWeight: fw(theme.typography.weights.medium),
    },
    detailsButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: theme.spacing.xs,
      paddingVertical: theme.spacing.xs,
      paddingHorizontal: theme.spacing.sm,
    },
    detailsText: {
      color: active.textSecondary,
      fontFamily: theme.typography.fonts.sans,
      fontSize: theme.typography.sizes.sm,
    },
    detailsBlock: {
      marginTop: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      borderTopColor: active.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: theme.spacing.xs,
    },
    itemRow: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: theme.spacing.sm,
    },
    itemNumber: {
      color: active.textMuted,
      fontFamily: theme.typography.fonts.sans,
      fontSize: theme.typography.sizes.sm,
      width: 20,
    },
    itemLabel: {
      color: active.textPrimary,
      fontFamily: theme.typography.fonts.sans,
      fontSize: theme.typography.sizes.sm,
      flex: 1,
    },
    itemValue: {
      color: active.textPrimary,
      fontFamily: theme.typography.fonts.mono,
      fontSize: theme.typography.sizes.sm,
    },
    provenance: {
      color: active.textSecondary,
      fontFamily: theme.typography.fonts.sans,
      fontSize: theme.typography.sizes.sm,
    },
    disclaimerRow: {
      marginTop: theme.spacing.sm,
      paddingTop: theme.spacing.sm,
      borderTopColor: active.border,
      borderTopWidth: StyleSheet.hairlineWidth,
      gap: theme.spacing.xs,
    },
    disclaimer: {
      color: active.textMuted,
      fontFamily: theme.typography.fonts.sans,
      fontSize: theme.typography.sizes.xs,
      fontStyle: "italic",
    },
    footnote: {
      color: active.textMuted,
      fontFamily: theme.typography.fonts.sans,
      fontSize: theme.typography.sizes.xs,
    },
  });
}

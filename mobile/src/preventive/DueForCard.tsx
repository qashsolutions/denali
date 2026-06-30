/**
 * DueForCard — the "Due for…" dashboard card (USPSTF preventive layer).
 *
 * Renders the screenings that apply to the user's age + sex_at_birth and are
 * due (from `dueScreenings`), each with the standardized cadence + when it was
 * last logged + the operator-locked referral verb. EXPLAINS, never directs —
 * it states the standardized cadence and points to the user's doctor; it never
 * tells the user to get a test ("Get screened" / "Schedule…" are forbidden).
 *
 * Renders NOTHING when there are no due items — the production state today,
 * since `PREVENTIVE_RECOMMENDATIONS` ships empty until the reviewer/USPSTF set
 * lands. The dashboard's standing disclaimer covers this card.
 *
 * Colors/radii/spacing from useTheme() — no hardcoded values.
 */

import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { fontStyle, MAX_FONT_SCALE, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import { formatDueMeta } from "./dueForFormat";
import type { DueScreening } from "./uspstf";

export interface DueForCardProps {
  items: ReadonlyArray<DueScreening>;
}

export function DueForCard({
  items,
}: DueForCardProps): React.ReactElement | null {
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        card: {
          marginHorizontal: theme.spacing.space5,
          backgroundColor: redesign.surface,
          borderColor: redesign.line,
          borderWidth: 1,
          borderRadius: redesign.rCard,
          padding: theme.spacing.md,
          gap: theme.spacing.xs,
          shadowColor: redesign.ink,
          shadowOpacity: 0.05,
          shadowRadius: 7,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
        },
        itemDivider: {
          marginTop: theme.spacing.sm,
          paddingTop: theme.spacing.sm,
          borderTopWidth: 1,
          borderTopColor: redesign.line2,
        },
        title: {
          color: redesign.ink,
          fontSize: theme.typography.sizes.base,
          ...fontStyle("body", 600, fontsLoaded),
        },
        summary: {
          color: redesign.ink2,
          fontSize: theme.typography.sizes.sm,
          lineHeight: theme.typography.sizes.sm * 1.45,
          marginTop: 2,
          ...fontStyle("body", 400, fontsLoaded),
        },
        meta: {
          color: redesign.ink3,
          fontSize: theme.typography.sizes.xs,
          marginTop: theme.spacing.xs,
          ...fontStyle("body", 400, fontsLoaded),
        },
        referral: {
          color: redesign.ink2,
          fontSize: theme.typography.sizes.sm,
          marginTop: theme.spacing.sm,
          ...fontStyle("body", 500, fontsLoaded),
        },
      }),
    [theme, redesign, fontsLoaded],
  );

  if (items.length === 0) return null;

  return (
    <View testID="dashboard_due_for_card" style={styles.card}>
      {items.map((d, i) => (
        <View
          key={d.rec.id}
          testID={`due_for_item_${d.rec.id}`}
          style={i > 0 ? styles.itemDivider : undefined}
        >
          <Text style={styles.title} maxFontSizeMultiplier={MAX_FONT_SCALE}>
            {d.rec.title}
            {d.rec.provisional ? "‡" : ""}
          </Text>
          <Text style={styles.summary}>{d.rec.summary}</Text>
          <Text style={styles.meta}>{formatDueMeta(d)}</Text>
        </View>
      ))}
      {/* Operator-locked referral verb (matches interpretation tableV1) —
          the only soft pointer; never a directive to get a test. */}
      <Text style={styles.referral}>Talking with your doctor could help.</Text>
    </View>
  );
}

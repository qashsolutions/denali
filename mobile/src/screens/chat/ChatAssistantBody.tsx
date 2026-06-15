/**
 * ChatAssistantBody — assistant bubble contents: markdown + summary/details.
 *
 * Renders the lead block (summary) always via ChatMarkdown, and collapses
 * the rest behind a "Show details" toggle. Pairs with the backend
 * MOBILE_CHAT_BREVITY nudge (model leads with a 1–2 sentence answer, so the
 * summary is real, not arbitrary truncation). When there's no second block,
 * `splitSummaryDetails` returns empty details and no toggle renders.
 *
 * The outer bubble container lives in ChatScreen (single source of bubble
 * styling); this component is the bubble's inner body so it can own the
 * collapse state.
 */

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import { ChatMarkdown } from "./ChatMarkdown";
import { splitSummaryDetails } from "./markdown";

export function ChatAssistantBody({
  content,
}: {
  content: string;
}): React.ReactElement {
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const [expanded, setExpanded] = React.useState(false);

  const { summary, details } = splitSummaryDetails(content);
  const hasDetails = details.length > 0;

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        detailsWrap: { marginTop: theme.spacing.sm },
        toggle: {
          marginTop: theme.spacing.sm,
          alignSelf: "flex-start",
          // 44px min touch target (WCAG 2.5.5 / iOS HIG) — matters for the
          // 45+ audience. hitSlop below adds margin without bloating layout.
          minHeight: 44,
          justifyContent: "center",
        },
        toggleText: {
          color: redesign.teal,
          fontSize: theme.typography.sizes.sm,
          ...fontStyle("body", 600, fontsLoaded),
        },
      }),
    [theme, redesign, fontsLoaded],
  );

  return (
    <View>
      <ChatMarkdown content={summary} />

      {hasDetails && expanded && (
        <View style={styles.detailsWrap}>
          <ChatMarkdown content={details} />
        </View>
      )}

      {hasDetails && (
        <Pressable
          onPress={() => setExpanded((prev) => !prev)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Hide details" : "Show details"}
          accessibilityState={{ expanded }}
          testID="chat_details_toggle"
          hitSlop={8}
          style={styles.toggle}
        >
          <Text style={styles.toggleText}>
            {expanded ? "Hide details" : "Show details"}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

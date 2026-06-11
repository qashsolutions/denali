/**
 * ChatMarkdown — renders the chat markdown subset into RN <Text>/<View>.
 *
 * Pairs with the pure tokenizer in `./markdown.ts`. Bold/italic become
 * nested <Text> (which inherit color/size from the block), lists render
 * with a drawn bullet dot or a numeric marker — no literal bullet glyph in
 * source, no markdown library. Unknown markup falls through as literal text.
 */

import React from "react";
import { StyleSheet, Text, View, type TextStyle } from "react-native";

import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import { parseMarkdown, type Block, type InlineSpan } from "./markdown";

type ThemeShape = ReturnType<typeof useTheme>["theme"];

function makeStyles(
  theme: ThemeShape,
  ink: string,
  base: number,
  fontsLoaded: boolean,
) {
  return StyleSheet.create({
    block: { marginTop: theme.spacing.sm },
    firstBlock: { marginTop: 0 },
    text: {
      color: ink,
      fontSize: base,
      lineHeight: base * 1.45,
      ...fontStyle("body", 400, fontsLoaded),
    },
    heading: {
      color: ink,
      fontSize: base,
      lineHeight: base * 1.4,
      ...fontStyle("body", 700, fontsLoaded),
    },
    listRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 2 },
    bulletDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: ink,
      marginTop: base * 0.6,
      marginRight: theme.spacing.sm,
    },
    numberMarker: {
      color: ink,
      fontSize: base,
      lineHeight: base * 1.45,
      marginRight: theme.spacing.sm,
      ...fontStyle("body", 600, fontsLoaded),
    },
    listItemText: { flex: 1 },
  });
}

type MarkdownStyles = ReturnType<typeof makeStyles>;

function renderSpans(
  spans: InlineSpan[],
  boldStyle: TextStyle,
  italicStyle: TextStyle,
): React.ReactNode {
  return spans.map((s, i) => (
    <Text
      key={i}
      style={s.bold ? boldStyle : s.italic ? italicStyle : undefined}
    >
      {s.text}
    </Text>
  ));
}

function renderBlock(
  block: Block,
  idx: number,
  styles: MarkdownStyles,
  bold: TextStyle,
  italic: TextStyle,
): React.ReactNode {
  const blockStyle = idx === 0 ? styles.firstBlock : styles.block;
  switch (block.type) {
    case "heading":
      return (
        <Text key={idx} style={[styles.heading, blockStyle]}>
          {renderSpans(block.spans, bold, italic)}
        </Text>
      );
    case "paragraph":
      return (
        <Text key={idx} style={[styles.text, blockStyle]}>
          {renderSpans(block.spans, bold, italic)}
        </Text>
      );
    case "bullet":
      return (
        <View key={idx} style={blockStyle}>
          {block.items.map((item, j) => (
            <View key={j} style={styles.listRow}>
              <View style={styles.bulletDot} />
              <Text style={[styles.text, styles.listItemText]}>
                {renderSpans(item, bold, italic)}
              </Text>
            </View>
          ))}
        </View>
      );
    case "numbered":
      return (
        <View key={idx} style={blockStyle}>
          {block.items.map((item, j) => (
            <View key={j} style={styles.listRow}>
              <Text style={styles.numberMarker}>{j + 1}.</Text>
              <Text style={[styles.text, styles.listItemText]}>
                {renderSpans(item, bold, italic)}
              </Text>
            </View>
          ))}
        </View>
      );
    default:
      return null;
  }
}

interface ChatMarkdownProps {
  content: string;
  /** Text color; defaults to the redesign ink (assistant bubble). */
  color?: string;
}

export function ChatMarkdown({
  content,
  color,
}: ChatMarkdownProps): React.ReactElement {
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const ink = color ?? redesign.ink;
  const base = theme.typography.sizes.base;

  const styles = React.useMemo(
    () => makeStyles(theme, ink, base, fontsLoaded),
    [theme, ink, base, fontsLoaded],
  );
  const boldStyle = React.useMemo<TextStyle>(
    () => fontStyle("body", 700, fontsLoaded),
    [fontsLoaded],
  );
  const italicStyle: TextStyle = { fontStyle: "italic" };

  return (
    <View>
      {parseMarkdown(content).map((b, i) =>
        renderBlock(b, i, styles, boldStyle, italicStyle),
      )}
    </View>
  );
}

/**
 * ChatScreen — Phase 1 mobile (Wave 3 / mobile-app-shell Pass 2).
 *
 * Uses `ApiClient.chat({ noPersist: true, history, content })` to stream
 * tokens from the backend's mobile no-persist branch
 * (`app/src/app/api/chat/route.ts:151`, D9 gate enforced by the
 * `no-persist.test.ts` query()-spy regression).
 *
 * D11 — Phase 1 mobile chat is EPHEMERAL. Session-scoped: cleared on
 * sign-out / app close. No server-side persistence (D9). No on-device
 * persistence either — Pass 2 intentionally does NOT write to the local
 * `chat_messages` table. Persistent local chat history is deferred to a
 * later phase.
 *
 * UI via `useTheme()` — bubbles use `theme.colors.chat.{light,dark}`
 * (Wave-1-amended Theme).
 *
 * Contracts consumed: ApiClient, Theme.
 */

import React from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useApiClient } from "@/auth";
import { PressableScale } from "@/components/PressableScale";
import { Crisis988Modal } from "@/onboarding/Crisis988Modal";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import { ChatAssistantBody } from "./chat/ChatAssistantBody";
import { detectCrisisLanguage } from "./chat/crisisDetection";
import { plainSummaryForSpeech } from "./chat/markdown";
import {
  appendAssistantDelta,
  appendUserTurn,
  clearHistory,
  stripSuggestionsBlock,
  type ChatTurn,
} from "./chat/chatHistory";
import { STANDING_DISCLAIMER } from "./timeline/displayMapping";

/** Tappable first-prompts for the empty state — a blank box is paralyzing for
 *  a 45+ audience. Plain-English, Medicare-relevant, no clinical claims. */
const SUGGESTED_PROMPTS: ReadonlyArray<string> = [
  "What does my latest lab result mean?",
  "Am I due for any screenings?",
  "Help me understand my last visit summary.",
];

export function ChatScreen(): React.ReactElement {
  const api = useApiClient();
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();
  const insets = useSafeAreaInsets();

  const [history, setHistory] = React.useState<ChatTurn[]>([]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [crisisVisible, setCrisisVisible] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);
  // Last content sent — for the error "Try again" without retyping.
  const lastSentRef = React.useRef<string>("");

  // Clear history when the user signs out — D11 (session-scoped chat).
  React.useEffect(() => {
    const unsubscribe = api.onSignInRequired(() => {
      setHistory(clearHistory());
      setError(null);
      setStreaming(false);
      abortRef.current?.abort();
    });
    return unsubscribe;
  }, [api]);

  // Cancel any in-flight stream on unmount.
  React.useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  // Core streaming request — shared by a fresh send and the error retry.
  // Announces "thinking" then (on done) the reply for screen readers; the live
  // delta loop is otherwise silent to TalkBack/VoiceOver.
  const streamReply = React.useCallback(
    async (content: string, historyToSend: ChatTurn[]) => {
      setError(null);
      setStreaming(true);
      AccessibilityInfo.announceForAccessibility("Denali is thinking");
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        // The server requires `noPersist: true` (literal) per the contract
        // and the D9 defensive runtime check.
        const stream = api.chat(
          { content, history: historyToSend, noPersist: true },
          { signal: controller.signal },
        );
        let assistantText = "";
        for await (const event of stream) {
          if (event.type === "delta") {
            assistantText += event.text;
            setHistory((h) => appendAssistantDelta(h, event.text));
          } else if (event.type === "done") {
            const spoken = plainSummaryForSpeech(
              stripSuggestionsBlock(assistantText),
            );
            if (spoken.length > 0) {
              AccessibilityInfo.announceForAccessibility(spoken);
            }
            break;
          } else if (event.type === "error") {
            // D11: generic message — no PHI from the body. Log status-only.
            console.warn("[Chat] server error event:", event.message);
            setError("Something went wrong. Please try again.");
            break;
          }
        }
      } catch (err) {
        console.warn("[Chat] stream failed", err);
        setError("Something went wrong. Please try again.");
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [api],
  );

  const sendMessage = React.useCallback(
    (raw: string) => {
      const content = raw.trim();
      if (content.length === 0 || streaming) return;
      // Deterministic crisis surface: self-harm / suicidal ideation shows the
      // 988 modal and is NOT sent to the model (Phase-1 invariant 1; mirrors
      // the PHQ-9 item-9 path). No LLM round-trip, no bubble, nothing logged.
      if (detectCrisisLanguage(content)) {
        Keyboard.dismiss();
        setInput("");
        setCrisisVisible(true);
        return;
      }
      Keyboard.dismiss();
      const nextHistory = appendUserTurn(history, content);
      setHistory(nextHistory);
      setInput("");
      lastSentRef.current = content;
      void streamReply(content, nextHistory);
    },
    [history, streaming, streamReply],
  );

  const onSend = React.useCallback(() => {
    sendMessage(input);
  }, [sendMessage, input]);

  // Error retry: re-request the reply for the last message — no retyping and
  // no re-appended user turn (it's already in history).
  const onRetry = React.useCallback(() => {
    if (lastSentRef.current.length === 0 || streaming) return;
    // chat-1: drop any PARTIAL assistant turn the failed attempt left behind,
    // so the retry starts a fresh reply instead of appending deltas onto the
    // half-streamed one. The trailing user turn is preserved as the context.
    const base =
      history.length > 0 && history[history.length - 1]?.role === "assistant"
        ? history.slice(0, -1)
        : history;
    setHistory(base);
    void streamReply(lastSentRef.current, base);
  }, [streamReply, history, streaming]);

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        screen: { flex: 1, backgroundColor: redesign.paper },
        // Mockup .scr-title: Bricolage display, ink.
        title: {
          color: redesign.ink,
          fontSize: theme.typography.sizes["2xl"],
          letterSpacing: -0.5,
          paddingHorizontal: theme.spacing.space5,
          paddingTop: insets.top + theme.spacing.space5,
          paddingBottom: theme.spacing.sm,
          ...fontStyle("display", 700, fontsLoaded),
        },
        // Standing clinical disclaimer — chat is the most advice-prone surface,
        // so it carries the same boundary every clinical card does. ink3 is
        // WCAG-AA on paper after the contrast fix (see tokens AA matrix).
        disclaimer: {
          color: redesign.ink3,
          fontSize: theme.typography.sizes.xs,
          paddingHorizontal: theme.spacing.space5,
          paddingBottom: theme.spacing.sm,
          ...fontStyle("body", 400, fontsLoaded),
        },
        listContent: {
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        },
        // User bubble: teal fill, white text. Assistant: white surface
        // card with a hairline (so it reads on paper), ink text.
        bubbleUser: {
          alignSelf: "flex-end",
          backgroundColor: redesign.tealDeep,
          borderRadius: redesign.rChip + 4,
          padding: theme.spacing.md,
          maxWidth: "85%",
        },
        bubbleAssistant: {
          alignSelf: "flex-start",
          backgroundColor: redesign.surface,
          borderColor: redesign.line,
          borderWidth: 1,
          borderRadius: redesign.rChip + 4,
          padding: theme.spacing.md,
          maxWidth: "85%",
        },
        bubbleTextUser: {
          color: redesign.surface,
          fontSize: theme.typography.sizes.base,
          lineHeight: theme.typography.sizes.base * 1.45,
          ...fontStyle("body", 400, fontsLoaded),
        },
        // Assistant text is rendered by ChatMarkdown (which builds its own
        // ink/size/line-height styles), so no bubbleTextAssistant here.
        empty: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: theme.spacing.lg,
        },
        emptyText: {
          color: redesign.ink2,
          fontSize: theme.typography.sizes.base,
          lineHeight: theme.typography.sizes.base * 1.5,
          textAlign: "center",
          ...fontStyle("body", 400, fontsLoaded),
        },
        inputBar: {
          flexDirection: "row",
          alignItems: "flex-end",
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          borderTopColor: redesign.line,
          borderTopWidth: 1,
          backgroundColor: redesign.paper,
        },
        input: {
          flex: 1,
          backgroundColor: redesign.surface,
          color: redesign.ink,
          borderColor: redesign.line,
          borderWidth: 1,
          borderRadius: theme.radii.lg,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          fontSize: theme.typography.sizes.base,
          minHeight: 48,
          maxHeight: 120,
          ...fontStyle("body", 400, fontsLoaded),
        },
        sendBtn: {
          backgroundColor: redesign.tealDeep,
          borderRadius: theme.radii.lg,
          paddingHorizontal: theme.spacing.md,
          minHeight: 48,
          alignItems: "center",
          justifyContent: "center",
        },
        sendBtnDisabled: { opacity: 0.5 },
        sendText: {
          color: redesign.surface,
          fontSize: theme.typography.sizes.base,
          ...fontStyle("body", 600, fontsLoaded),
        },
        errorBanner: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: theme.spacing.sm,
          backgroundColor: redesign.surface,
          borderColor: redesign.alarm,
          borderWidth: 1,
          borderRadius: theme.radii.lg,
          marginHorizontal: theme.spacing.md,
          marginBottom: theme.spacing.sm,
          padding: theme.spacing.md,
        },
        errorText: {
          flexShrink: 1,
          color: redesign.ink,
          fontSize: theme.typography.sizes.sm,
          ...fontStyle("body", 400, fontsLoaded),
        },
        // chat-2: the retry control needs its own ≥48px tap target (D35) — the
        // bare text + hitSlop only reached ~36px. minHeight + horizontal padding
        // matches the suggestion-chip / send-button targets.
        retryButton: {
          minHeight: 48,
          justifyContent: "center",
          paddingHorizontal: theme.spacing.sm,
        },
        retryText: {
          color: redesign.tealDeep,
          fontSize: theme.typography.sizes.sm,
          ...fontStyle("body", 600, fontsLoaded),
        },
        // Tappable first-prompts in the empty state.
        suggestions: {
          marginTop: theme.spacing.lg,
          gap: theme.spacing.sm,
          alignSelf: "stretch",
        },
        suggestionChip: {
          borderColor: redesign.line,
          borderWidth: 1,
          borderRadius: redesign.rCard,
          backgroundColor: redesign.surface,
          paddingVertical: theme.spacing.md,
          paddingHorizontal: theme.spacing.md,
          minHeight: 48,
          justifyContent: "center",
        },
        suggestionText: {
          color: redesign.tealDeep,
          fontSize: theme.typography.sizes.base,
          ...fontStyle("body", 500, fontsLoaded),
        },
        // "Denali is thinking…" placeholder while streaming, before the first
        // delta — a visible in-progress cue (the SR cue is announced).
        thinking: {
          color: redesign.ink3,
          fontSize: theme.typography.sizes.sm,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          ...fontStyle("body", 400, fontsLoaded),
          fontStyle: "italic",
        },
      }),
    [theme, redesign, fontsLoaded, insets.top],
  );

  const renderItem: ListRenderItem<ChatTurn> = ({ item }) => {
    if (item.role === "user") {
      // User turns render verbatim as plain text.
      return (
        <View style={styles.bubbleUser}>
          <Text style={styles.bubbleTextUser}>{item.content}</Text>
        </View>
      );
    }
    // Assistant turns: strip the [SUGGESTIONS] protocol block (mobile has
    // no chip UI), then render markdown with a summary + collapsible
    // details (ChatAssistantBody owns the collapse state).
    return (
      <View style={styles.bubbleAssistant}>
        <ChatAssistantBody content={stripSuggestionsBlock(item.content)} />
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <Text style={styles.title}>Ask Denali</Text>
      <Text testID="chat_disclaimer" style={styles.disclaimer}>
        {STANDING_DISCLAIMER}
      </Text>
      {history.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Ask Denali anything about your health. Your conversation is not
            stored on our servers.
          </Text>
          <View style={styles.suggestions}>
            {SUGGESTED_PROMPTS.map((p) => (
              <Pressable
                key={p}
                testID="chat_suggested_prompt"
                accessibilityRole="button"
                accessibilityLabel={p}
                disabled={streaming}
                onPress={() => sendMessage(p)}
                style={styles.suggestionChip}
              >
                <Text style={styles.suggestionText}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={history}
          keyExtractor={(_item, idx) => String(idx)}
          renderItem={renderItem}
          ListFooterComponent={
            streaming && history[history.length - 1]?.role === "user" ? (
              <Text testID="chat_thinking" style={styles.thinking}>
                Denali is thinking…
              </Text>
            ) : null
          }
        />
      )}
      {error != null && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable
            testID="chat_retry"
            accessibilityRole="button"
            accessibilityLabel="Try again"
            disabled={streaming}
            onPress={onRetry}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      )}
      <View style={styles.inputBar}>
        <TextInput
          accessibilityLabel="Chat message"
          editable={!streaming}
          multiline
          onChangeText={setInput}
          placeholder="Type a message…"
          placeholderTextColor={redesign.ink3}
          style={styles.input}
          value={input}
        />
        <PressableScale
          haptic
          accessibilityRole="button"
          accessibilityLabel={streaming ? "Sending message" : "Send message"}
          accessibilityState={{
            busy: streaming,
            disabled: streaming || input.trim().length === 0,
          }}
          disabled={streaming || input.trim().length === 0}
          onPress={onSend}
          style={[
            styles.sendBtn,
            (streaming || input.trim().length === 0) && styles.sendBtnDisabled,
          ]}
        >
          {streaming ? (
            <ActivityIndicator color={redesign.surface} />
          ) : (
            <Text style={styles.sendText}>Send</Text>
          )}
        </PressableScale>
      </View>
      <Crisis988Modal
        visible={crisisVisible}
        onAcknowledge={() => setCrisisVisible(false)}
      />
    </KeyboardAvoidingView>
  );
}

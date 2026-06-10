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

import { useApiClient } from "@/auth";
import { fontStyle, useFontsLoaded } from "@/theme/fonts";
import { useTheme } from "@/theme/useTheme";

import {
  appendAssistantDelta,
  appendUserTurn,
  clearHistory,
  stripSuggestionsBlock,
  type ChatTurn,
} from "./chat/chatHistory";

export function ChatScreen(): React.ReactElement {
  const api = useApiClient();
  const { theme, redesign } = useTheme();
  const fontsLoaded = useFontsLoaded();

  const [history, setHistory] = React.useState<ChatTurn[]>([]);
  const [input, setInput] = React.useState("");
  const [streaming, setStreaming] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);

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

  const onSend = React.useCallback(async () => {
    const content = input.trim();
    if (content.length === 0 || streaming) return;
    // Drop the soft keyboard on send so it (and the emulator's
    // hardware-keyboard bar) doesn't linger over the conversation.
    Keyboard.dismiss();
    setError(null);

    // Snapshot the new history so we send the server-supplied context.
    const nextHistory = appendUserTurn(history, content);
    setHistory(nextHistory);
    setInput("");
    setStreaming(true);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // The server requires `noPersist: true` (literal) per the contract
      // and the D9 defensive runtime check.
      const stream = api.chat(
        {
          content,
          history: nextHistory,
          noPersist: true,
        },
        { signal: controller.signal },
      );

      for await (const event of stream) {
        if (event.type === "delta") {
          setHistory((h) => appendAssistantDelta(h, event.text));
        } else if (event.type === "done") {
          break;
        } else if (event.type === "error") {
          // D11: render a generic message — no PHI from the error body.
          // Diagnostic: the event.message carries the HTTP status (e.g.
          // "Chat request failed (HTTP 403)."), which the UI intentionally
          // hides — log it (status only, no body/PHI) so failures are
          // diagnosable from logcat.
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
  }, [api, history, input, streaming]);

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
          paddingTop: theme.spacing.space5,
          paddingBottom: theme.spacing.sm,
          ...fontStyle("display", 700, fontsLoaded),
        },
        listContent: {
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        },
        // User bubble: teal fill, white text. Assistant: white surface
        // card with a hairline (so it reads on paper), ink text.
        bubbleUser: {
          alignSelf: "flex-end",
          backgroundColor: redesign.teal,
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
        bubbleTextAssistant: {
          color: redesign.ink,
          fontSize: theme.typography.sizes.base,
          lineHeight: theme.typography.sizes.base * 1.45,
          ...fontStyle("body", 400, fontsLoaded),
        },
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
          minHeight: 44,
          maxHeight: 120,
          ...fontStyle("body", 400, fontsLoaded),
        },
        sendBtn: {
          backgroundColor: redesign.teal,
          borderRadius: theme.radii.lg,
          paddingHorizontal: theme.spacing.md,
          minHeight: 44,
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
          backgroundColor: redesign.surface,
          borderColor: redesign.alarm,
          borderWidth: 1,
          borderRadius: theme.radii.lg,
          marginHorizontal: theme.spacing.md,
          marginBottom: theme.spacing.sm,
          padding: theme.spacing.md,
        },
        errorText: {
          color: redesign.ink,
          fontSize: theme.typography.sizes.sm,
          ...fontStyle("body", 400, fontsLoaded),
        },
      }),
    [theme, redesign, fontsLoaded],
  );

  const renderItem: ListRenderItem<ChatTurn> = ({ item }) => {
    const isUser = item.role === "user";
    // Assistant turns: strip the [SUGGESTIONS] protocol block (mobile has
    // no chip UI; the web client parses it, the mobile done-event omits
    // the cleaned content). User turns render verbatim.
    const text = isUser ? item.content : stripSuggestionsBlock(item.content);
    return (
      <View style={isUser ? styles.bubbleUser : styles.bubbleAssistant}>
        <Text style={isUser ? styles.bubbleTextUser : styles.bubbleTextAssistant}>
          {text}
        </Text>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <Text style={styles.title}>Ask Denali</Text>
      {history.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>
            Ask Denali anything about your health. Your conversation is not
            stored on our servers.
          </Text>
        </View>
      ) : (
        <FlatList
          contentContainerStyle={styles.listContent}
          data={history}
          keyExtractor={(_item, idx) => String(idx)}
          renderItem={renderItem}
        />
      )}
      {error != null && (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{error}</Text>
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
        <Pressable
          accessibilityRole="button"
          disabled={streaming || input.trim().length === 0}
          onPress={onSend}
          style={({ pressed }) => [
            styles.sendBtn,
            (streaming || input.trim().length === 0 || pressed) &&
              styles.sendBtnDisabled,
          ]}
        >
          {streaming ? (
            <ActivityIndicator color={redesign.surface} />
          ) : (
            <Text style={styles.sendText}>Send</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

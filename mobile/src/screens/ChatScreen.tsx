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
import { useTheme } from "@/theme/useTheme";

import {
  appendAssistantDelta,
  appendUserTurn,
  clearHistory,
  type ChatTurn,
} from "./chat/chatHistory";

export function ChatScreen(): React.ReactElement {
  const api = useApiClient();
  const { active, theme } = useTheme();
  // useColorScheme via useTheme — we need the mode to pick the right
  // bubble palette from the Wave-1-amended chat colors.
  const isDarkMode = active === theme.colors.dark;
  const chatPalette = isDarkMode ? theme.colors.chat.dark : theme.colors.chat.light;

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
        screen: { flex: 1, backgroundColor: active.bgPrimary },
        title: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.serif,
          fontSize: theme.typography.sizes["2xl"],
          paddingHorizontal: theme.spacing.lg,
          paddingTop: theme.spacing.lg,
          paddingBottom: theme.spacing.sm,
        },
        listContent: {
          padding: theme.spacing.md,
          gap: theme.spacing.sm,
        },
        bubbleUser: {
          alignSelf: "flex-end",
          backgroundColor: chatPalette.userBubbleFrom,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.md,
          maxWidth: "85%",
        },
        bubbleAssistant: {
          alignSelf: "flex-start",
          backgroundColor: chatPalette.assistantBubble,
          borderRadius: theme.radii.lg,
          padding: theme.spacing.md,
          maxWidth: "85%",
        },
        bubbleText: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
        },
        empty: {
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          padding: theme.spacing.lg,
        },
        emptyText: {
          color: active.textSecondary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
          textAlign: "center",
        },
        inputBar: {
          flexDirection: "row",
          alignItems: "flex-end",
          gap: theme.spacing.sm,
          padding: theme.spacing.md,
          borderTopColor: active.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          backgroundColor: active.bgPrimary,
        },
        input: {
          flex: 1,
          backgroundColor: active.bgSecondary,
          color: active.textPrimary,
          borderColor: active.border,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          paddingHorizontal: theme.spacing.md,
          paddingVertical: theme.spacing.sm,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
          minHeight: 44,
          maxHeight: 120,
        },
        sendBtn: {
          backgroundColor: active.accentPrimary,
          borderRadius: theme.radii.md,
          paddingHorizontal: theme.spacing.md,
          minHeight: 44,
          alignItems: "center",
          justifyContent: "center",
        },
        sendBtnDisabled: { opacity: 0.5 },
        sendText: {
          color: active.bgPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.base,
          fontWeight: "600",
        },
        errorBanner: {
          backgroundColor: active.bgSecondary,
          borderColor: active.error,
          borderWidth: 1,
          borderRadius: theme.radii.md,
          marginHorizontal: theme.spacing.md,
          marginBottom: theme.spacing.sm,
          padding: theme.spacing.md,
        },
        errorText: {
          color: active.textPrimary,
          fontFamily: theme.typography.fonts.sans,
          fontSize: theme.typography.sizes.sm,
        },
      }),
    [active, chatPalette, theme],
  );

  const renderItem: ListRenderItem<ChatTurn> = ({ item }) => {
    const bubble =
      item.role === "user" ? styles.bubbleUser : styles.bubbleAssistant;
    return (
      <View style={bubble}>
        <Text style={styles.bubbleText}>{item.content}</Text>
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
          placeholderTextColor={active.textMuted}
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
            <ActivityIndicator color={active.bgPrimary} />
          ) : (
            <Text style={styles.sendText}>Send</Text>
          )}
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

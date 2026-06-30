/**
 * chatHistory — pure helpers for the ChatScreen.
 *
 * Phase 1 mobile chat is EPHEMERAL (D11): session-scoped, cleared on
 * sign-out / app close. No server-side persistence (per D9 gate at
 * `app/src/app/api/chat/route.ts:151`). No on-device persistence in
 * Phase 1 either — the `chat_messages` table exists in the local DAL
 * schema but Pass 2 intentionally does not populate it. Persistent
 * local chat history is deferred to a later phase.
 *
 * The component holds the array in `useState`. These helpers encode the
 * mutation semantics so the component layer stays declarative.
 */

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Append a user turn. */
export function appendUserTurn(
  history: ReadonlyArray<ChatTurn>,
  content: string,
): ChatTurn[] {
  return [...history, { role: "user", content }];
}

/** Append (or replace) the trailing assistant turn — used for streaming. */
export function withAssistantTurn(
  history: ReadonlyArray<ChatTurn>,
  content: string,
): ChatTurn[] {
  const last = history[history.length - 1];
  if (last && last.role === "assistant") {
    // Replace the streaming assistant turn in place.
    return [...history.slice(0, -1), { role: "assistant", content }];
  }
  return [...history, { role: "assistant", content }];
}

/** Append a chunk to the trailing assistant turn (creates one if absent). */
export function appendAssistantDelta(
  history: ReadonlyArray<ChatTurn>,
  delta: string,
): ChatTurn[] {
  const last = history[history.length - 1];
  if (last && last.role === "assistant") {
    return [
      ...history.slice(0, -1),
      { role: "assistant", content: last.content + delta },
    ];
  }
  return [...history, { role: "assistant", content: delta }];
}

/** Clear history (used on sign-out — Phase 1 chat is session-scoped). */
export function clearHistory(): ChatTurn[] {
  return [];
}

/**
 * Strip the `[SUGGESTIONS]…[/SUGGESTIONS]` protocol block from an
 * assistant message for display.
 *
 * The model emits a trailing suggestions block; the web client parses it
 * into tappable chips and the server's `done` event carries the cleaned
 * `content`. Mobile's `done` event is deliberately minimal (no content —
 * D9 no-persist path), so the bubble would otherwise show the raw block.
 * Mobile has no suggestion-chip UI, so we just strip it. Mirrors the
 * server's `cleanContent` strip in `app/src/lib/claude.ts`
 * (extractSuggestionsAndClean) so display matches the web exactly.
 *
 * Applied at render time (not mutating stored history) so it also hides
 * the block while it streams in — once the `[SUGGESTIONS` marker appears
 * it's cut, no flash of raw markup.
 */
export function stripSuggestionsBlock(content: string): string {
  return content
    .replace(/\[SUGGESTIONS\][\s\S]*?\[\/SUGGESTIONS\]/i, "")
    .replace(/\[SUGGESTIONS\][\s\S]*$/i, "") // unclosed block (still streaming)
    .replace(/---\s*$/m, "") // trailing divider the block sometimes follows
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

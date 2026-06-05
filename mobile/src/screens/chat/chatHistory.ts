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

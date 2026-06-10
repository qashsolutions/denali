/**
 * chatStream — SSE iterable for /api/chat on mobile.
 *
 * The web app's chat route streams text/event-stream with three event
 * types:
 *   - event: delta   data: {"text": "..."}
 *   - event: done    data: {"iterations": N, "model": "...", "totalMs": M}
 *   - event: error   data: {"message": "..."}
 *
 * (Wave 3's `mobile-app-shell` chat surface and the no-persist regression
 * test will confirm the exact JSON shapes.)
 *
 * This function returns an `AsyncIterable<ChatStreamEvent>` matching the
 * frozen contract at `src/contracts/ApiClient.ts`. The consumer drives
 * iteration with `for await (const event of client.chat(input))`.
 *
 * 330s timeout is enforced via the request layer (httpClient defaults to
 * CHAT_TIMEOUT_MS for /api/chat). Stream errors emit a final `{type:"error"}`
 * event; the iterator then terminates.
 *
 * No-persist invariant: this client ALWAYS sends `noPersist: true` in the
 * request body and `X-Client-Type: mobile` in the header. The backend's
 * chat route then writes nothing to `conversations` / `messages`. The
 * persistence regression test in Wave 3 spies on `query()` to assert
 * zero rows are inserted under the mobile header.
 */

import type { ChatStreamEvent, ChatTurnInput } from "@/contracts";

import { API_BASE_URL } from "@/config/env";

import {
  CHAT_TIMEOUT_MS,
  rawRequest,
  type HttpClientHooks,
} from "./httpClient";

/**
 * Parse a single SSE frame into a `ChatStreamEvent` or null (unknown event,
 * skipped). A frame is one `event:` + one `data:` line (other fields ignored).
 */
function parseFrame(raw: string): ChatStreamEvent | null {
  let event: string | undefined;
  let data: string | undefined;
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) {
      // Multiple data: lines per frame are concatenated with newlines per
      // the SSE spec. We're conservative and only handle the first.
      data = (data ?? "") + line.slice(5).trim();
    }
  }
  if (!event || data == null) return null;

  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(data) as Record<string, unknown>;
  } catch {
    // Malformed payload — surface as an error event so the consumer can
    // terminate gracefully.
    return { type: "error", message: "Malformed SSE payload." };
  }

  switch (event) {
    case "delta":
      return {
        type: "delta",
        text: typeof parsed.text === "string" ? parsed.text : "",
      };
    case "done":
      return {
        type: "done",
        iterations:
          typeof parsed.iterations === "number" ? parsed.iterations : 0,
        model: typeof parsed.model === "string" ? parsed.model : "",
        totalMs: typeof parsed.totalMs === "number" ? parsed.totalMs : 0,
      };
    case "error":
      return {
        type: "error",
        message:
          typeof parsed.message === "string"
            ? parsed.message
            : "Unknown chat stream error.",
      };
    default:
      return null;
  }
}

export interface ChatStreamOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Returns an `AsyncIterable<ChatStreamEvent>` for the SSE response.
 *
 * Auth, X-Client-Type, refresh-on-401 are handled by `rawRequest`. We
 * cannot use `requestJson` because the response is event-stream, not JSON.
 *
 * Note: React Native's fetch on the New Architecture supports streaming
 * `Response.body` as a `ReadableStream`. If a future RN version regresses
 * this support, the fallback is to chunk-read the full text after `done`
 * and replay (acceptable degradation since the stream is short-lived).
 */
export function chatStream(
  input: ChatTurnInput,
  hooks: HttpClientHooks,
  options?: ChatStreamOptions,
): AsyncIterable<ChatStreamEvent> {
  return {
    [Symbol.asyncIterator]: () => createIterator(input, hooks, options),
  };
}

function createIterator(
  input: ChatTurnInput,
  hooks: HttpClientHooks,
  options: ChatStreamOptions | undefined,
): AsyncIterator<ChatStreamEvent> {
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let pending: ChatStreamEvent[] = [];
  let started = false;
  let done = false;
  const decoder = new TextDecoder();
  let buffer = "";

  async function ensureStarted(): Promise<void> {
    if (started) return;
    started = true;
    // Belt-and-suspenders: assert noPersist is set. The contract already
    // requires `noPersist: true` literal, but a runtime check guards
    // against a regression where the field is omitted.
    if (input.noPersist !== true) {
      pending.push({
        type: "error",
        message: "Refusing to start chat without noPersist:true.",
      });
      done = true;
      return;
    }

    // Map the ChatTurnInput contract → the wire shape the route expects.
    // The route validates `body.messages` (a non-empty {role,content}[]
    // array) BEFORE the mobile dispatch + consent gate, so sending the raw
    // {content,history,noPersist} was rejected with HTTP 400. `history`
    // already ends with the new user turn (ChatScreen's appendUserTurn),
    // so it IS the full conversation; fall back to a single user turn when
    // absent. noPersist stays top-level for the D9 guard. (2026-06-10 fix.)
    const messages =
      input.history && input.history.length > 0
        ? input.history
        : [{ role: "user" as const, content: input.content }];
    const wireBody = {
      messages,
      noPersist: input.noPersist,
      ...(input.modelOverride != null
        ? { modelOverride: input.modelOverride }
        : {}),
    };

    const response = await rawRequest(
      {
        method: "POST",
        path: "/api/chat",
        body: JSON.stringify(wireBody),
        headers: { Accept: "text/event-stream" },
        options: {
          signal: options?.signal,
          timeoutMs: options?.timeoutMs ?? CHAT_TIMEOUT_MS,
        },
      },
      hooks,
    );

    if (!response.ok) {
      pending.push({
        type: "error",
        message: `Chat request failed (HTTP ${response.status}).`,
      });
      done = true;
      return;
    }

    if (!response.body) {
      // Stream unavailable — surface as error. (See note above re: RN
      // fetch streaming.)
      pending.push({
        type: "error",
        message: "Chat response had no streamable body.",
      });
      done = true;
      return;
    }
    reader = response.body.getReader();
    // Touch API_BASE_URL so the linter doesn't flag unused-import if the
    // builder later refactors `rawRequest` to drop env import — keeps the
    // base-url contract visible in this module.
    void API_BASE_URL;
  }

  async function pump(): Promise<void> {
    if (!reader) return;
    const { value, done: streamDone } = await reader.read();
    if (streamDone) {
      done = true;
      // Flush any trailing buffer as a frame.
      if (buffer.trim().length > 0) {
        const event = parseFrame(buffer);
        if (event) pending.push(event);
        buffer = "";
      }
      return;
    }
    buffer += decoder.decode(value, { stream: true });
    // SSE frames are delimited by a blank line.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      const event = parseFrame(frame);
      if (event) pending.push(event);
    }
  }

  return {
    async next(): Promise<IteratorResult<ChatStreamEvent>> {
      try {
        await ensureStarted();
        while (pending.length === 0 && !done) {
          await pump();
        }
        if (pending.length === 0 && done) {
          return { value: undefined, done: true };
        }
        return { value: pending.shift()!, done: false };
      } catch (err) {
        done = true;
        const message = err instanceof Error ? err.message : "Chat stream error.";
        return { value: { type: "error", message }, done: false };
      }
    },
    async return(): Promise<IteratorResult<ChatStreamEvent>> {
      done = true;
      if (reader) {
        try {
          await reader.cancel();
        } catch {
          // ignore
        }
      }
      return { value: undefined, done: true };
    },
  };
}

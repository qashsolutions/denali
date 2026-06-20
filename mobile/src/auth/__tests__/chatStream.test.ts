/**
 * chatStream — unit tests.
 *
 * Covers:
 *   - SSE delta event parses into `{ type: "delta", text }`.
 *   - SSE done event parses into `{ type: "done", iterations, model, totalMs }`.
 *   - SSE error event parses into `{ type: "error", message }`.
 *   - Partial-frame reassembly: a frame split across two chunks emerges as
 *     a single event.
 *   - Request shape: path `/api/chat`, body has `noPersist: true`, header
 *     `Accept: text/event-stream`, and `X-Client-Type: mobile` (proxied via
 *     `rawRequest` which is covered by `httpClient.test.ts`; here we mock
 *     `rawRequest` directly so we control the Response body).
 *   - AbortSignal stops the iterator cleanly (no hung loop).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/config/env", () => ({
  API_BASE_URL: "https://test.denali.health",
}));

vi.mock("expo-secure-store", () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 1,
  setItemAsync: vi.fn(),
  getItemAsync: vi.fn(),
  deleteItemAsync: vi.fn(),
}));

// Capture every call to `rawRequest` so we can assert on path/body/headers
// AND return a controlled streaming Response.
type RawRequestArgs = {
  method: string;
  path: string;
  body?: string;
  headers?: Record<string, string>;
  options?: { timeoutMs?: number; signal?: AbortSignal };
};

const rawRequestSpy = vi.fn<(req: RawRequestArgs, hooks: unknown) => Promise<Response>>();

vi.mock("../httpClient", async () => {
  // Preserve the real CHAT_TIMEOUT_MS constant — chatStream pins on it.
  return {
    rawRequest: (req: RawRequestArgs, hooks: unknown) =>
      rawRequestSpy(req, hooks),
    CHAT_TIMEOUT_MS: 330_000,
  };
});

import type { ChatStreamEvent, ChatTurnInput } from "@/contracts";
import { chatStream } from "../chatStream";

const hooks = { onSignInRequired: () => {} };

const baseInput: ChatTurnInput = {
  content: "hi there",
  noPersist: true,
};

function streamFromBytes(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    async pull(controller) {
      if (i < chunks.length) {
        controller.enqueue(chunks[i++]);
      } else {
        controller.close();
      }
    },
  });
}

function sseResponse(chunks: Uint8Array[]): Response {
  // React Native's `Response` types reject `ReadableStream` as a body
  // (the RN typings model `BodyInit` as a uri-bearing source). Cast through
  // unknown — under node the global Response accepts streams just fine.
  return new Response(streamFromBytes(chunks) as unknown as string, {
    status: 200,
    headers: { "content-type": "text/event-stream" },
  });
}

async function collectEvents(
  iter: AsyncIterable<ChatStreamEvent>,
): Promise<ChatStreamEvent[]> {
  const events: ChatStreamEvent[] = [];
  for await (const event of iter) {
    events.push(event);
  }
  return events;
}

const encode = (s: string): Uint8Array => new TextEncoder().encode(s);

beforeEach(() => {
  rawRequestSpy.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("chatStream — frame parsing", () => {
  it("parses a delta frame into { type: 'delta', text }", async () => {
    rawRequestSpy.mockResolvedValueOnce(
      sseResponse([encode('event: delta\ndata: {"text":"hi"}\n\n')]),
    );
    const events = await collectEvents(chatStream(baseInput, hooks));
    expect(events).toEqual([{ type: "delta", text: "hi" }]);
  });

  it("parses a done frame into { type: 'done', iterations, model, totalMs }", async () => {
    rawRequestSpy.mockResolvedValueOnce(
      sseResponse([
        encode(
          'event: done\ndata: {"iterations":1,"model":"haiku","totalMs":200}\n\n',
        ),
      ]),
    );
    const events = await collectEvents(chatStream(baseInput, hooks));
    expect(events).toEqual([
      { type: "done", iterations: 1, model: "haiku", totalMs: 200 },
    ]);
  });

  it("parses an error frame into { type: 'error', message }", async () => {
    rawRequestSpy.mockResolvedValueOnce(
      sseResponse([encode('event: error\ndata: {"message":"oops"}\n\n')]),
    );
    const events = await collectEvents(chatStream(baseInput, hooks));
    expect(events).toEqual([{ type: "error", message: "oops" }]);
  });

  it("surfaces a transport failure as an error EVENT carrying the message (chat-offline)", async () => {
    // The RN offline failure is a thrown TypeError, NOT an SSE error frame —
    // the iterator catches it and converts it to an error event, preserving
    // the message. ChatScreen routes that message through chatErrorMessage to
    // show the offline copy; this pins the message is not lost/renamed.
    rawRequestSpy.mockRejectedValueOnce(new TypeError("Network request failed"));
    const events = await collectEvents(chatStream(baseInput, hooks));
    expect(events).toEqual([
      { type: "error", message: "Network request failed" },
    ]);
  });

  it("reassembles a frame split across two chunks", async () => {
    // First chunk: half the header. Second chunk: rest of the header +
    // data + blank-line delimiter. The iterator must yield ONE delta with
    // text "hi", not two malformed events.
    rawRequestSpy.mockResolvedValueOnce(
      sseResponse([
        encode("event: del"),
        encode('ta\ndata: {"text":"hi"}\n\n'),
      ]),
    );
    const events = await collectEvents(chatStream(baseInput, hooks));
    expect(events).toEqual([{ type: "delta", text: "hi" }]);
  });
});

describe("chatStream — request shape", () => {
  it("issues POST /api/chat with noPersist body, Accept SSE, and CHAT_TIMEOUT_MS default", async () => {
    rawRequestSpy.mockResolvedValueOnce(
      sseResponse([encode('event: done\ndata: {"iterations":1}\n\n')]),
    );

    await collectEvents(chatStream(baseInput, hooks));

    expect(rawRequestSpy).toHaveBeenCalledTimes(1);
    const [req] = rawRequestSpy.mock.calls[0];
    expect(req.method).toBe("POST");
    expect(req.path).toBe("/api/chat");
    expect(req.headers?.Accept).toBe("text/event-stream");

    // Wire body must carry noPersist:true AND a `messages` array (the
    // shape the route validates) — NOT the raw {content} field, which the
    // route ignores and which caused HTTP 400. (2026-06-10 fix.)
    expect(req.body).toBeDefined();
    const parsed = JSON.parse(req.body!) as {
      noPersist: boolean;
      messages: Array<{ role: string; content: string }>;
      content?: unknown;
    };
    expect(parsed.noPersist).toBe(true);
    expect(parsed.messages).toEqual([{ role: "user", content: "hi there" }]);
    expect(parsed.content).toBeUndefined();

    // Default timeout = CHAT_TIMEOUT_MS (the chat ceiling).
    expect(req.options?.timeoutMs).toBe(330_000);
  });

  it("forwards a caller-provided AbortSignal to rawRequest", async () => {
    const controller = new AbortController();
    rawRequestSpy.mockResolvedValueOnce(
      sseResponse([encode('event: done\ndata: {"iterations":1}\n\n')]),
    );

    await collectEvents(
      chatStream(baseInput, hooks, { signal: controller.signal }),
    );

    const [req] = rawRequestSpy.mock.calls[0];
    expect(req.options?.signal).toBe(controller.signal);
  });
});

describe("chatStream — abort semantics", () => {
  it("calling .return() on the iterator stops cleanly (no hung loop)", async () => {
    // Construct a stream that pauses forever after one frame so the
    // iterator would otherwise block in .next(). We then call .return()
    // to terminate the loop and assert the iterator resolves.
    let cancelCalled = false;
    const pausing = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encode('event: delta\ndata: {"text":"hi"}\n\n'));
        // Don't close — caller must abort.
      },
      cancel() {
        cancelCalled = true;
      },
    });

    rawRequestSpy.mockResolvedValueOnce(
      new Response(pausing as unknown as string, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const iter = chatStream(baseInput, hooks)[Symbol.asyncIterator]();

    const first = await iter.next();
    expect(first.done).toBe(false);
    expect(first.value).toEqual({ type: "delta", text: "hi" });

    // Telling the iterator we're done must NOT hang forever.
    const ret = await iter.return!();
    expect(ret.done).toBe(true);

    // The underlying stream's cancel() got called as a result.
    expect(cancelCalled).toBe(true);
  });
});

describe("chatStream — error handling", () => {
  it("non-OK response yields a single error event then terminates", async () => {
    rawRequestSpy.mockResolvedValueOnce(
      new Response("", {
        status: 500,
        headers: { "content-type": "text/event-stream" },
      }),
    );

    const events = await collectEvents(chatStream(baseInput, hooks));
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe("error");
    if (events[0].type === "error") {
      expect(events[0].message).toMatch(/HTTP 500/);
    }
  });
});

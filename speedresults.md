# Response Time Optimization — Audit Results

> Verified against actual codebase on 2026-02-09.
> Each finding reviewed by reading the source files directly.

---

## Finding 1: Redundant Profile Fetch

**Status:** CONFIRMED
**File:** `app/src/app/api/chat/route.ts` lines 116-120 and 195-199
**Savings:** ~50-100ms per request (one Supabase round-trip)

The route fetches `plan, is_admin` from the `users` table twice:
1. Lines 116-120: For rate limiting (determines chatLimit)
2. Lines 195-199: For attachment size validation (determines uploadLimit)

Both queries are identical: `.from("users").select("plan, is_admin").eq("id", authUser.id).single()`

**Fix:** Store the first query result and reuse it for attachment validation.

---

## Finding 2: Health Context Prompt Size

**Status:** PARTIALLY CONFIRMED — already well-optimized, needs only a safety cap
**File:** `app/src/lib/fhir/context.ts`
**Savings:** ~10-30ms first-token latency (for users with extensive health data)

The audit estimated 50-200KB — **this is overstated**. Actual context.ts already:
- Filters medications to diabetes-relevant
- Slices providers to 8
- Filters hospitalizations to last 90 days
- Slices denial diagnoses to 3

Realistic output: 1-5KB for most users. However, there's no hard character cap, so edge cases with many screenings, lab trends, and log entries could grow.

**Fix:** Add a hard character cap (~4KB) with truncation notice.

---

## Finding 3: Streaming Responses

**Status:** VALID — biggest perceived improvement, biggest implementation effort
**Files:** `route.ts`, `claude.ts`, `useChat.ts`
**Savings:** Perceived response time from 5-15s down to <1s first token

Current architecture: Client sends request → server runs full tool loop (1-10 iterations × 60s each) → returns complete JSON. User sees "Thinking..." spinner for the entire duration.

Streaming would show tokens as Claude generates them. However, the tool-calling loop makes this complex:
- During tool iterations, there's nothing meaningful to stream to the user
- Only the final text response should stream
- Need to restructure from JSON response to SSE (Server-Sent Events)
- useChat.ts needs to switch from `response.json()` to `ReadableStream` chunk processing
- Session state, suggestions, appealId still need to be sent as structured data after streaming

**Fix:** Implement SSE streaming for the final Claude response while keeping tool iterations server-side. This is a multi-file refactor that deserves its own implementation cycle.

---

## Finding 4: Sequential Local Tool Execution

**Status:** CONFIRMED
**File:** `app/src/lib/claude.ts` lines 561-604
**Savings:** Variable — 50-500ms when multiple tools called in same iteration

`processToolCalls()` uses a `for...of` loop with `await executor()` inside. When Claude requests multiple tools in a single response (e.g., `search_cpt` + `check_prior_auth` + `check_preventive`), they execute one at a time instead of in parallel.

Typical tool counts per iteration: 1-3 tools. Each tool takes 50-200ms (Supabase queries, API calls). With 3 tools at 100ms each: sequential = 300ms, parallel = 100ms.

**Fix:** Use `Promise.allSettled()` to run all tool calls concurrently.

---

## Finding 5: Flywheel Prompt Injection Unbounded

**Status:** PARTIALLY CONFIRMED — learning side is capped, flywheel side is not
**File:** `app/src/lib/learning.ts`
**Savings:** Marginal unless flywheel data grows large (prevents future regression)

`getLearningContext()` is well-capped:
- Symptom mappings: `.limit(5)` per symptom
- Procedure mappings: `.limit(5)` per procedure
- Coverage paths: `.limit(10)` per CPT, then `.slice(0, 3)` in prompt builder
- Recent denials: `.limit(5)`

`buildLearningPromptInjection()` is also capped: `.slice(0, 5)` for mappings, `.slice(0, 3)` for paths.

BUT `buildFlywheelPromptInjection()` (line 828) has NO internal cap. It maps ALL items from `getFlywheelContext()` RPC into the prompt without slicing. If the RPC returns many rows (dependent on database-side limit), the prompt could grow unbounded.

**Fix:** Add `.slice(0, 20)` cap to the flywheel context before building the prompt.

---

## Implementation Status

All 5 findings implemented. TypeScript compiles clean (`npx tsc --noEmit` passes).

| # | Finding | Status | Files Changed |
|---|---------|--------|--------------|
| 1 | Redundant profile fetch | DONE | `route.ts` — reuse `userProfile` variable |
| 2 | Health context cap | DONE | `fhir/context.ts` — 4KB char cap with truncation |
| 3 | Streaming responses | DONE | `claude.ts` + `route.ts` + `useChat.ts` — SSE streaming |
| 4 | Parallel tool execution | DONE | `claude.ts` — `Promise.all()` replaces `for...of` |
| 5 | Flywheel injection cap | DONE | `learning.ts` — `.slice(0, 20)` on flywheel context |

### Streaming Architecture

```
Client sends POST /api/chat
    ↓
route.ts validates (rate limit, attachment) → returns 4xx JSON on error
    ↓
route.ts creates TransformStream, returns readable immediately
    ↓
Async producer calls chat() with streaming callbacks:
  onDelta(text) → SSE "delta" event → client appends text to message
  onToolProgress(name) → SSE "tool" event → client clears streaming text
    ↓
chat() runs tool loop (uses stream:true on Anthropic API):
  - Text deltas forwarded to client in real-time
  - Tool iterations: text cleared, tools executed (parallel via Promise.all)
  - Fallback: if streaming API fails, uses non-streaming API
    ↓
After chat() returns:
  - Post-processing: conversation create, message save, learning, appeal save
  - SSE "done" event with clean content + metadata → client finalizes
    ↓
useChat.ts parses SSE events:
  - "delta" → incremental text append
  - "tool" → clear text, log tool name
  - "done" → replace content with clean version, update sessionState/suggestions
  - "error" → throw to error handler
  - Falls back to response.json() if Content-Type is not text/event-stream
```

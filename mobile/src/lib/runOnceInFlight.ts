/**
 * Concurrency guard — run `task` exactly once at a time.
 *
 * Subsequent invocations while a prior task is in flight are silently
 * dropped (return a resolved promise). After the in-flight task settles
 * (either fulfilled or rejected), the guard clears and the NEXT
 * invocation runs the task again — so this is rate-limiting against
 * RAPID double-fires, not a one-shot kill.
 *
 * The guard variable is owned by the caller (typically a `useRef`) so
 * this helper stays pure, dependency-free, and testable. Errors thrown
 * by `task` propagate to the caller; the helper still clears the guard
 * (via `finally`) so an error doesn't permanently block future calls.
 *
 * USE CASE — 988 / PHQ-9 once-only persist
 *   Acknowledging the 988 modal can race with the `useEffect` that
 *   detects "item 9 just landed". Without a guard, both code paths can
 *   call `persistInstrument(PHQ9, …)` in close succession and the
 *   crisis observation persists twice. Wrapping the persist call with
 *   `runOnceInFlight(ref, () => persistInstrument(...))` guarantees the
 *   row is written exactly once. The unit test in
 *   `runOnceInFlight.test.ts` pins the invariant: a rapid double-fire
 *   produces one task execution.
 */

export interface InFlightRef {
  current: boolean;
}

/**
 * Run `task` exactly once at a time against a shared in-flight ref.
 *
 * Returns a Promise that resolves when the task completes (whether this
 * call ran the task or was a no-op). Re-throws task errors to the
 * caller of the EXECUTING invocation; bypassed callers receive a
 * resolved promise.
 */
export async function runOnceInFlight(
  ref: InFlightRef,
  task: () => Promise<void>,
): Promise<void> {
  if (ref.current) return;
  ref.current = true;
  try {
    await task();
  } finally {
    ref.current = false;
  }
}

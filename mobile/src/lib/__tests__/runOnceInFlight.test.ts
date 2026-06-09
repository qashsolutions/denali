/**
 * runOnceInFlight — concurrency-guard tests.
 *
 * The load-bearing invariant: a rapid double-fire (two calls before the
 * first task resolves) executes the underlying task EXACTLY ONCE. This
 * is the structural backstop for the PHQ-9 / 988 once-only persist
 * (operator flag, 2026-06-08).
 *
 * Coverage:
 *   - Sequential calls (first awaited fully before the second) run the
 *     task each time — the guard is NOT a permanent kill.
 *   - Two concurrent calls run the task exactly ONCE; the second call
 *     resolves silently with no task invocation.
 *   - N rapid calls before the first settles → task runs once.
 *   - After the task settles, a NEW call runs the task again (clears).
 *   - Task error propagates to the executing caller; the guard clears
 *     so the next call can retry (no permanent poisoning).
 *   - The ref is read/written through the user-supplied object, so the
 *     caller can wire it to a React.useRef.
 */
import { describe, expect, it } from "vitest";

import { runOnceInFlight, type InFlightRef } from "../runOnceInFlight";

function makeRef(): InFlightRef {
  return { current: false };
}

/** Helper: a controllable deferred wrapping a task counter. */
function makeDeferred(): {
  promise: Promise<void>;
  resolve: () => void;
  reject: (err: unknown) => void;
} {
  let resolve!: () => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("runOnceInFlight — once-only invariant", () => {
  it("a single call runs the task once", async () => {
    const ref = makeRef();
    let runs = 0;
    await runOnceInFlight(ref, async () => {
      runs += 1;
    });
    expect(runs).toBe(1);
    expect(ref.current).toBe(false);
  });

  it("two concurrent calls (rapid double-fire) run the task EXACTLY ONCE", async () => {
    const ref = makeRef();
    const d = makeDeferred();
    let runs = 0;
    const task = async () => {
      runs += 1;
      await d.promise;
    };

    // Fire the first call but don't await it.
    const p1 = runOnceInFlight(ref, task);
    // Fire the second call while the first is in flight.
    const p2 = runOnceInFlight(ref, task);

    // Both pending — but only one task has been entered.
    expect(runs).toBe(1);

    // Resolve the in-flight task; let both promises settle.
    d.resolve();
    await Promise.all([p1, p2]);

    // The double-fire never re-entered.
    expect(runs).toBe(1);
    expect(ref.current).toBe(false);
  });

  it("N rapid calls before the first settles → task runs once", async () => {
    const ref = makeRef();
    const d = makeDeferred();
    let runs = 0;
    const task = async () => {
      runs += 1;
      await d.promise;
    };

    const ps = [
      runOnceInFlight(ref, task),
      runOnceInFlight(ref, task),
      runOnceInFlight(ref, task),
      runOnceInFlight(ref, task),
      runOnceInFlight(ref, task),
    ];
    expect(runs).toBe(1);

    d.resolve();
    await Promise.all(ps);
    expect(runs).toBe(1);
  });

  it("sequential calls (each awaited before the next) run the task each time", async () => {
    const ref = makeRef();
    let runs = 0;
    const task = async () => {
      runs += 1;
    };
    await runOnceInFlight(ref, task);
    await runOnceInFlight(ref, task);
    await runOnceInFlight(ref, task);
    expect(runs).toBe(3);
    expect(ref.current).toBe(false);
  });

  it("clears the guard after the in-flight task settles — next call runs the task again", async () => {
    const ref = makeRef();
    const d1 = makeDeferred();
    const d2 = makeDeferred();
    let runs = 0;
    const taskWith = (d: { promise: Promise<void> }) => async () => {
      runs += 1;
      await d.promise;
    };

    const p1 = runOnceInFlight(ref, taskWith(d1));
    // While first is in flight, a second call is dropped.
    await runOnceInFlight(ref, taskWith(d1));
    expect(runs).toBe(1);

    // Finish the first task; the guard clears.
    d1.resolve();
    await p1;
    expect(ref.current).toBe(false);

    // New call after settlement runs the task again.
    const p3 = runOnceInFlight(ref, taskWith(d2));
    expect(runs).toBe(2);
    d2.resolve();
    await p3;
    expect(ref.current).toBe(false);
  });

  it("task error propagates to the executing caller and clears the guard (no poisoning)", async () => {
    const ref = makeRef();
    let runs = 0;
    const failingTask = async () => {
      runs += 1;
      throw new Error("boom");
    };

    await expect(runOnceInFlight(ref, failingTask)).rejects.toThrow("boom");
    expect(runs).toBe(1);
    expect(ref.current).toBe(false);

    // Guard is clean — a retry can proceed.
    await runOnceInFlight(ref, async () => {
      runs += 1;
    });
    expect(runs).toBe(2);
  });

  it("when in-flight=true, bypassed call resolves WITHOUT entering the task", async () => {
    // Manual setup: the caller mutates the ref directly. This simulates
    // a guard that another code path has set. Useful for asserting the
    // contract independently of the helper's own internal mutation.
    const ref: InFlightRef = { current: true };
    let runs = 0;
    await runOnceInFlight(ref, async () => {
      runs += 1;
    });
    expect(runs).toBe(0);
    expect(ref.current).toBe(true);
  });
});

describe("runOnceInFlight — PHQ-9 988 scenario simulation", () => {
  // Mirrors the actual race: the modal's `onAcknowledge` calls
  // `advanceMoodAfterResponse` → persistInstrument(PHQ9), AND the
  // line-380 useEffect fires the same path one render cycle later as
  // `phqResponses[8]` lands. Without the guard, both paths persist.
  it("simulating modal-ack + effect both calling persist → ONE row written", async () => {
    const ref = makeRef();
    const persistedRows: number[] = [];
    let nextId = 1;

    const persist = async () => {
      // The "DB write" — record one row each time we're entered.
      persistedRows.push(nextId);
      nextId += 1;
      // Pretend the DB write takes a tick.
      await Promise.resolve();
    };

    // Modal acknowledgement fires the persist.
    const fromModalAck = runOnceInFlight(ref, persist);
    // The effect re-fires (phqResponses changed) — calls persist again.
    const fromEffect = runOnceInFlight(ref, persist);

    await Promise.all([fromModalAck, fromEffect]);

    expect(persistedRows).toEqual([1]); // exactly one row
  });
});

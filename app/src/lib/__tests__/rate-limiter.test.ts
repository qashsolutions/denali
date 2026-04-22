import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * rate-limiter.ts — Unit Tests
 *
 * Tests token bucket rate limiting, circuit breaker state machine,
 * exponential backoff with retry, and error classification.
 * All in-memory — no DB, no network.
 */

import {
  tryAcquireToken,
  getTimeUntilNextToken,
  isCircuitClosed,
  recordSuccess,
  recordFailure,
  getCircuitStatus,
  resetCircuitBreaker,
  resetAll,
  withRetry,
  getAllStats,
  RetryableError,
  NonRetryableError,
  CircuitOpenError,
  RateLimitError,
} from "../rate-limiter";

beforeEach(() => {
  resetAll();
  vi.useRealTimers();
});

afterEach(() => {
  resetAll();
});

// ════════════════════════════════════════════════════════════════════════════
// Token Bucket Rate Limiter
// ════════════════════════════════════════════════════════════════════════════

describe("token bucket — tryAcquireToken", () => {
  it("allows requests up to burst size", () => {
    // DEFAULT burstSize = 5
    for (let i = 0; i < 5; i++) {
      expect(tryAcquireToken("test-api")).toBe(true);
    }
  });

  it("rejects when tokens exhausted", () => {
    // Exhaust all tokens
    for (let i = 0; i < 5; i++) {
      tryAcquireToken("test-api");
    }
    expect(tryAcquireToken("test-api")).toBe(false);
  });

  it("refills tokens over time", () => {
    // Exhaust tokens
    for (let i = 0; i < 5; i++) {
      tryAcquireToken("test-refill");
    }
    expect(tryAcquireToken("test-refill")).toBe(false);

    // Simulate time passing — 2 seconds = 2/60 * 30 RPM = 1 token refilled
    vi.useFakeTimers();
    vi.advanceTimersByTime(2000);

    expect(tryAcquireToken("test-refill")).toBe(true);
  });

  it("does not refill above burst size", () => {
    vi.useFakeTimers();
    // Fresh limiter has full tokens (5)
    // Wait a long time — should not go above 5
    vi.advanceTimersByTime(300000); // 5 minutes

    // Acquire 5 should work, 6th should fail
    for (let i = 0; i < 5; i++) {
      expect(tryAcquireToken("test-cap")).toBe(true);
    }
    expect(tryAcquireToken("test-cap")).toBe(false);
  });

  it("uses per-API config when available", () => {
    // NPI has burstSize=10 (from config)
    for (let i = 0; i < 10; i++) {
      expect(tryAcquireToken("NPI")).toBe(true);
    }
    expect(tryAcquireToken("NPI")).toBe(false);
  });
});

describe("token bucket — getTimeUntilNextToken", () => {
  it("returns 0 when tokens available", () => {
    expect(getTimeUntilNextToken("test-time")).toBe(0);
  });

  it("returns positive ms when no tokens available", () => {
    for (let i = 0; i < 5; i++) {
      tryAcquireToken("test-wait");
    }
    const waitTime = getTimeUntilNextToken("test-wait");
    expect(waitTime).toBeGreaterThan(0);
    expect(waitTime).toBeLessThan(10000); // Should be ~2s for 30 RPM
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Circuit Breaker
// ════════════════════════════════════════════════════════════════════════════

describe("circuit breaker — state transitions", () => {
  it("starts in closed state", () => {
    expect(isCircuitClosed("test-cb")).toBe(true);
    expect(getCircuitStatus("test-cb").state).toBe("closed");
  });

  it("opens after failure threshold (5 failures)", () => {
    for (let i = 0; i < 5; i++) {
      recordFailure("test-open");
    }
    expect(isCircuitClosed("test-open")).toBe(false);
    expect(getCircuitStatus("test-open").state).toBe("open");
  });

  it("stays closed below failure threshold", () => {
    for (let i = 0; i < 4; i++) {
      recordFailure("test-below");
    }
    expect(isCircuitClosed("test-below")).toBe(true);
    expect(getCircuitStatus("test-below").failures).toBe(4);
  });

  it("transitions to half-open after reset timeout", () => {
    vi.useFakeTimers();

    // Open the circuit
    for (let i = 0; i < 5; i++) {
      recordFailure("test-halfopen");
    }
    expect(isCircuitClosed("test-halfopen")).toBe(false);

    // Advance past reset timeout (60s default)
    vi.advanceTimersByTime(61000);

    // Should now be half-open (allows limited requests)
    expect(isCircuitClosed("test-halfopen")).toBe(true);
    expect(getCircuitStatus("test-halfopen").state).toBe("half-open");
  });

  it("closes from half-open after enough successes", () => {
    vi.useFakeTimers();

    // Open → half-open
    for (let i = 0; i < 5; i++) recordFailure("test-recover");
    vi.advanceTimersByTime(61000);
    isCircuitClosed("test-recover"); // triggers half-open

    // Record enough successes (halfOpenRequests = 2)
    recordSuccess("test-recover");
    recordSuccess("test-recover");

    expect(getCircuitStatus("test-recover").state).toBe("closed");
    expect(getCircuitStatus("test-recover").failures).toBe(0);
  });

  it("re-opens from half-open on failure", () => {
    vi.useFakeTimers();

    // Open → half-open
    for (let i = 0; i < 5; i++) recordFailure("test-reopen");
    vi.advanceTimersByTime(61000);
    isCircuitClosed("test-reopen");

    // Failure in half-open → back to open
    recordFailure("test-reopen");
    expect(getCircuitStatus("test-reopen").state).toBe("open");
  });

  it("success in closed state decrements failure count", () => {
    recordFailure("test-decrement");
    recordFailure("test-decrement");
    expect(getCircuitStatus("test-decrement").failures).toBe(2);

    recordSuccess("test-decrement");
    expect(getCircuitStatus("test-decrement").failures).toBe(1);
  });

  it("failure count does not go below 0", () => {
    recordSuccess("test-floor");
    expect(getCircuitStatus("test-floor").failures).toBe(0);
  });
});

describe("circuit breaker — resetCircuitBreaker", () => {
  it("resets to initial closed state", () => {
    for (let i = 0; i < 5; i++) recordFailure("test-reset");
    expect(getCircuitStatus("test-reset").state).toBe("open");

    resetCircuitBreaker("test-reset");

    expect(getCircuitStatus("test-reset").state).toBe("closed");
    expect(getCircuitStatus("test-reset").failures).toBe(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// Error Types
// ════════════════════════════════════════════════════════════════════════════

describe("error types", () => {
  it("RetryableError has name and statusCode", () => {
    const err = new RetryableError("Server error", 500);
    expect(err.name).toBe("RetryableError");
    expect(err.statusCode).toBe(500);
    expect(err.message).toBe("Server error");
  });

  it("NonRetryableError has name and statusCode", () => {
    const err = new NonRetryableError("Bad request", 400);
    expect(err.name).toBe("NonRetryableError");
    expect(err.statusCode).toBe(400);
  });

  it("CircuitOpenError includes API name", () => {
    const err = new CircuitOpenError("NPI");
    expect(err.name).toBe("CircuitOpenError");
    expect(err.message).toContain("NPI");
  });

  it("RateLimitError includes retry time", () => {
    const err = new RateLimitError("PUBMED", 5000);
    expect(err.name).toBe("RateLimitError");
    expect(err.retryAfterMs).toBe(5000);
    expect(err.message).toContain("PUBMED");
  });
});

// ════════════════════════════════════════════════════════════════════════════
// withRetry
// ════════════════════════════════════════════════════════════════════════════

describe("withRetry", () => {
  it("returns result on first success", async () => {
    const fn = vi.fn().mockResolvedValue("ok");

    const result = await withRetry("test-retry-ok", fn);

    expect(result).toBe("ok");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("retries on retryable error and succeeds", async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RetryableError("timeout", 503))
      .mockResolvedValue("recovered");

    const result = await withRetry("test-retry-recover", fn, { maxRetries: 2 });

    expect(result).toBe("recovered");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("throws NonRetryableError immediately without retry", async () => {
    const fn = vi
      .fn()
      .mockRejectedValue(new NonRetryableError("bad request", 400));

    await expect(
      withRetry("test-no-retry", fn, { maxRetries: 3 }),
    ).rejects.toThrow("bad request");
    expect(fn).toHaveBeenCalledOnce();
  });

  it("throws CircuitOpenError when circuit is open", async () => {
    // Open the circuit
    for (let i = 0; i < 5; i++) recordFailure("test-circuit-retry");

    const fn = vi.fn().mockResolvedValue("ok");

    await expect(withRetry("test-circuit-retry", fn)).rejects.toThrow(
      CircuitOpenError,
    );
    expect(fn).not.toHaveBeenCalled();
  });

  it("calls onRetry callback with attempt info", async () => {
    const onRetry = vi.fn();
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new RetryableError("fail"))
      .mockResolvedValue("ok");

    await withRetry("test-onretry", fn, { maxRetries: 2, onRetry });

    expect(onRetry).toHaveBeenCalledOnce();
    expect(onRetry.mock.calls[0][0]).toBe(1); // attempt number
    expect(onRetry.mock.calls[0][2]).toBeGreaterThan(0); // delay ms
  });

  it("records success in circuit breaker", async () => {
    const fn = vi.fn().mockResolvedValue("ok");

    await withRetry("test-cb-success", fn);

    const status = getCircuitStatus("test-cb-success");
    expect(status.state).toBe("closed");
  });

  it("records failure in circuit breaker on error", async () => {
    const fn = vi.fn().mockRejectedValue(new NonRetryableError("fail"));

    await expect(withRetry("test-cb-fail", fn)).rejects.toThrow();

    const status = getCircuitStatus("test-cb-fail");
    expect(status.failures).toBeGreaterThan(0);
  });
});

// ════════════════════════════════════════════════════════════════════════════
// getAllStats / resetAll
// ════════════════════════════════════════════════════════════════════════════

describe("getAllStats", () => {
  it("returns stats for all active limiters and breakers", () => {
    tryAcquireToken("api-a");
    tryAcquireToken("api-b");
    recordFailure("api-a");

    const stats = getAllStats();

    expect(stats.rateLimiters.length).toBe(2);
    expect(stats.circuitBreakers.length).toBe(1);
    expect(stats.rateLimiters.find((r) => r.name === "api-a")).toBeTruthy();
    expect(
      stats.circuitBreakers.find((c) => c.name === "api-a")?.failures,
    ).toBe(1);
  });
});

describe("resetAll", () => {
  it("clears all state", () => {
    tryAcquireToken("reset-test");
    recordFailure("reset-test");

    resetAll();

    const stats = getAllStats();
    expect(stats.rateLimiters.length).toBe(0);
    expect(stats.circuitBreakers.length).toBe(0);
  });
});

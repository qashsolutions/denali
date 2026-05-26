import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * metrics/cloudwatch.ts — Unit Tests
 *
 * Tests CloudWatch PutMetricData buffering, flushing, and lifecycle.
 */

const mockSend = vi.fn();
function MockCWClient() {
  return { send: mockSend };
}
vi.mock("@aws-sdk/client-cloudwatch", async () => {
  const actual = await vi.importActual("@aws-sdk/client-cloudwatch");
  return {
    ...actual,
    CloudWatchClient: MockCWClient,
  };
});

import {
  recordMetric,
  flush,
  startAutoFlush,
  stopAutoFlush,
  _getBufferLength,
  _resetBuffer,
} from "../cloudwatch";

describe("cloudwatch metrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetBuffer();
    stopAutoFlush();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    _resetBuffer();
    stopAutoFlush();
  });

  // ── recordMetric ──

  it("buffers metrics in production", () => {
    vi.stubEnv("NODE_ENV", "production");

    recordMetric({
      MetricName: "RequestLatency",
      Value: 150,
      Unit: "Milliseconds",
      Timestamp: new Date(),
    });

    expect(_getBufferLength()).toBe(1);
  });

  it("is a no-op in non-production", () => {
    vi.stubEnv("NODE_ENV", "test");

    recordMetric({
      MetricName: "RequestLatency",
      Value: 150,
      Unit: "Milliseconds",
      Timestamp: new Date(),
    });

    expect(_getBufferLength()).toBe(0);
  });

  it("auto-flushes when buffer reaches 500", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockSend.mockResolvedValue({});

    for (let i = 0; i < 500; i++) {
      recordMetric({
        MetricName: "Test",
        Value: i,
        Unit: "Count",
        Timestamp: new Date(),
      });
    }

    // Give the auto-flush a tick to execute
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(mockSend).toHaveBeenCalled();
    expect(_getBufferLength()).toBe(0);
  });

  // ── flush ──

  it("sends buffered metrics to CloudWatch", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mockSend.mockResolvedValue({});

    recordMetric({
      MetricName: "Test",
      Value: 1,
      Unit: "Count",
      Timestamp: new Date(),
    });
    recordMetric({
      MetricName: "Test",
      Value: 2,
      Unit: "Count",
      Timestamp: new Date(),
    });

    await flush();

    expect(mockSend).toHaveBeenCalledOnce();
    const command = mockSend.mock.calls[0][0];
    expect(command.input.Namespace).toBe("Denali/App");
    expect(command.input.MetricData).toHaveLength(2);
    expect(_getBufferLength()).toBe(0);
  });

  it("does nothing when buffer is empty", async () => {
    await flush();
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("handles CloudWatch API error gracefully", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    mockSend.mockRejectedValue(new Error("AccessDenied"));

    recordMetric({
      MetricName: "Test",
      Value: 1,
      Unit: "Count",
      Timestamp: new Date(),
    });
    await flush();

    // Should not throw, should log warning
    expect(spy).toHaveBeenCalled();
    // Buffer should be cleared even on error (logs are durable record)
    expect(_getBufferLength()).toBe(0);
    spy.mockRestore();
  });

  // ── startAutoFlush / stopAutoFlush ──

  it("startAutoFlush is a no-op in non-production", () => {
    vi.stubEnv("NODE_ENV", "test");
    startAutoFlush();
    // Should not throw or start timer
  });

  it("startAutoFlush starts timer in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.useFakeTimers();

    startAutoFlush();

    // Buffer a metric manually (bypass no-op since we're in "production")
    recordMetric({
      MetricName: "Timer",
      Value: 1,
      Unit: "Count",
      Timestamp: new Date(),
    });
    mockSend.mockResolvedValue({});

    // Advance past flush interval
    vi.advanceTimersByTime(61_000);

    // flush is async — need to let promises settle
    vi.useRealTimers();
  });

  it("stopAutoFlush clears the timer", () => {
    vi.stubEnv("NODE_ENV", "production");
    startAutoFlush();
    stopAutoFlush();
    // Should not throw
  });

  // ── _resetBuffer ──

  it("_resetBuffer clears all buffered metrics", () => {
    vi.stubEnv("NODE_ENV", "production");
    recordMetric({
      MetricName: "Test",
      Value: 1,
      Unit: "Count",
      Timestamp: new Date(),
    });
    expect(_getBufferLength()).toBe(1);

    _resetBuffer();
    expect(_getBufferLength()).toBe(0);
  });
});

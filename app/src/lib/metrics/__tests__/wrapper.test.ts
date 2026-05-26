import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * metrics/index.ts withMetrics — Unit Tests
 *
 * Tests the route handler wrapper for request timing.
 */

// Mock cloudwatch to prevent production checks
vi.mock("../cloudwatch", () => ({
  recordMetric: vi.fn(),
}));

import { NextRequest, NextResponse } from "next/server";
import { withMetrics } from "../index";
import { recordMetric } from "../cloudwatch";

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

describe("withMetrics", () => {
  it("returns the original response", async () => {
    const handler = vi
      .fn()
      .mockResolvedValue(NextResponse.json({ ok: true }, { status: 200 }));
    const wrapped = withMetrics(handler, "/api/test");
    const req = new NextRequest("http://localhost:3000/api/test");

    const res = await wrapped(req);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("logs request metric with correct fields", async () => {
    const handler = vi
      .fn()
      .mockResolvedValue(NextResponse.json({}, { status: 200 }));
    const wrapped = withMetrics(handler, "/api/profile");
    const req = new NextRequest("http://localhost:3000/api/profile");

    await wrapped(req);

    expect(logSpy).toHaveBeenCalled();
    const logCall = logSpy.mock.calls.find(
      (c: string[]) => c[0] === "[Metrics]",
    );
    expect(logCall).toBeTruthy();

    const json = JSON.parse(logCall![1] as string);
    expect(json._m).toBe("request");
    expect(json.route).toBe("/api/profile");
    expect(json.method).toBe("GET");
    expect(json.status).toBe(200);
    expect(json.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("records RequestLatency CloudWatch metric", async () => {
    const handler = vi
      .fn()
      .mockResolvedValue(NextResponse.json({}, { status: 200 }));
    const wrapped = withMetrics(handler, "/api/health");
    const req = new NextRequest("http://localhost:3000/api/health");

    await wrapped(req);

    expect(recordMetric).toHaveBeenCalledWith(
      expect.objectContaining({
        MetricName: "RequestLatency",
        Unit: "Milliseconds",
        Dimensions: [{ Name: "Route", Value: "/api/health" }],
      }),
    );
  });

  it("records ErrorCount on 5xx status", async () => {
    const handler = vi
      .fn()
      .mockResolvedValue(NextResponse.json({ error: "fail" }, { status: 500 }));
    const wrapped = withMetrics(handler, "/api/chat");
    const req = new NextRequest("http://localhost:3000/api/chat", {
      method: "POST",
    });

    await wrapped(req);

    const errorCall = (
      recordMetric as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any[]) => c[0]?.MetricName === "ErrorCount",
    );
    expect(errorCall).toBeTruthy();
    expect(errorCall![0]).toEqual(
      expect.objectContaining({
        MetricName: "ErrorCount",
        Value: 1,
        Unit: "Count",
      }),
    );
  });

  it("does NOT record ErrorCount on 4xx status", async () => {
    const handler = vi
      .fn()
      .mockResolvedValue(NextResponse.json({ error: "bad" }, { status: 400 }));
    const wrapped = withMetrics(handler, "/api/test");
    const req = new NextRequest("http://localhost:3000/api/test");

    await wrapped(req);

    const errorCall = (
      recordMetric as ReturnType<typeof vi.fn>
    ).mock.calls.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any[]) => c[0]?.MetricName === "ErrorCount",
    );
    expect(errorCall).toBeUndefined();
  });

  it("measures reasonable timing", async () => {
    const handler = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 20));
      return NextResponse.json({}, { status: 200 });
    });
    const wrapped = withMetrics(handler, "/api/slow");
    const req = new NextRequest("http://localhost:3000/api/slow");

    await wrapped(req);

    const logCall = logSpy.mock.calls.find(
      (c: string[]) => c[0] === "[Metrics]",
    );
    const json = JSON.parse(logCall![1] as string);
    expect(json.durationMs).toBeGreaterThanOrEqual(15); // allow small timing variance
    expect(json.durationMs).toBeLessThan(5000);
  });
});

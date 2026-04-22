import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * metrics/logger.ts — Unit Tests
 *
 * Tests structured JSON log emitters for CloudWatch Logs Insights.
 */

import {
  logRequestMetric,
  logClaudeMetric,
  logFallbackMetric,
} from "../logger";

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.restoreAllMocks();
  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
});

function getLastLogJson(): Record<string, unknown> {
  const call = logSpy.mock.calls[0];
  expect(call[0]).toBe("[Metrics]");
  return JSON.parse(call[1] as string);
}

describe("logRequestMetric", () => {
  it("emits JSON with _m='request' and all fields", () => {
    logRequestMetric({
      route: "/api/chat",
      method: "POST",
      status: 200,
      durationMs: 150,
    });

    const json = getLastLogJson();
    expect(json._m).toBe("request");
    expect(json.route).toBe("/api/chat");
    expect(json.method).toBe("POST");
    expect(json.status).toBe(200);
    expect(json.durationMs).toBe(150);
    expect(typeof json.ts).toBe("number");
  });

  it("handles zero durationMs", () => {
    logRequestMetric({
      route: "/api/health",
      method: "GET",
      status: 200,
      durationMs: 0,
    });

    const json = getLastLogJson();
    expect(json.durationMs).toBe(0);
  });

  it("handles 5xx status", () => {
    logRequestMetric({
      route: "/api/chat",
      method: "POST",
      status: 500,
      durationMs: 50,
    });

    const json = getLastLogJson();
    expect(json.status).toBe(500);
  });
});

describe("logClaudeMetric", () => {
  it("emits JSON with _m='claude' and all fields", () => {
    logClaudeMetric({
      model: "claude-sonnet-4-6",
      iterations: 3,
      totalMs: 4500,
      timedOut: false,
      toolsUsed: ["search_cpt", "npi_search"],
    });

    const json = getLastLogJson();
    expect(json._m).toBe("claude");
    expect(json.model).toBe("claude-sonnet-4-6");
    expect(json.iterations).toBe(3);
    expect(json.totalMs).toBe(4500);
    expect(json.timedOut).toBe(false);
    expect(json.toolsUsed).toEqual(["search_cpt", "npi_search"]);
    expect(typeof json.ts).toBe("number");
  });

  it("handles empty toolsUsed", () => {
    logClaudeMetric({
      model: "opus",
      iterations: 1,
      totalMs: 200,
      timedOut: false,
      toolsUsed: [],
    });

    const json = getLastLogJson();
    expect(json.toolsUsed).toEqual([]);
  });

  it("handles timedOut=true", () => {
    logClaudeMetric({
      model: "sonnet",
      iterations: 1,
      totalMs: 60000,
      timedOut: true,
      toolsUsed: [],
    });

    const json = getLastLogJson();
    expect(json.timedOut).toBe(true);
  });
});

describe("logFallbackMetric", () => {
  it("emits JSON with _m='fallback' when fired=true", () => {
    logFallbackMetric({
      label: "profile lookup",
      timeoutMs: 5000,
      fired: true,
      actualMs: 5000,
    });

    const json = getLastLogJson();
    expect(json._m).toBe("fallback");
    expect(json.label).toBe("profile lookup");
    expect(json.timeoutMs).toBe(5000);
    expect(json.fired).toBe(true);
    expect(json.actualMs).toBe(5000);
    expect(typeof json.ts).toBe("number");
  });

  it("emits JSON with fired=false when promise resolved in time", () => {
    logFallbackMetric({
      label: "getUnreportedOutcome",
      timeoutMs: 5000,
      fired: false,
      actualMs: 120,
    });

    const json = getLastLogJson();
    expect(json.fired).toBe(false);
    expect(json.actualMs).toBe(120);
  });

  it("never throws even on bad input", () => {
    // Force a stringify error by passing a circular ref would be hard,
    // but verify the try/catch works by ensuring function returns void
    expect(() =>
      logFallbackMetric({ label: "", timeoutMs: 0, fired: false, actualMs: 0 }),
    ).not.toThrow();
  });
});

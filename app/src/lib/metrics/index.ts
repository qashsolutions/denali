/**
 * App-Level Metrics — Barrel + withMetrics HOF
 *
 * Re-exports structured log emitters and CloudWatch buffer.
 * Provides withMetrics() wrapper for route handlers.
 */

import type { NextRequest } from "next/server";
import { logRequestMetric } from "./logger";
import { recordMetric } from "./cloudwatch";

export { logRequestMetric, logClaudeMetric, logFallbackMetric } from "./logger";
export {
  recordMetric,
  flush,
  startAutoFlush,
  stopAutoFlush,
  _getBufferLength,
  _resetBuffer,
} from "./cloudwatch";

type RouteHandler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

/**
 * Wrap a Next.js route handler with request timing metrics.
 * Logs structured JSON for CloudWatch Logs Insights and pushes
 * RequestLatency + ErrorCount to CloudWatch custom metrics.
 *
 * Usage:
 *   const _POST = async (request: NextRequest) => { ... };
 *   export const POST = withMetrics(_POST, "/api/chat");
 */
export function withMetrics(
  handler: RouteHandler,
  route: string,
): RouteHandler {
  return async (req, ctx) => {
    const start = Date.now();
    const response = await handler(req, ctx);
    const durationMs = Date.now() - start;
    const status = response.status;
    const method = req.method;

    // Structured log (always, sync)
    logRequestMetric({ route, method, status, durationMs });

    // CloudWatch custom metric (buffered, fire-and-forget, prod-only)
    recordMetric({
      MetricName: "RequestLatency",
      Dimensions: [{ Name: "Route", Value: route }],
      Value: durationMs,
      Unit: "Milliseconds",
      Timestamp: new Date(),
    });

    if (status >= 500) {
      recordMetric({
        MetricName: "ErrorCount",
        Dimensions: [{ Name: "Route", Value: route }],
        Value: 1,
        Unit: "Count",
        Timestamp: new Date(),
      });
    }

    return response;
  };
}

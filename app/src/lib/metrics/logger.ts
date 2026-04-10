/**
 * Structured Metric Log Emitters
 *
 * Emits JSON-structured metrics to stdout (captured by ECS → CloudWatch Logs).
 * Each function is synchronous, never throws, and fire-and-forget.
 *
 * The `_m` discriminator enables CloudWatch Logs Insights filtering:
 *   filter @message like "[Metrics]" | parse @message '"_m":"request"' ...
 */

// ── Types ──

export interface RequestMetricData {
  route: string;
  method: string;
  status: number;
  durationMs: number;
}

export interface ClaudeMetricData {
  model: string;
  iterations: number;
  totalMs: number;
  timedOut: boolean;
  toolsUsed: string[];
}

export interface FallbackMetricData {
  label: string;
  timeoutMs: number;
  fired: boolean; // true = fallback used, false = promise resolved in time
  actualMs: number;
}

// ── Emitters ──

export function logRequestMetric(data: RequestMetricData): void {
  try {
    console.log(
      "[Metrics]",
      JSON.stringify({ _m: "request", ...data, ts: Date.now() }),
    );
  } catch {
    // Never throw from metrics
  }
}

export function logClaudeMetric(data: ClaudeMetricData): void {
  try {
    console.log(
      "[Metrics]",
      JSON.stringify({ _m: "claude", ...data, ts: Date.now() }),
    );
  } catch {
    // Never throw from metrics
  }
}

export function logFallbackMetric(data: FallbackMetricData): void {
  try {
    console.log(
      "[Metrics]",
      JSON.stringify({ _m: "fallback", ...data, ts: Date.now() }),
    );
  } catch {
    // Never throw from metrics
  }
}

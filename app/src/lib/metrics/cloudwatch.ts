/**
 * CloudWatch Custom Metrics — Buffer + Flush
 *
 * Buffers metric datapoints in memory and flushes to CloudWatch Metrics
 * periodically (60s) or when buffer reaches 500 entries.
 * No-op in non-production environments.
 *
 * Namespace: process.env.METRIC_NAMESPACE (default "Denali/App").
 *   Prod task def: unset → falls back to "Denali/App"
 *   Staging task def: set to "Denali/Staging"
 *   IAM grants are scoped per-namespace (denali-task-policy → Denali/App,
 *   denali-staging-runtime → Denali/Staging).
 *
 * Requires IAM permission: cloudwatch:PutMetricData (namespace-scoped).
 *
 * State (buffer/timer/client) is held on globalThis under a Symbol.for key
 * so that Turbopack's multiple module instantiations (instrumentation's
 * dynamic import vs route handlers' static imports) share a single buffer.
 * Without this, the timer flushes an empty buffer while requests push to a
 * different one — silent metric loss.
 */

import {
  CloudWatchClient,
  PutMetricDataCommand,
  type MetricDatum,
} from "@aws-sdk/client-cloudwatch";

const FLUSH_INTERVAL_MS = 60_000;
const MAX_BUFFER_SIZE = 500;
const CW_BATCH_LIMIT = 1000; // AWS PutMetricData max per call

type MetricsState = {
  buffer: MetricDatum[];
  flushTimer: ReturnType<typeof setInterval> | null;
  cwClient: CloudWatchClient | null;
};

const GLOBAL_KEY = Symbol.for("denali.metrics.cloudwatch.state");
type GlobalWithMetrics = typeof globalThis & {
  [GLOBAL_KEY]?: MetricsState;
};
const globalScope = globalThis as GlobalWithMetrics;
if (!globalScope[GLOBAL_KEY]) {
  globalScope[GLOBAL_KEY] = {
    buffer: [],
    flushTimer: null,
    cwClient: null,
  };
}
const state: MetricsState = globalScope[GLOBAL_KEY];

function getClient(): CloudWatchClient {
  if (!state.cwClient) {
    state.cwClient = new CloudWatchClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
  }
  return state.cwClient;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}

/**
 * Buffer a metric datapoint. Fire-and-forget — never throws.
 * No-op in non-production environments.
 */
export function recordMetric(datum: MetricDatum): void {
  if (!isProduction()) return;

  state.buffer.push(datum);

  // Auto-flush when buffer is full
  if (state.buffer.length >= MAX_BUFFER_SIZE) {
    flush().catch(() => {});
  }
}

/**
 * Flush buffered metrics to CloudWatch. Clears the buffer.
 */
export async function flush(): Promise<void> {
  if (state.buffer.length === 0) return;

  const toFlush = state.buffer.splice(0);

  // Batch into chunks of 1000 (CW limit)
  for (let i = 0; i < toFlush.length; i += CW_BATCH_LIMIT) {
    const chunk = toFlush.slice(i, i + CW_BATCH_LIMIT);
    try {
      await getClient().send(
        new PutMetricDataCommand({
          Namespace: process.env.METRIC_NAMESPACE || "Denali/App",
          MetricData: chunk,
        }),
      );
    } catch (err) {
      console.warn("[Metrics] CloudWatch flush failed:", err);
      // Don't re-buffer — structured logs are the durable record
    }
  }
}

/**
 * Start periodic auto-flush timer. Call once at boot.
 */
export function startAutoFlush(): void {
  // [DIAG] Temporary diagnostics — see P7-METRICS-FIX-PHASE-1.
  console.log("[cloudwatch] startAutoFlush invoked", {
    hasExistingTimer: !!state.flushTimer,
    nodeEnv: process.env.NODE_ENV,
    isProductionResult: isProduction(),
  });
  if (state.flushTimer) return;
  if (!isProduction()) return;
  console.log("[cloudwatch] starting setInterval", {
    FLUSH_INTERVAL_MS,
  });

  state.flushTimer = setInterval(() => {
    console.log("[cloudwatch] flush timer tick", {
      bufferLength: state.buffer.length,
    });
    flush().catch((e) => console.warn("[cloudwatch] timer flush rejected:", e));
  }, FLUSH_INTERVAL_MS);

  // Don't keep Node.js alive just for metrics
  if (
    state.flushTimer &&
    typeof state.flushTimer === "object" &&
    "unref" in state.flushTimer
  ) {
    state.flushTimer.unref();
  }

  // Flush on graceful shutdown (Node.js only — not available in Edge Runtime)
  if (typeof process !== "undefined" && typeof process.on === "function") {
    process.on("SIGTERM", async () => {
      await flush();
      stopAutoFlush();
    });
  }
}

/**
 * Stop the auto-flush timer.
 */
export function stopAutoFlush(): void {
  if (state.flushTimer) {
    clearInterval(state.flushTimer);
    state.flushTimer = null;
  }
}

// ── Test helpers ──

export function _getBufferLength(): number {
  return state.buffer.length;
}

export function _resetBuffer(): void {
  state.buffer = [];
}

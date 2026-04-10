/**
 * CloudWatch Custom Metrics — Buffer + Flush
 *
 * Buffers metric datapoints in memory and flushes to CloudWatch Metrics
 * periodically (60s) or when buffer reaches 500 entries.
 * No-op in non-production environments.
 *
 * Namespace: Denali/App
 * Requires IAM permission: cloudwatch:PutMetricData
 */

import {
  CloudWatchClient,
  PutMetricDataCommand,
  type MetricDatum,
} from "@aws-sdk/client-cloudwatch";

const NAMESPACE = "Denali/App";
const FLUSH_INTERVAL_MS = 60_000;
const MAX_BUFFER_SIZE = 500;
const CW_BATCH_LIMIT = 1000; // AWS PutMetricData max per call

let buffer: MetricDatum[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let cwClient: CloudWatchClient | null = null;

function getClient(): CloudWatchClient {
  if (!cwClient) {
    cwClient = new CloudWatchClient({
      region: process.env.AWS_REGION || "us-east-1",
    });
  }
  return cwClient;
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

  buffer.push(datum);

  // Auto-flush when buffer is full
  if (buffer.length >= MAX_BUFFER_SIZE) {
    flush().catch(() => {});
  }
}

/**
 * Flush buffered metrics to CloudWatch. Clears the buffer.
 */
export async function flush(): Promise<void> {
  if (buffer.length === 0) return;

  const toFlush = buffer.splice(0);

  // Batch into chunks of 1000 (CW limit)
  for (let i = 0; i < toFlush.length; i += CW_BATCH_LIMIT) {
    const chunk = toFlush.slice(i, i + CW_BATCH_LIMIT);
    try {
      await getClient().send(
        new PutMetricDataCommand({
          Namespace: NAMESPACE,
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
  if (flushTimer) return;
  if (!isProduction()) return;

  flushTimer = setInterval(() => {
    flush().catch(() => {});
  }, FLUSH_INTERVAL_MS);

  // Don't keep Node.js alive just for metrics
  if (flushTimer && typeof flushTimer === "object" && "unref" in flushTimer) {
    flushTimer.unref();
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
  if (flushTimer) {
    clearInterval(flushTimer);
    flushTimer = null;
  }
}

// ── Test helpers ──

export function _getBufferLength(): number {
  return buffer.length;
}

export function _resetBuffer(): void {
  buffer = [];
}

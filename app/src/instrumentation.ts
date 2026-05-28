/**
 * Next.js Instrumentation — Server Boot Hook
 *
 * Called once when the server starts. Used to initialize
 * the CloudWatch metrics auto-flush timer.
 */

export async function register() {
  // [DIAG] Temporary diagnostics — see P7-METRICS-FIX-PHASE-1. Remove once
  // the publish-path-silent root cause is confirmed and the real fix lands.
  console.log("[instrumentation] register() called", {
    hasProcess: typeof process !== "undefined",
    hasNodeVersion: !!(typeof process !== "undefined" && process.versions?.node),
    nodeEnv: typeof process !== "undefined" ? process.env.NODE_ENV : "no-process",
  });
  // Detect Node.js runtime via process.versions.node (set by Node, absent in Edge).
  // Avoids the NEXT_RUNTIME env-var guard, which Turbopack doesn't inject in Next.js 16.
  if (typeof process !== "undefined" && process.versions?.node) {
    const { startAutoFlush } = await import("@/lib/metrics/cloudwatch");
    console.log("[instrumentation] cloudwatch module imported");
    startAutoFlush();
    console.log("[instrumentation] startAutoFlush returned");
  }
}

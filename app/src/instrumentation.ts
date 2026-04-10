/**
 * Next.js Instrumentation — Server Boot Hook
 *
 * Called once when the server starts. Used to initialize
 * the CloudWatch metrics auto-flush timer.
 */

export async function register() {
  // Only run in Node.js runtime, not Edge Runtime
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startAutoFlush } = await import("@/lib/metrics/cloudwatch");
    startAutoFlush();
  }
}

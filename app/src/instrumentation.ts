/**
 * Next.js Instrumentation — Server Boot Hook
 *
 * Called once when the server starts. Used to initialize
 * the CloudWatch metrics auto-flush timer.
 */

export async function register() {
  if (typeof window === "undefined") {
    const { startAutoFlush } = await import("@/lib/metrics/cloudwatch");
    startAutoFlush();
  }
}

/**
 * Next.js Instrumentation — Server Boot Hook
 *
 * Called once when the server starts. Used to initialize
 * the CloudWatch metrics auto-flush timer.
 */

export async function register() {
  // Detect Node.js runtime via process.versions.node (set by Node, absent in Edge).
  // Avoids the NEXT_RUNTIME env-var guard, which Turbopack doesn't inject in Next.js 16.
  if (typeof process !== "undefined" && process.versions?.node) {
    const { startAutoFlush } = await import("@/lib/metrics/cloudwatch");
    startAutoFlush();
  }
}

import { NextResponse, type NextRequest } from "next/server";
import { query } from "@/lib/db";
import { withMetrics } from "@/lib/metrics";

/**
 * GET /api/health
 * ALB health check endpoint. Returns 200 only when the app AND RDS are reachable.
 * Checked every 30s by the ALB target group and Docker HEALTHCHECK.
 *
 * If RDS is unreachable the ALB will stop routing traffic to this container,
 * which is the correct behavior — almost every API route needs the database.
 */
async function _GET() {
  try {
    await query("SELECT 1");
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch {
    return NextResponse.json(
      { status: "degraded", reason: "database unreachable" },
      { status: 503 },
    );
  }
}

export const GET = withMetrics(_GET, "/api/health");

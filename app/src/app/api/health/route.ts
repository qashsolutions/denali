import { NextResponse } from "next/server";

/**
 * GET /api/health
 * ALB health check endpoint. Returns 200 when the app is running.
 * Checked every 30s by the ALB target group and Docker HEALTHCHECK.
 */
export async function GET() {
  return NextResponse.json({ status: "ok" }, { status: 200 });
}

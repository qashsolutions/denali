/**
 * Health Report Route
 *
 * GET /api/health-report — returns latest report for authenticated user
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { withMetrics } from "@/lib/metrics";
import { AUTH, SYSTEM } from "@/config/messages";

async function _GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: AUTH.SIGN_IN_REQUIRED },
        { status: 401 },
      );
    }

    const result = await query<{
      id: string;
      share_token: string;
      status: string;
      report_data: unknown;
      expires_at: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT id, share_token, status, report_data, expires_at, created_at, updated_at
       FROM health_reports
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [user.userId],
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ report: null });
    }

    const row = result.rows[0];
    return NextResponse.json({
      report: {
        id: row.id,
        shareToken: row.share_token,
        status: row.status,
        data: row.status === "ready" ? row.report_data : null,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  } catch (error) {
    console.error("[HealthReport] GET error:", error);
    return NextResponse.json({ error: SYSTEM.LOAD_REPORT }, { status: 500 });
  }
}

export const GET = withMetrics(_GET, "/api/health-report");

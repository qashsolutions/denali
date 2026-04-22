/**
 * Health Report by ID
 *
 * GET /api/health-report/[id] — returns specific report (must belong to user)
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { AUTH, SYSTEM } from "@/config/messages";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json({ error: AUTH.SIGN_IN_REQUIRED }, { status: 401 });
    }

    const { id } = await params;

    const result = await query<{
      id: string;
      share_token: string;
      status: string;
      report_data: unknown;
      expires_at: string;
      created_at: string;
    }>(
      `SELECT id, share_token, status, report_data, expires_at, created_at
       FROM health_reports
       WHERE id = $1 AND user_id = $2`,
      [id, user.userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ error: SYSTEM.REPORT_NOT_FOUND }, { status: 404 });
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
      },
    });
  } catch (error) {
    console.error("[HealthReport] GET by ID error:", error);
    return NextResponse.json({ error: SYSTEM.LOAD_REPORT }, { status: 500 });
  }
}

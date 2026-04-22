/**
 * Public Share Route
 *
 * GET /api/health-report/share/[token] — PUBLIC, no auth required
 *
 * Looks up report by share_token where not expired and status = 'ready'.
 * Returns report data without any user PII (age/gender only, as in report).
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { SYSTEM } from "@/config/messages";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    const result = await query<{
      id: string;
      report_data: unknown;
      expires_at: string;
      created_at: string;
    }>(
      `SELECT id, report_data, expires_at, created_at
       FROM health_reports
       WHERE share_token = $1 AND expires_at > NOW() AND status = 'ready'`,
      [token]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: SYSTEM.REPORT_NOT_FOUND },
        { status: 404 }
      );
    }

    const row = result.rows[0];

    // Audit log — no userId since this is public
    logAudit("REPORT_SHARED_ACCESS", {
      resourceType: "ehr_connection",
      resourceId: row.id,
      metadata: { shareToken: token },
      request,
    }).catch(() => {});

    return NextResponse.json({
      report: {
        data: row.report_data,
        expiresAt: row.expires_at,
        createdAt: row.created_at,
      },
    });
  } catch (error) {
    console.error("[HealthReport] Share error:", error);
    return NextResponse.json({ error: SYSTEM.LOAD_REPORT }, { status: 500 });
  }
}

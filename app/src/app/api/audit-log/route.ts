/**
 * Audit Log API Route
 *
 * GET /api/audit-log?page=1&limit=20
 *
 * Returns paginated audit log entries for the authenticated user.
 * Uses Cognito JWT auth + RDS PostgreSQL.
 * IP addresses are masked for privacy (last two octets hidden).
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";

const ACTION_LABELS: Record<string, string> = {
  FHIR_CONNECT: "Connected Medicare account",
  FHIR_DISCONNECT: "Disconnected Medicare account",
  FHIR_DATA_ACCESS: "Accessed Medicare health data",
  FHIR_TOKEN_REFRESH: "Refreshed Medicare connection",
  APPEAL_GENERATED: "Generated an appeal letter",
  APPEAL_OUTCOME: "Recorded appeal outcome",
  ACCOUNT_DELETE: "Deleted account",
  CONSENT_UPDATE: "Updated privacy preferences",
  MFA_ENROLL: "Enrolled authenticator app",
  MFA_CHALLENGE: "Completed authenticator verification",
  PAYMENT_CHECKOUT: "Started payment checkout",
  PAYMENT_COMPLETED: "Payment completed",
  SUBSCRIPTION_UPDATED: "Subscription updated",
  SUBSCRIPTION_CANCELLED: "Subscription cancelled",
  TRIAL_STARTED: "Started free trial",
  SIGN_IN: "Signed in",
  SIGN_OUT: "Signed out",
};

function maskIp(ip: string | null): string | null {
  if (!ip) return null;
  // IPv4: mask last two octets
  const parts = ip.split(".");
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.*.*`;
  }
  // IPv6 or other: mask entirely
  return "***";
}

function getActionLabel(action: string): string {
  return ACTION_LABELS[action] || action.replace(/_/g, " ").toLowerCase();
}

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ authenticated: false, logs: [] });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  try {
    // Try grouped RPC first
    type GroupedRow = {
      action: string;
      resource_type: string | null;
      ip_address: string | null;
      latest_at: string;
      log_date: string;
      entry_count: number;
    };

    const rpcResult = await query<GroupedRow>(
      `SELECT * FROM get_grouped_audit_logs($1, $2, $3)`,
      [user.userId, limit, offset]
    );

    const grouped = rpcResult.rows.map((row) => ({
      id: `${row.action}-${row.log_date}`,
      action: row.action,
      description: getActionLabel(row.action),
      resourceType: row.resource_type,
      createdAt: row.latest_at,
      ipAddress: maskIp(row.ip_address),
      count: row.entry_count,
    }));

    return NextResponse.json({
      authenticated: true,
      logs: grouped,
      total: grouped.length,
      page,
      hasMore: grouped.length === limit,
    });
  } catch {
    // Fallback: ungrouped query if RPC doesn't exist yet
    try {
      type LogRow = { id: string; action: string; resource_type: string | null; ip_address: string | null; created_at: string };
      const logsResult = await query<LogRow>(
        `SELECT id, action, resource_type, ip_address, created_at
         FROM audit_logs
         WHERE user_id = $1
         ORDER BY created_at DESC
         LIMIT $2 OFFSET $3`,
        [user.userId, limit, offset]
      );

      const result = logsResult.rows.map((log) => ({
        id: log.id,
        action: log.action,
        description: getActionLabel(log.action),
        resourceType: log.resource_type,
        createdAt: log.created_at,
        ipAddress: maskIp(log.ip_address),
        count: 1,
      }));

      return NextResponse.json({ authenticated: true, logs: result, total: result.length, page, hasMore: false });
    } catch (fallbackError) {
      console.error("[Audit Log API] Error fetching logs:", fallbackError);
      return NextResponse.json({ authenticated: true, logs: [], total: 0, page, hasMore: false });
    }
  }
}

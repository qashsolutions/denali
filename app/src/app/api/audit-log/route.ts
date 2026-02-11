/**
 * Audit Log API Route
 *
 * GET /api/audit-log?page=1&limit=20
 *
 * Returns paginated audit log entries for the authenticated user.
 * Uses server-side Supabase client (cookie-authenticated).
 * IP addresses are masked for privacy (last two octets hidden).
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase-server";

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
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ authenticated: false, logs: [] });
  }

  const { searchParams } = request.nextUrl;
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
  const offset = (page - 1) * limit;

  // Get total count
  const { count } = await supabase
    .from("audit_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  const total = count || 0;

  // Get paginated logs
  const { data: logs, error } = await supabase
    .from("audit_logs")
    .select("id, action, resource_type, ip_address, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    console.error("[Audit Log API] Error fetching logs:", error.message);
    return NextResponse.json({ authenticated: true, logs: [], total: 0, page, hasMore: false });
  }

  const result = (logs || []).map((log) => ({
    id: log.id,
    action: log.action,
    description: getActionLabel(log.action),
    resourceType: log.resource_type,
    createdAt: log.created_at,
    ipAddress: maskIp(log.ip_address),
  }));

  return NextResponse.json({
    authenticated: true,
    logs: result,
    total,
    page,
    hasMore: offset + limit < total,
  });
}

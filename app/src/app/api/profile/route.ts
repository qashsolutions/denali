/**
 * Profile API Route
 *
 * GET /api/profile
 *
 * Returns the authenticated user's profile (plan, role, is_admin, appeal count).
 * Auth via Cognito JWT; data from RDS PostgreSQL.
 */

import { NextResponse, type NextRequest } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  const [profileResult, usageResult] = await Promise.all([
    query<{ plan: string; role: string; is_admin: boolean }>(
      `SELECT plan, role, is_admin FROM users WHERE id = $1 LIMIT 1`,
      [user.userId]
    ),
    query<{ appeal_count: number; appeal_credits: number }>(
      `SELECT appeal_count, appeal_credits FROM usage WHERE email = $1 LIMIT 1`,
      [user.email]
    ),
  ]);

  const profile = profileResult.rows[0];
  const usage = usageResult.rows[0];

  return NextResponse.json({
    authenticated: true,
    plan: profile?.plan || "trial",
    role: profile?.role || "patient",
    isAdmin: profile?.is_admin || false,
    appealCount: usage?.appeal_count || 0,
    appealCredits: usage?.appeal_credits || 0,
  });
}

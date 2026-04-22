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
import { withMetrics } from "@/lib/metrics";

async function _GET(request: NextRequest) {
  const user = await getAuthUser(request);

  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  const [profileResult, usageResult, verificationResult] = await Promise.all([
    query<{ plan: string; role: string; is_admin: boolean }>(
      `SELECT plan, role, is_admin FROM users WHERE id = $1 LIMIT 1`,
      [user.userId],
    ),
    query<{ appeal_count: number; appeal_credits: number }>(
      `SELECT appeal_count, appeal_credits FROM usage WHERE email = $1 LIMIT 1`,
      [user.email],
    ),
    query<{
      idme_verified: boolean;
      idme_first_name: string | null;
      idme_gender: string | null;
    }>(
      `SELECT COALESCE(idme_verified, false) as idme_verified, idme_first_name, idme_gender FROM user_verification WHERE user_id = $1 LIMIT 1`,
      [user.userId],
    ),
  ]);

  const profile = profileResult.rows[0];
  const usage = usageResult.rows[0];
  const verification = verificationResult.rows[0];

  return NextResponse.json({
    authenticated: true,
    userId: user.userId,
    email: user.email,
    plan: profile?.plan || "trial",
    role: profile?.role || "patient",
    isAdmin: profile?.is_admin || false,
    appealCount: usage?.appeal_count || 0,
    appealCredits: usage?.appeal_credits || 0,
    idmeVerified: verification?.idme_verified || false,
    firstName: verification?.idme_first_name || null,
    gender: verification?.idme_gender || null,
    // Feature flag: whether app requires ID.me identity verification before Blue Button
    // false = Connected Apps Directory (BB works without ID.me)
    // true = Medicare App Library (ID.me required before BB)
    requireIdentityVerification:
      process.env.REQUIRE_IDENTITY_VERIFICATION === "true",
  });
}

export const GET = withMetrics(_GET, "/api/profile");

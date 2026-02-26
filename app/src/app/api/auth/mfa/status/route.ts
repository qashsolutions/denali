/**
 * GET /api/auth/mfa/status
 *
 * Returns whether TOTP MFA is enrolled for the current user.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";

export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const result = await query<{ totp_enrolled_at: string | null }>(
    `SELECT totp_enrolled_at FROM user_verification WHERE user_id = $1 LIMIT 1`,
    [user.userId]
  );

  return NextResponse.json({
    enrolled: !!result.rows[0]?.totp_enrolled_at,
  });
}

/**
 * POST /api/auth/mfa/unenroll
 *
 * Removes TOTP enrollment for the current user.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  await query(
    `UPDATE user_verification
     SET totp_secret = NULL, totp_enrolled_at = NULL
     WHERE user_id = $1`,
    [user.userId]
  );

  const response = NextResponse.json({ success: true });
  // Clear AAL2 cookie
  response.cookies.set("mfa_verified", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}

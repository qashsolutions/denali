/**
 * POST /api/auth/mfa/challenge
 *
 * Verifies a TOTP code during sign-in (AAL2 challenge).
 * Sets the mfa_verified cookie on success.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { verifyTotp } from "@/lib/totp";
import { AUTH } from "@/config/messages";

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: AUTH.SIGN_IN_REQUIRED }, { status: 401 });

  const body = await request.json();
  const code = (body.code as string | undefined)?.trim();

  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: AUTH.MFA_CODE_REQUIRED }, { status: 400 });
  }

  const result = await query<{ totp_secret: string | null; totp_enrolled_at: string | null }>(
    `SELECT totp_secret, totp_enrolled_at FROM user_verification WHERE user_id = $1 LIMIT 1`,
    [user.userId]
  );
  const ver = result.rows[0];

  if (!ver?.totp_secret || !ver.totp_enrolled_at) {
    return NextResponse.json(
      { error: AUTH.MFA_NOT_ENROLLED },
      { status: 400 }
    );
  }

  if (!verifyTotp(ver.totp_secret, code)) {
    return NextResponse.json({ error: AUTH.OTP_INVALID }, { status: 400 });
  }

  // Grant AAL2
  const response = NextResponse.json({ success: true, aal: "aal2" });
  response.cookies.set("mfa_verified", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour
  });

  return response;
}

/**
 * POST /api/auth/mfa/confirm
 *
 * Completes TOTP enrollment by verifying the first code from the authenticator app.
 * Sets totp_enrolled_at to confirm the secret is correct.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { verifyTotp } from "@/lib/totp";

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const code = (body.code as string | undefined)?.trim();

  if (!code || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: "A 6-digit code is required" }, { status: 400 });
  }

  // Get pending secret
  const result = await query<{ totp_secret: string | null }>(
    `SELECT totp_secret FROM user_verification WHERE user_id = $1 LIMIT 1`,
    [user.userId]
  );
  const secret = result.rows[0]?.totp_secret;

  if (!secret) {
    return NextResponse.json(
      { error: "No pending enrollment. Please start enrollment first." },
      { status: 400 }
    );
  }

  if (!verifyTotp(secret, code)) {
    return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 400 });
  }

  // Mark enrolled
  await query(
    `UPDATE user_verification SET totp_enrolled_at = $1 WHERE user_id = $2`,
    [new Date().toISOString(), user.userId]
  );

  // Set mfa_verified cookie (AAL2)
  const response = NextResponse.json({ success: true });
  response.cookies.set("mfa_verified", "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60, // 1 hour
  });

  return response;
}

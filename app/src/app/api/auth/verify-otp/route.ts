/**
 * POST /api/auth/verify-otp
 *
 * Step 2 of email OTP sign-in.
 * - Verifies the OTP against user_verification
 * - Calls Cognito AdminInitiateAuth to get JWT tokens
 * - Sets httpOnly access_token + refresh_token cookies
 * - Returns { success, mfaRequired, user }
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { initiateCognitoAuth } from "@/lib/auth-server";
import { logAudit } from "@/lib/audit";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email as string | undefined)?.toLowerCase().trim();
    const otp = (body.otp as string | undefined)?.trim();

    if (!email || !otp) {
      return NextResponse.json({ error: "Email and code are required" }, { status: 400 });
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json({ error: "Code must be 6 digits" }, { status: 400 });
    }

    // 1. Look up user + OTP from DB
    const verResult = await query<{
      user_id: string;
      otp_code: string | null;
      otp_expires_at: string | null;
      totp_enrolled_at: string | null;
    }>(
      `SELECT uv.user_id, uv.otp_code, uv.otp_expires_at, uv.totp_enrolled_at
       FROM user_verification uv
       JOIN users u ON u.id = uv.user_id
       WHERE u.email = $1
       LIMIT 1`,
      [email]
    );
    const ver = verResult.rows[0] ?? null;

    if (!ver || !ver.otp_code) {
      return NextResponse.json({ error: "No verification code found. Please request a new code." }, { status: 400 });
    }

    // 2. Check expiry
    if (!ver.otp_expires_at || new Date(ver.otp_expires_at) < new Date()) {
      return NextResponse.json({ error: "Code has expired. Please request a new code." }, { status: 400 });
    }

    // 3. Check OTP matches
    if (ver.otp_code !== otp) {
      return NextResponse.json({ error: "Invalid code. Please try again." }, { status: 400 });
    }

    // 4. Authenticate with Cognito → get tokens
    let tokens;
    try {
      tokens = await initiateCognitoAuth(email, `Otp.${otp}!`);
    } catch (cognitoErr) {
      console.error("[verify-otp] Cognito auth failed:", cognitoErr);
      return NextResponse.json({ error: "Authentication failed. Please request a new code." }, { status: 400 });
    }

    // 5. Invalidate OTP (clear code, mark email verified)
    await query(
      `UPDATE user_verification
       SET otp_code = NULL, otp_expires_at = NULL, email_verified = true, email_verified_at = $1
       WHERE user_id = $2`,
      [new Date().toISOString(), ver.user_id]
    );

    // 6. Initialize usage record with 1 appeal credit on first sign-in
    await query(
      `INSERT INTO usage (user_id, email, appeal_count, appeal_credits)
       VALUES ($1, $2, 0, 1)
       ON CONFLICT (email) DO NOTHING`,
      [ver.user_id, email]
    );

    // 7. Start trial on first sign-in (ignore 409 conflict if already started)
    fetch(`${request.nextUrl.origin}/api/trial`, {
      method: "POST",
      headers: { Cookie: `access_token=${tokens.accessToken}` },
    }).catch(() => {});

    logAudit("LOGIN", {
      userId: ver.user_id,
      metadata: { method: "email_otp" },
    }).catch(() => {});

    // 8. Build response with httpOnly cookies
    const isMfaRequired = !!ver.totp_enrolled_at;
    const response = NextResponse.json({
      success: true,
      mfaRequired: isMfaRequired,
      user: { email, userId: ver.user_id },
    });

    const isProduction = process.env.NODE_ENV === "production";
    const cookieOpts = {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax" as const,
      path: "/",
    };

    response.cookies.set("access_token", tokens.accessToken, {
      ...cookieOpts,
      maxAge: tokens.expiresIn,
    });
    response.cookies.set("refresh_token", tokens.refreshToken, {
      ...cookieOpts,
      maxAge: 30 * 24 * 60 * 60, // 30 days
    });

    // Clear any stale MFA verified cookie on fresh login
    response.cookies.set("mfa_verified", "", { ...cookieOpts, maxAge: 0 });

    return response;
  } catch (error) {
    console.error("[verify-otp] Error:", error);
    return NextResponse.json({ error: "Verification failed. Please try again." }, { status: 500 });
  }
}

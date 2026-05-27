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
import { initiateCognitoAuth, isEmailAllowed } from "@/lib/auth-server";
import { logAudit } from "@/lib/audit";
import { PRICING } from "@/config";
import { normalizeEmail } from "@/lib/normalize-email";
import { withMetrics } from "@/lib/metrics";
import { AUTH, VALIDATION } from "@/config/messages";

/** In-memory rate limiter for OTP verification: max 5 attempts per email per 10 min */
const otpVerifyLimits = new Map<string, { count: number; resetAt: number }>();
const OTP_VERIFY_WINDOW_MS = 10 * 60 * 1000;
const OTP_VERIFY_MAX_ATTEMPTS = 5;

function checkOtpVerifyLimit(email: string): boolean {
  const now = Date.now();
  const entry = otpVerifyLimits.get(email);
  if (!entry || now > entry.resetAt) {
    otpVerifyLimits.set(email, {
      count: 1,
      resetAt: now + OTP_VERIFY_WINDOW_MS,
    });
    return true;
  }
  if (entry.count >= OTP_VERIFY_MAX_ATTEMPTS) return false;
  entry.count++;
  return true;
}

async function _POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawEmail = (body.email as string | undefined)?.toLowerCase().trim();
    const otp = (body.otp as string | undefined)?.trim();

    if (!rawEmail || !otp) {
      return NextResponse.json(
        { error: VALIDATION.CODE_REQUIRED },
        { status: 400 },
      );
    }

    if (!/^\d{6}$/.test(otp)) {
      return NextResponse.json(
        { error: VALIDATION.CODE_FORMAT },
        { status: 400 },
      );
    }

    // Staging email allowlist (no-op when STAGING_EMAIL_ALLOWLIST is unset in prod).
    // Run before rate-limit increment and Cognito auth so disallowed addresses
    // cause no side effects.
    if (!isEmailAllowed(rawEmail)) {
      return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    }

    // Rate limit: prevent brute-force OTP guessing
    if (!checkOtpVerifyLimit(rawEmail)) {
      return NextResponse.json(
        { error: AUTH.OTP_VERIFY_RATE_LIMIT },
        { status: 429 },
      );
    }

    // Normalize Gmail plus addressing to match the account created in send-otp
    const email = normalizeEmail(rawEmail);

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
      [email],
    );
    const ver = verResult.rows[0] ?? null;

    if (!ver || !ver.otp_code) {
      return NextResponse.json({ error: AUTH.OTP_NOT_FOUND }, { status: 400 });
    }

    // 2. Check expiry
    if (!ver.otp_expires_at || new Date(ver.otp_expires_at) < new Date()) {
      return NextResponse.json({ error: AUTH.OTP_EXPIRED }, { status: 400 });
    }

    // 3. Check OTP matches
    if (ver.otp_code !== otp) {
      return NextResponse.json({ error: AUTH.OTP_INVALID }, { status: 400 });
    }

    // 4. Authenticate with Cognito → get tokens
    let tokens;
    try {
      tokens = await initiateCognitoAuth(email, `Otp.${otp}!`);
    } catch (cognitoErr) {
      console.error("[verify-otp] Cognito auth failed:", cognitoErr);
      return NextResponse.json({ error: AUTH.SIGN_IN_FAILED }, { status: 400 });
    }

    // 5. Invalidate OTP (clear code, mark email verified)
    await query(
      `UPDATE user_verification
       SET otp_code = NULL, otp_expires_at = NULL, email_verified = true, email_verified_at = $1
       WHERE user_id = $2`,
      [new Date().toISOString(), ver.user_id],
    );

    // 6. Initialize usage record (0 appeal credits — trial has no appeal access)
    await query(
      `INSERT INTO usage (user_id, email, appeal_count, appeal_credits)
       VALUES ($1, $2, 0, 0)
       ON CONFLICT (email) DO NOTHING`,
      [ver.user_id, email],
    );

    // 7. Start trial on first sign-in (inline — no self-referencing HTTP fetch)
    try {
      const existingSub = await query<{ trial_start: string | null }>(
        `SELECT trial_start FROM subscriptions WHERE user_id = $1 LIMIT 1`,
        [ver.user_id],
      );
      if (!existingSub.rows[0]?.trial_start) {
        const now = new Date();
        const trialEnd = new Date(now);
        trialEnd.setDate(trialEnd.getDate() + PRICING.TRIAL_DURATION_DAYS);
        await query(
          `INSERT INTO subscriptions (user_id, plan, status, trial_start, trial_end, trial_converted)
           VALUES ($1, 'trial', 'trialing', $2, $3, false)
           ON CONFLICT (user_id) DO UPDATE
             SET plan = EXCLUDED.plan, status = EXCLUDED.status,
                 trial_start = EXCLUDED.trial_start, trial_end = EXCLUDED.trial_end,
                 trial_converted = EXCLUDED.trial_converted`,
          [ver.user_id, now.toISOString(), trialEnd.toISOString()],
        );
      }
    } catch (trialErr) {
      console.error("[verify-otp] Trial creation failed:", trialErr);
    }

    // Read is_on_medicare so we can set the medicare_status cookie below.
    // The cookie's presence is the middleware gate's signal that the user
    // has already answered the Medicare question. NULL = ask via
    // /onboarding/medicare; true/false = skip onboarding.
    let isOnMedicare: boolean | null = null;
    try {
      const profileResult = await query<{ is_on_medicare: boolean | null }>(
        `SELECT is_on_medicare FROM users WHERE id = $1 LIMIT 1`,
        [ver.user_id],
      );
      isOnMedicare = profileResult.rows[0]?.is_on_medicare ?? null;
    } catch (profErr) {
      console.error("[verify-otp] is_on_medicare lookup failed:", profErr);
      // Fall through: cookie stays unset → user goes through onboarding.
    }

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

    // Track session issuance time for 7-day forced re-auth policy (NIST 800-63B)
    response.cookies.set("session_issued_at", Date.now().toString(), {
      ...cookieOpts,
      maxAge: 30 * 24 * 60 * 60, // same lifetime as refresh token
    });

    // Clear any stale MFA verified cookie on fresh login
    response.cookies.set("mfa_verified", "", { ...cookieOpts, maxAge: 0 });

    // Medicare cohort cookie — set whenever the user has already answered.
    // Missing cookie triggers the /onboarding/medicare gate in middleware.
    if (isOnMedicare !== null) {
      response.cookies.set("medicare_status", isOnMedicare ? "yes" : "no", {
        ...cookieOpts,
        maxAge: 30 * 24 * 60 * 60,
      });
    }

    return response;
  } catch (error) {
    console.error("[verify-otp] Error:", error);
    return NextResponse.json({ error: AUTH.SIGN_IN_ERROR }, { status: 500 });
  }
}

export const POST = withMetrics(_POST, "/api/auth/verify-otp");

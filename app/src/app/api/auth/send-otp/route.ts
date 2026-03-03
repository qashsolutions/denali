/**
 * POST /api/auth/send-otp
 *
 * Step 1 of email OTP sign-in.
 * - Creates or retrieves the Cognito user for this email
 * - Generates a 6-digit OTP, sets it as the Cognito password
 * - Stores OTP + 10-min expiry in user_verification
 * - Sends OTP email via Resend
 */

import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { createOrGetCognitoUser, setCognitoPassword } from "@/lib/auth-server";

const OTP_TTL_MINUTES = 10;

function generateOtp(): string {
  // 6-digit OTP, cryptographically random
  const { randomInt } = require("crypto") as typeof import("crypto");
  return String(randomInt(100000, 999999));
}

async function sendOtpEmail(email: string, otp: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[send-otp] RESEND_API_KEY not configured");
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM_EMAIL || "Denali <noreply@denali.health>",
      to: [email],
      subject: `Your Denali sign-in code: ${otp}`,
      html: `
        <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="font-size: 20px; font-weight: 700; margin-bottom: 8px;">Your sign-in code</h2>
          <p style="color: #64748b; margin-bottom: 24px;">Enter this code to sign in to Denali. It expires in ${OTP_TTL_MINUTES} minutes.</p>
          <div style="background: #f1f5f9; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px;">
            <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; font-family: monospace;">${otp}</span>
          </div>
          <p style="color: #94a3b8; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error("[send-otp] Resend error:", res.status, body);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email as string | undefined)?.toLowerCase().trim();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
    }

    // 1. Ensure Cognito user exists → get sub (userId)
    const userId = await createOrGetCognitoUser(email);

    // 2. Generate OTP
    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    // 3. Set Cognito password to the OTP value
    //    Format: "Otp.{code}!" — satisfies Cognito's default complexity policy:
    //    uppercase (O), lowercase (tp), digits (code), special (.!)
    await setCognitoPassword(email, `Otp.${otp}!`);

    // 4. Upsert user record (no-op if already exists)
    await query(
      `INSERT INTO users (id, email, plan) VALUES ($1, $2, 'trial')
       ON CONFLICT (id) DO NOTHING`,
      [userId, email]
    );

    // 5. Upsert OTP into user_verification
    await query(
      `INSERT INTO user_verification (user_id, otp_code, otp_expires_at, email_verified)
       VALUES ($1, $2, $3, false)
       ON CONFLICT (user_id) DO UPDATE
         SET otp_code = EXCLUDED.otp_code,
             otp_expires_at = EXCLUDED.otp_expires_at`,
      [userId, otp, expiresAt.toISOString()]
    );

    // 6. Send OTP email (fire-and-forget log, don't fail request on email error)
    await sendOtpEmail(email, otp);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[send-otp] Error:", error);
    return NextResponse.json({ error: "Failed to send code. Please try again." }, { status: 500 });
  }
}

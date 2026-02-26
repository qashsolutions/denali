/**
 * POST /api/auth/mfa/enroll
 *
 * Begins TOTP enrollment.
 * Generates a secret, stores it (pending confirmation), and returns the QR code URI.
 * The user must scan the QR code in their authenticator app and then call
 * POST /api/auth/mfa/confirm with a valid code to complete enrollment.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { generateTotpSecret, generateTotpUri } from "@/lib/totp";

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  // Generate fresh secret
  const secret = generateTotpSecret();
  const qrCode = generateTotpUri(secret, user.email);

  // Store secret (not yet confirmed — totp_enrolled_at stays NULL until confirm)
  await query(
    `INSERT INTO user_verification (user_id, totp_secret, email_verified)
     VALUES ($1, $2, false)
     ON CONFLICT (user_id) DO UPDATE
       SET totp_secret = EXCLUDED.totp_secret,
           totp_enrolled_at = NULL`,
    [user.userId, secret]
  );

  return NextResponse.json({ secret, qrCode });
}

/**
 * POST /api/auth/mfa/enroll
 *
 * Begins TOTP enrollment.
 * Generates a secret, stores it (pending confirmation), and returns a QR code
 * as a PNG data URL that can be rendered directly in an <img> tag.
 * The user must scan the QR code in their authenticator app and then call
 * POST /api/auth/mfa/confirm with a valid code to complete enrollment.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { generateTotpSecret, generateTotpUri } from "@/lib/totp";
import QRCode from "qrcode";
import { AUTH } from "@/config/messages";

export async function POST(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) return NextResponse.json({ error: AUTH.SIGN_IN_REQUIRED }, { status: 401 });

  // Generate fresh secret
  const secret = generateTotpSecret();
  const otpauthUri = generateTotpUri(secret, user.email);

  // Convert otpauth:// URI to a PNG data URL for <img> rendering
  const qrCode = await QRCode.toDataURL(otpauthUri, {
    width: 256,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

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

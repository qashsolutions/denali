/**
 * POST /api/auth/idle-lock
 *
 * Locks the session after inactivity without revoking the refresh token.
 * Clears the access_token so the UI shows signed-out state, but keeps
 * the refresh_token cookie so the middleware can silently re-authenticate
 * when the user returns (no OTP needed).
 *
 * Compare with /api/auth/signout which does GlobalSignOut (revokes ALL
 * refresh tokens, requiring full re-authentication).
 */

import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ success: true });

  const cookieOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };

  // Clear access token (forces re-auth check on next request)
  response.cookies.set("access_token", "", { ...cookieOpts, maxAge: 0 });
  // Clear MFA session cookie
  response.cookies.set("mfa_verified", "", { ...cookieOpts, maxAge: 0 });
  // NOTE: refresh_token is intentionally kept — middleware will use it to
  // silently obtain a new access_token when the user returns.

  return response;
}

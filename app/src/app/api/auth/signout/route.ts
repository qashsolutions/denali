/**
 * POST /api/auth/signout
 *
 * Signs the user out of all Cognito sessions and clears auth cookies.
 */

import { NextRequest, NextResponse } from "next/server";
import { cognitoGlobalSignOut } from "@/lib/auth-server";

export async function POST(request: NextRequest) {
  const accessToken = request.cookies.get("access_token")?.value;

  // Sign out from Cognito (invalidates refresh tokens on all devices)
  if (accessToken) {
    await cognitoGlobalSignOut(accessToken);
  }

  const response = NextResponse.json({ success: true });

  // Clear all auth cookies
  const clearOpts = { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/" };
  response.cookies.set("access_token", "", { ...clearOpts, maxAge: 0 });
  response.cookies.set("refresh_token", "", { ...clearOpts, maxAge: 0 });
  response.cookies.set("mfa_verified", "", { ...clearOpts, maxAge: 0 });
  response.cookies.set("session_issued_at", "", { ...clearOpts, maxAge: 0 });

  return response;
}

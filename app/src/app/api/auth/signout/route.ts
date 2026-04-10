/**
 * POST /api/auth/signout
 *
 * Signs the user out of all Cognito sessions and clears auth cookies.
 */

import { NextRequest, NextResponse } from "next/server";
import { cognitoGlobalSignOut, getAuthUserOptional } from "@/lib/auth-server";
import { logAudit } from "@/lib/audit";
import { withMetrics } from "@/lib/metrics";

async function _POST(request: NextRequest) {
  // Get user before clearing tokens (for audit log)
  const user = await getAuthUserOptional(request);

  const accessToken = request.cookies.get("access_token")?.value;

  // Sign out from Cognito (invalidates refresh tokens on all devices)
  if (accessToken) {
    await cognitoGlobalSignOut(accessToken);
  }

  // Audit log: session termination (HIPAA §164.312(b))
  logAudit("LOGOUT", {
    userId: user?.userId,
    resourceType: "account",
    request,
  }).catch(() => {});

  const response = NextResponse.json({ success: true });

  // Clear all auth cookies
  const clearOpts = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
  response.cookies.set("access_token", "", { ...clearOpts, maxAge: 0 });
  response.cookies.set("refresh_token", "", { ...clearOpts, maxAge: 0 });
  response.cookies.set("mfa_verified", "", { ...clearOpts, maxAge: 0 });
  response.cookies.set("session_issued_at", "", { ...clearOpts, maxAge: 0 });

  return response;
}

export const POST = withMetrics(_POST, "/api/auth/signout");

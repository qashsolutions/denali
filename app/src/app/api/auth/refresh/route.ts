/**
 * POST /api/auth/refresh
 *
 * Refreshes the access token using the refresh_token cookie.
 * Called by the client when it gets a 401 from any API route.
 */

import { NextRequest, NextResponse } from "next/server";
import { refreshCognitoTokens } from "@/lib/auth-server";
import { withMetrics } from "@/lib/metrics";
import { AUTH, SYSTEM } from "@/config/messages";

async function _POST(request: NextRequest) {
  const refreshToken = request.cookies.get("refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: AUTH.SESSION_EXPIRED }, { status: 401 });
  }

  try {
    const { accessToken, expiresIn } = await refreshCognitoTokens(refreshToken);

    const response = NextResponse.json({ success: true });
    response.cookies.set("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expiresIn,
    });

    return response;
  } catch (error) {
    console.error("[refresh] Token refresh failed:", error);

    // Distinguish transient infrastructure failures from genuinely invalid tokens.
    // Invalid/revoked tokens throw with specific Cognito error codes — clear cookies.
    // Everything else (network timeout, DNS, Cognito outage) is transient — return 503
    // and preserve the refresh token so the session recovers automatically.
    const errMsg = error instanceof Error ? error.message : "";
    const isInvalidToken =
      errMsg.includes("NotAuthorizedException") ||
      errMsg.includes("invalid_grant") ||
      errMsg.includes("Invalid Refresh Token");

    if (isInvalidToken) {
      const response = NextResponse.json(
        { error: AUTH.SESSION_EXPIRED },
        { status: 401 },
      );
      const clearOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
      };
      response.cookies.set("access_token", "", { ...clearOpts, maxAge: 0 });
      response.cookies.set("refresh_token", "", { ...clearOpts, maxAge: 0 });
      return response;
    }

    // Transient failure — keep cookies intact so retry works once service recovers
    return NextResponse.json(
      { error: SYSTEM.SERVICE_UNAVAILABLE },
      { status: 503 },
    );
  }
}

export const POST = withMetrics(_POST, "/api/auth/refresh");

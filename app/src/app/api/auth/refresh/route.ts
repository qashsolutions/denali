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
  // ── Mobile vs web token source ──
  // Web: refresh token lives in the httpOnly `refresh_token` cookie.
  // Mobile: refresh token is supplied in the JSON body (`{ refresh_token }`)
  // and the `X-Client-Type: mobile` header signals the body-returning branch
  // on success / failure. See docs/design/phase-1-45plus.md §76 + §144.
  //
  // The web path is byte-identical when the header is absent — covered by
  // the regression test at `__tests__/route.test.ts`.
  const isMobile = request.headers.get("X-Client-Type") === "mobile";

  let refreshToken: string | undefined = request.cookies.get("refresh_token")?.value;
  if (isMobile) {
    try {
      const body = (await request.json()) as { refresh_token?: unknown };
      if (typeof body.refresh_token === "string" && body.refresh_token.length > 0) {
        refreshToken = body.refresh_token;
      }
    } catch {
      // Body parse error → fall through; refreshToken stays whatever cookie
      // supplied (or undefined). The 401 below will then fire.
    }
  }

  if (!refreshToken) {
    return NextResponse.json({ error: AUTH.SESSION_EXPIRED }, { status: 401 });
  }

  try {
    const { accessToken, expiresIn } = await refreshCognitoTokens(refreshToken);

    if (isMobile) {
      // Body tokens, NO Set-Cookie.
      return NextResponse.json({
        success: true,
        access_token: accessToken,
        expires_in: expiresIn,
      });
    }

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
      if (isMobile) {
        // Mobile: no Set-Cookie. The client owns its tokenStore and clears
        // tokens locally on a 401 from this route.
        return NextResponse.json(
          { error: AUTH.SESSION_EXPIRED },
          { status: 401 },
        );
      }
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

    // Transient failure — keep cookies intact so retry works once service recovers.
    // Mobile gets the same 503 (no Set-Cookie either way).
    return NextResponse.json(
      { error: SYSTEM.SERVICE_UNAVAILABLE },
      { status: 503 },
    );
  }
}

export const POST = withMetrics(_POST, "/api/auth/refresh");

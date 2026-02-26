/**
 * POST /api/auth/refresh
 *
 * Refreshes the access token using the refresh_token cookie.
 * Called by the client when it gets a 401 from any API route.
 */

import { NextRequest, NextResponse } from "next/server";
import { refreshCognitoTokens } from "@/lib/auth-server";

export async function POST(request: NextRequest) {
  const refreshToken = request.cookies.get("refresh_token")?.value;

  if (!refreshToken) {
    return NextResponse.json({ error: "No refresh token" }, { status: 401 });
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
    // Clear stale cookies so the client knows to re-authenticate
    const response = NextResponse.json({ error: "Session expired. Please sign in again." }, { status: 401 });
    const clearOpts = { httpOnly: true, secure: process.env.NODE_ENV === "production", path: "/" };
    response.cookies.set("access_token", "", { ...clearOpts, maxAge: 0 });
    response.cookies.set("refresh_token", "", { ...clearOpts, maxAge: 0 });
    return response;
  }
}

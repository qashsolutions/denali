/**
 * Next.js Middleware — Cognito Token Refresh + Auth Redirects
 *
 * 1. If access_token is missing but refresh_token exists, silently refresh
 *    (enables seamless return after idle-lock without re-authentication).
 * 2. Signed-in users hitting "/" → redirect to "/app"
 * 3. Anonymous users hitting "/app" → redirect to "/"
 *
 * Auth detection: checks for `access_token` cookie (set by Cognito verify-otp).
 * This is a lightweight check — full token validation happens in API routes
 * via getAuthUser(). The cookie's presence is sufficient for redirect decisions.
 */

import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let hasAccessToken = request.cookies.has("access_token");
  const hasRefreshToken = request.cookies.has("refresh_token");

  // Silent token refresh: access_token expired/cleared but refresh_token exists.
  // This enables seamless return after idle-lock (no OTP re-auth needed).
  if (!hasAccessToken && hasRefreshToken) {
    try {
      const refreshUrl = new URL("/api/auth/refresh", request.url);
      const refreshRes = await fetch(refreshUrl, {
        method: "POST",
        headers: {
          cookie: request.headers.get("cookie") || "",
        },
      });

      if (refreshRes.ok) {
        // Extract the new access_token cookie from the refresh response
        const setCookieHeaders = refreshRes.headers.getSetCookie?.() || [];
        if (setCookieHeaders.length > 0) {
          hasAccessToken = true;

          // Forward the Set-Cookie headers so the browser gets the new token
          const response = applyRedirects(pathname, hasAccessToken, request);
          for (const header of setCookieHeaders) {
            response.headers.append("set-cookie", header);
          }
          return response;
        }
      }
    } catch {
      // Refresh failed — treat as anonymous
    }
  }

  return applyRedirects(pathname, hasAccessToken, request);
}

function applyRedirects(pathname: string, hasAccessToken: boolean, request: NextRequest): NextResponse {
  // Signed-in users on landing page → redirect to dashboard
  if (pathname === "/" && hasAccessToken) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  // Anonymous users on /app (exact) → redirect to landing
  if (pathname === "/app" && !hasAccessToken) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on all routes except static assets and service worker
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

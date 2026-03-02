/**
 * Next.js Middleware — Cognito JWT Token Refresh + Auth Redirects
 *
 * 1. Signed-in users hitting "/" → redirect to "/app" (Option A pattern)
 * 2. Anonymous users hitting "/app" → redirect to "/" (auth-gate)
 *
 * Auth detection: checks for `access_token` cookie (set by Cognito verify-otp).
 * This is a lightweight check — full token validation happens in API routes
 * via getAuthUser(). The cookie's presence is sufficient for redirect decisions.
 */

import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAccessToken = request.cookies.has("access_token");

  // Signed-in users on landing page → redirect to dashboard
  if (pathname === "/" && hasAccessToken) {
    return NextResponse.redirect(new URL("/app", request.url));
  }

  // Anonymous users on /app (exact) → redirect to landing
  // Don't gate /app/chat, /app/health, /app/settings — those have their own auth handling
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

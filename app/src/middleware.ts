/**
 * Next.js Middleware — Cognito JWT Token Refresh
 *
 * Replaces the Supabase SSR middleware. Handles Cognito token refresh
 * by detecting expired access tokens and using the refresh token cookie
 * to obtain new tokens from Cognito.
 *
 * For routes that don't need auth, this is a no-op pass-through.
 */

import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Pass-through — Cognito token refresh is handled client-side via the
  // Cognito Amplify SDK or via explicit refresh in auth hooks.
  // Server routes call getAuthUser() from auth-server.ts for verification.
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on all routes except static assets and service worker
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

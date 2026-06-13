/**
 * Next.js Middleware — Cognito Token Refresh + Auth Redirects + Session Policy
 *
 * 1. Enforce 7-day maximum session lifetime (NIST 800-63B).
 *    If `session_issued_at` cookie is older than 7 days, clear ALL auth cookies
 *    and redirect to a friendly re-auth page.
 * 2. If access_token is missing but refresh_token exists, silently refresh
 *    (enables seamless return after idle-lock without re-authentication).
 * 3. Signed-in users hitting "/" → redirect to "/app"
 * 4. Anonymous users hitting "/app" → redirect to "/"
 *
 * Auth detection: checks for `access_token` cookie (set by Cognito verify-otp).
 * This is a lightweight check — full token validation happens in API routes
 * via getAuthUser(). The cookie's presence is sufficient for redirect decisions.
 */

import { NextResponse, type NextRequest } from "next/server";

// Web (server-side-PHI / Medicare path) keeps a 7-day session cap. The
// MOBILE app intentionally diverges to 30 days because it is local-first and
// gates launch behind a biometric check — do NOT "sync" the two. See
// mobile/src/auth/sessionPolicy.ts and decision D15.
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  let hasAccessToken = request.cookies.has("access_token");
  const hasRefreshToken = request.cookies.has("refresh_token");

  // ── Skip session policy & silent refresh for API routes ──
  // API routes handle their own auth via getAuthUser(). Running session
  // enforcement here causes two problems:
  //   1. Silent refresh fetch("/api/auth/refresh") re-enters middleware → infinite recursion
  //   2. FHIR callback & other API routes get cookies cleared mid-request
  const isApiRoute = pathname.startsWith("/api/");
  if (isApiRoute) {
    return NextResponse.next();
  }

  // ── 7-day session lifetime enforcement ──
  // Check before silent refresh so we don't accidentally extend an expired session.
  const sessionIssuedAt = request.cookies.get("session_issued_at")?.value;
  if (sessionIssuedAt && (hasAccessToken || hasRefreshToken)) {
    const issuedAtMs = parseInt(sessionIssuedAt, 10);
    if (!isNaN(issuedAtMs) && Date.now() - issuedAtMs > SEVEN_DAYS_MS) {
      // Session too old — force full re-authentication
      const clearOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      };

      // If user is already on the re-auth page, don't redirect loop
      if (pathname === "/app/session-expired") {
        const response = NextResponse.next();
        response.cookies.set("access_token", "", clearOpts);
        response.cookies.set("refresh_token", "", clearOpts);
        response.cookies.set("session_issued_at", "", clearOpts);
        response.cookies.set("mfa_verified", "", clearOpts);
        return response;
      }

      // Redirect to friendly session-expired page
      const response = NextResponse.redirect(new URL("/app/session-expired", request.url));
      response.cookies.set("access_token", "", clearOpts);
      response.cookies.set("refresh_token", "", clearOpts);
      response.cookies.set("session_issued_at", "", clearOpts);
      response.cookies.set("mfa_verified", "", clearOpts);
      return response;
    }
  }

  // ── Silent token refresh ──
  // access_token expired/cleared but refresh_token exists.
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
      } else if (refreshRes.status === 503) {
        // Transient infrastructure issue (Cognito down) — don't redirect to landing.
        // Let the user stay on the page; API routes will fail individually but
        // the session will recover automatically once the service comes back.
        return NextResponse.next();
      }
    } catch {
      // Network error reaching refresh endpoint — also transient, don't kick user out
      return NextResponse.next();
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

  // Cohort + demographics onboarding gate — signed-in users without BOTH
  // medicare_status (Chunk 2) and sex_at_birth_status (Chunk 3) cookies are
  // bounced to the onboarding page. Either cookie being missing/absent
  // triggers the redirect; both must be present to pass through.
  // /onboarding/* paths are not gated, so no redirect loop.
  // Cookie sets (when fully wired): medicare_status set by verify-otp,
  //   /api/profile PATCH, and /api/profile GET heal. sex_at_birth_status
  //   will be set by the same sites (Chunks 3 Steps 4/6).
  // Presence semantics: cookie present = user answered. Cookie absent =
  // user hasn't answered yet (NULL in DB). No "unanswered" sentinel value.
  if (
    hasAccessToken &&
    pathname.startsWith("/app") &&
    (!request.cookies.has("medicare_status") ||
      !request.cookies.has("sex_at_birth_status"))
  ) {
    return NextResponse.redirect(new URL("/onboarding/medicare", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Run on all routes except static assets and service worker
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};

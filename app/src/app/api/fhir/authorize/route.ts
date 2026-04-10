/**
 * FHIR OAuth Authorization Route
 *
 * GET /api/fhir/authorize
 *
 * Initiates Blue Button 2.0 OAuth flow:
 * 1. Verify user is authenticated
 * 2. Generate random state, store in httpOnly cookie
 * 3. Redirect to CMS authorization URL
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { API_CONFIG, getBaseUrl } from "@/config";
import { randomBytes, createHash } from "crypto";
import { logAudit } from "@/lib/audit";
import { AUTH, SYSTEM } from "@/config/messages";

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { error: AUTH.SIGN_IN_REQUIRED },
        { status: 401 },
      );
    }

    // Gate on ID.me identity verification — only when REQUIRE_IDENTITY_VERIFICATION=true
    // (Medicare App Library requires ID.me; Connected Apps Directory does not)
    if (process.env.REQUIRE_IDENTITY_VERIFICATION === "true") {
      const adminCheck = await query<{ is_admin: boolean }>(
        `SELECT is_admin FROM users WHERE id = $1 LIMIT 1`,
        [user.userId],
      );
      const isAdmin = adminCheck.rows[0]?.is_admin || false;

      if (!isAdmin) {
        const idmeCheck = await query<{ idme_verified: boolean }>(
          `SELECT COALESCE(idme_verified, false) as idme_verified FROM user_verification WHERE user_id = $1 LIMIT 1`,
          [user.userId],
        );
        const idmeVerified = idmeCheck.rows[0]?.idme_verified || false;

        if (!idmeVerified) {
          // Build public redirect URL (ALB-aware)
          const host =
            request.headers.get("x-forwarded-host") ||
            request.headers.get("host");
          const proto = request.headers.get("x-forwarded-proto") || "https";
          const detectedOrigin = host ? `${proto}://${host}` : null;
          const baseUrl = detectedOrigin || getBaseUrl(request.nextUrl.origin);
          return NextResponse.redirect(
            new URL("/app/settings?idme_required=true", baseUrl),
          );
        }
      }
    }

    const clientId = process.env.BLUEBUTTON_CLIENT_ID;
    if (!clientId) {
      console.error("[FHIR authorize] Missing BLUEBUTTON_CLIENT_ID");
      return NextResponse.json(
        { error: SYSTEM.MEDICARE_CONNECT_UNAVAILABLE },
        { status: 500 },
      );
    }

    const { blueButton } = API_CONFIG;

    // Generate CSRF state token
    const state = randomBytes(32).toString("hex");

    // Generate PKCE code verifier and challenge (RFC 7636, S256)
    const codeVerifier = randomBytes(32).toString("base64url"); // 43 chars
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    // Build callback URL — must match EXACTLY what's registered at CMS
    // Behind ALB, request.nextUrl.origin may reflect internal container URL,
    // so prefer the Host header (which ALB forwards correctly) or x-forwarded-host.
    const host =
      request.headers.get("x-forwarded-host") || request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") || "https";
    // Do NOT strip www — cookies must be set on the same domain the user is on.
    // www.denali.health is a registered CMS callback URL, so it works as-is.
    const detectedOrigin = host ? `${proto}://${host}` : null;
    const redirectUri =
      process.env.BLUEBUTTON_CALLBACK_URL ||
      `${detectedOrigin || getBaseUrl(request.nextUrl.origin)}${blueButton.callbackPath}`;

    if (process.env.NODE_ENV === "development") {
      console.log("[FHIR authorize] redirect_uri:", redirectUri);
    }

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      scope: blueButton.scopes,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      prompt: "login", // Force CMS to show login page (prevents auto-reuse of previous session)
    });

    const authorizeUrl = `${blueButton.baseUrl}/${blueButton.version}/o/authorize/?${params}`;

    logAudit("FHIR_CONNECT", {
      userId: user.userId,
      resourceType: "ehr_connection",
      metadata: { step: "authorize_initiated" },
      request,
    }).catch(() => {});

    // Set state and PKCE verifier in httpOnly cookies (10 minute TTL)
    const response = NextResponse.redirect(authorizeUrl);
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 600, // 10 minutes
      path: "/",
    };
    response.cookies.set("bb_oauth_state", state, cookieOptions);
    response.cookies.set("bb_code_verifier", codeVerifier, cookieOptions);

    return response;
  } catch (error) {
    console.error("[FHIR authorize] Error:", error);
    return NextResponse.json(
      { error: SYSTEM.MEDICARE_CONNECT_FAILED },
      { status: 500 },
    );
  }
}

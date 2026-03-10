/**
 * ID.me OIDC Authorization Route
 *
 * GET /api/auth/idme/authorize
 *
 * Initiates ID.me identity verification flow:
 * 1. Verify user is authenticated via Cognito
 * 2. Generate state, nonce, PKCE challenge
 * 3. Store in httpOnly cookies (10 min TTL)
 * 4. Redirect to ID.me authorization endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { API_CONFIG, getBaseUrl } from "@/config";
import { randomBytes, createHash } from "crypto";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);

    if (!user) {
      return NextResponse.json(
        { error: "You must be signed in to verify your identity" },
        { status: 401 }
      );
    }

    const { idme } = API_CONFIG;
    if (!idme.clientId) {
      console.error("[ID.me authorize] Missing IDME_CLIENT_ID");
      return NextResponse.json(
        { error: "Identity verification is temporarily unavailable. Please try again later." },
        { status: 500 }
      );
    }

    // Generate CSRF state token
    const state = randomBytes(32).toString("hex");

    // Generate nonce for OIDC
    const nonce = randomBytes(32).toString("hex");

    // Generate PKCE code verifier and challenge (RFC 7636, S256)
    const codeVerifier = randomBytes(32).toString("base64url");
    const codeChallenge = createHash("sha256")
      .update(codeVerifier)
      .digest("base64url");

    // Build callback URL — same ALB-aware pattern as fhir/authorize
    const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
    const proto = request.headers.get("x-forwarded-proto") || "https";
    const detectedOrigin = host ? `${proto}://${host}` : null;
    const redirectUri = `${detectedOrigin || getBaseUrl(request.nextUrl.origin)}${idme.callbackPath}`;

    console.log("[ID.me authorize] redirect_uri:", redirectUri, "| host:", host);

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: idme.clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: idme.scope,
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const authorizeUrl = `${idme.baseUrl}/oauth/authorize?${params}`;

    logAudit("IDME_VERIFY", {
      userId: user.userId,
      resourceType: "identity",
      metadata: { step: "authorize_initiated" },
      request,
    }).catch(() => {});

    // Set state, nonce, and PKCE verifier in httpOnly cookies (10 min TTL)
    const response = NextResponse.redirect(authorizeUrl);
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax" as const,
      maxAge: 600, // 10 minutes
      path: "/",
    };
    response.cookies.set("idme_oauth_state", state, cookieOptions);
    response.cookies.set("idme_nonce", nonce, cookieOptions);
    response.cookies.set("idme_code_verifier", codeVerifier, cookieOptions);

    return response;
  } catch (error) {
    console.error("[ID.me authorize] Error:", error);
    return NextResponse.json(
      { error: "Unable to start identity verification. Please try again." },
      { status: 500 }
    );
  }
}

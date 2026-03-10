/**
 * ID.me OIDC Callback Route
 *
 * GET /api/auth/idme/callback
 *
 * Handles the redirect from ID.me after user verifies identity:
 * 1. Validate state against cookie
 * 2. Exchange authorization code for tokens (client_secret_post + PKCE)
 * 3. Fetch userinfo — extract only uuid (data minimization)
 * 4. Upsert user_verification with idme_verified = true
 * 5. Redirect to /app/settings?idme=verified
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, refreshCognitoTokens } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { API_CONFIG, getBaseUrl } from "@/config";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  // ALB-aware public origin detection (same pattern as fhir/callback)
  const fwdHost = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const fwdProto = request.headers.get("x-forwarded-proto") || "https";
  const publicOrigin = fwdHost ? `${fwdProto}://${fwdHost}` : null;
  const redirectBase = publicOrigin || request.url;

  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle denial or error from ID.me
    if (error) {
      console.warn("[ID.me callback] ID.me returned error:", error);
      return NextResponse.redirect(
        new URL("/app/settings?idme=denied", redirectBase)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/app/settings?idme=missing_params", redirectBase)
      );
    }

    // Validate state against cookie
    const savedState = request.cookies.get("idme_oauth_state")?.value;
    if (!savedState || savedState !== state) {
      console.error("[ID.me callback] State mismatch");
      return NextResponse.redirect(
        new URL("/app/settings?idme=invalid_state", redirectBase)
      );
    }

    // Retrieve PKCE code verifier from cookie
    const codeVerifier = request.cookies.get("idme_code_verifier")?.value;
    if (!codeVerifier) {
      console.error("[ID.me callback] Missing PKCE code verifier");
      return NextResponse.redirect(
        new URL("/app/settings?idme=missing_pkce", redirectBase)
      );
    }

    // Verify user is authenticated
    // Handle Cognito token expiry during ID.me redirect (same pattern as fhir/callback)
    let user = await getAuthUser(request);
    let refreshedAccessToken: string | undefined;

    if (!user) {
      const refreshToken = request.cookies.get("refresh_token")?.value;
      if (refreshToken) {
        try {
          const refreshed = await refreshCognitoTokens(refreshToken);
          refreshedAccessToken = refreshed.accessToken;
          const headers = new Headers(request.headers);
          headers.set("Authorization", `Bearer ${refreshedAccessToken}`);
          const refreshedRequest = new NextRequest(request.url, { headers });
          user = await getAuthUser(refreshedRequest);
          console.log("[ID.me callback] Token refreshed for user:", user?.userId);
        } catch (refreshErr) {
          console.error("[ID.me callback] Token refresh failed:", refreshErr);
        }
      }
    }

    if (!user) {
      console.error("[ID.me callback] User not authenticated after refresh attempt");
      return NextResponse.redirect(
        new URL("/app/settings?idme=not_authenticated", redirectBase)
      );
    }

    // Exchange code for tokens via POST to ID.me token endpoint
    // ID.me uses client_secret_post (credentials in body, not Basic auth header)
    const { idme } = API_CONFIG;
    const redirectUri = `${publicOrigin || getBaseUrl(request.nextUrl.origin)}${idme.callbackPath}`;

    const tokenUrl = `${idme.baseUrl}/oauth/token`;
    const tokenBody = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: idme.clientId,
      client_secret: idme.clientSecret,
      code_verifier: codeVerifier,
    });

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: tokenBody.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[ID.me callback] Token exchange failed:", tokenRes.status, errText);
      return NextResponse.redirect(
        new URL("/app/settings?idme=token_error", redirectBase)
      );
    }

    const tokens = await tokenRes.json();

    // Fetch userinfo to get the verified UUID
    const userinfoUrl = `${idme.baseUrl}/api/public/v3/userinfo`;
    const userinfoRes = await fetch(userinfoUrl, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });

    if (!userinfoRes.ok) {
      const errText = await userinfoRes.text();
      console.error("[ID.me callback] Userinfo fetch failed:", userinfoRes.status, errText);
      return NextResponse.redirect(
        new URL("/app/settings?idme=userinfo_error", redirectBase)
      );
    }

    const userinfo = await userinfoRes.json();

    // Data minimization: extract ONLY the uuid (no name, DOB, SSN, address)
    const idmeUuid = userinfo.uuid || userinfo.sub;
    if (!idmeUuid) {
      console.error("[ID.me callback] No UUID in userinfo response");
      return NextResponse.redirect(
        new URL("/app/settings?idme=no_uuid", redirectBase)
      );
    }

    // Upsert user_verification with ID.me status
    try {
      await query(
        `UPDATE user_verification
         SET idme_verified = true,
             idme_verified_at = NOW(),
             idme_uuid = $2,
             idme_ial_level = 'ial2'
         WHERE user_id = $1`,
        [user.userId, idmeUuid]
      );
    } catch (upsertError) {
      console.error("[ID.me callback] Failed to save verification:", upsertError);
      return NextResponse.redirect(
        new URL("/app/settings?idme=save_error", redirectBase)
      );
    }

    console.log("[ID.me callback] Verification saved for user:", user.userId);

    logAudit("IDME_VERIFY", {
      userId: user.userId,
      resourceType: "identity",
      metadata: { level: "ial2" },
      request,
    }).catch(() => {});

    // Clear OAuth cookies and redirect
    const response = NextResponse.redirect(
      new URL("/app/settings?idme=verified", redirectBase)
    );
    response.cookies.delete("idme_oauth_state");
    response.cookies.delete("idme_nonce");
    response.cookies.delete("idme_code_verifier");

    // Refresh Cognito token cookie if we had to refresh during this request
    if (refreshedAccessToken) {
      response.cookies.set("access_token", refreshedAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 3600,
      });
    }

    return response;
  } catch (error) {
    console.error("[ID.me callback] Error:", error);
    return NextResponse.redirect(
      new URL("/app/settings?idme=unknown_error", redirectBase)
    );
  }
}

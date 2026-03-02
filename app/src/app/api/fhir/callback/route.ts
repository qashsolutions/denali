/**
 * FHIR OAuth Callback Route
 *
 * GET /api/fhir/callback
 *
 * Handles the redirect from CMS after user authorizes:
 * 1. Validate state matches cookie
 * 2. Exchange authorization code for tokens
 * 3. Encrypt tokens and store in ehr_connections
 * 4. Redirect to /app/health?connected=true
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser, refreshCognitoTokens } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { encrypt } from "@/lib/fhir/crypto";
import { API_CONFIG, getBaseUrl } from "@/config";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    // Handle denial or error from CMS
    if (error) {
      console.warn("[FHIR callback] CMS returned error:", error);
      return NextResponse.redirect(
        new URL("/app/health?error=denied", request.url)
      );
    }

    if (!code || !state) {
      return NextResponse.redirect(
        new URL("/app/health?error=missing_params", request.url)
      );
    }

    // Validate state against cookie
    const savedState = request.cookies.get("bb_oauth_state")?.value;
    if (!savedState || savedState !== state) {
      console.error("[FHIR callback] State mismatch");
      return NextResponse.redirect(
        new URL("/app/health?error=invalid_state", request.url)
      );
    }

    // Retrieve PKCE code verifier from cookie
    const codeVerifier = request.cookies.get("bb_code_verifier")?.value;
    if (!codeVerifier) {
      console.error("[FHIR callback] Missing PKCE code verifier");
      return NextResponse.redirect(
        new URL("/app/health?error=missing_pkce", request.url)
      );
    }

    // Verify user is authenticated.
    // The access_token may have expired while the user was on Medicare.gov
    // (Blue Button OAuth redirect takes them off-site for several minutes).
    // Attempt a silent refresh before giving up.
    let user = await getAuthUser(request);
    let refreshedAccessToken: string | undefined;

    if (!user) {
      const refreshToken = request.cookies.get("refresh_token")?.value;
      if (refreshToken) {
        try {
          const refreshed = await refreshCognitoTokens(refreshToken);
          refreshedAccessToken = refreshed.accessToken;
          // Build a synthetic request with the new token for getAuthUser
          const headers = new Headers(request.headers);
          headers.set("Authorization", `Bearer ${refreshedAccessToken}`);
          const refreshedRequest = new NextRequest(request.url, { headers });
          user = await getAuthUser(refreshedRequest);
          console.log("[FHIR callback] Token refreshed successfully for user:", user?.userId);
        } catch (refreshErr) {
          console.error("[FHIR callback] Token refresh failed:", refreshErr);
        }
      }
    }

    if (!user) {
      console.error("[FHIR callback] User not authenticated after refresh attempt");
      return NextResponse.redirect(
        new URL("/app/health?error=not_authenticated", request.url)
      );
    }

    // Exchange code for tokens
    const { blueButton } = API_CONFIG;
    const clientId = process.env.BLUEBUTTON_CLIENT_ID;
    const clientSecret = process.env.BLUEBUTTON_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      console.error("[FHIR callback] Missing BLUEBUTTON credentials");
      return NextResponse.redirect(
        new URL("/app/health?error=config", request.url)
      );
    }
    // Must match EXACTLY what was sent in authorize — use same env var
    const redirectUri = process.env.BLUEBUTTON_CALLBACK_URL
      || `${getBaseUrl(request.headers.get("origin") ?? request.nextUrl.origin).replace("://www.", "://")}${blueButton.callbackPath}`;

    const tokenUrl = `${blueButton.baseUrl}/${blueButton.version}/o/token/`;
    const body = new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    });

    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      },
      body: body.toString(),
    });

    if (!tokenRes.ok) {
      const errText = await tokenRes.text();
      console.error("[FHIR callback] Token exchange failed:", tokenRes.status, errText);
      return NextResponse.redirect(
        new URL("/app/health?error=token_exchange", request.url)
      );
    }

    const tokens = await tokenRes.json();
    console.log("[FHIR callback] Token exchange succeeded, patient:", tokens.patient);

    // Extract FHIR patient ID from token response
    // Blue Button includes patient ID in the token response
    const fhirPatientId = tokens.patient ?? null;

    // Encrypt tokens
    const accessTokenEncrypted = encrypt(tokens.access_token);
    const refreshTokenEncrypted = encrypt(tokens.refresh_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Upsert connection into RDS
    try {
      await query(
        `INSERT INTO ehr_connections (user_id, provider, fhir_patient_id, access_token_encrypted, refresh_token_encrypted, token_expires_at, scopes, status, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (user_id, provider) DO UPDATE
           SET fhir_patient_id = EXCLUDED.fhir_patient_id,
               access_token_encrypted = EXCLUDED.access_token_encrypted,
               refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
               token_expires_at = EXCLUDED.token_expires_at,
               scopes = EXCLUDED.scopes,
               status = EXCLUDED.status,
               updated_at = EXCLUDED.updated_at`,
        [
          user.userId,
          "bluebutton",
          fhirPatientId,
          accessTokenEncrypted,
          refreshTokenEncrypted,
          expiresAt,
          tokens.scope ?? blueButton.scopes,
          "active",
          new Date().toISOString(),
        ]
      );
    } catch (upsertError) {
      console.error("[FHIR callback] Failed to save connection:", upsertError);
      return NextResponse.redirect(
        new URL("/app/health?error=save_failed", request.url)
      );
    }

    console.log("[FHIR callback] Connection saved for user:", user.userId);

    logAudit("FHIR_CONNECT", {
      userId: user.userId,
      resourceType: "ehr_connection",
      metadata: { provider: "bluebutton", fhirPatientId },
      request,
    }).catch(() => {});

    // Clear OAuth cookies and redirect to health page
    const response = NextResponse.redirect(
      new URL("/app/health?connected=true", request.url)
    );
    response.cookies.delete("bb_oauth_state");
    response.cookies.delete("bb_code_verifier");

    // If we refreshed the Cognito token during this request, set the new
    // access_token cookie so the browser session stays alive.
    if (refreshedAccessToken) {
      response.cookies.set("access_token", refreshedAccessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 3600, // Cognito default
      });
    }

    return response;
  } catch (error) {
    console.error("[FHIR callback] Error:", error);
    return NextResponse.redirect(
      new URL("/app/health?error=unknown", request.url)
    );
  }
}

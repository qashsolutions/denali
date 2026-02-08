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
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { createAdminClient } from "@/lib/supabase-admin";
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

    // Verify user is authenticated
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
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
    const origin = getBaseUrl(request.headers.get("origin") ?? request.nextUrl.origin);
    const redirectUri = `${origin}${blueButton.callbackPath}`;

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

    // Extract FHIR patient ID from token response
    // Blue Button includes patient ID in the token response
    const fhirPatientId = tokens.patient ?? null;

    // Encrypt tokens
    const accessTokenEncrypted = encrypt(tokens.access_token);
    const refreshTokenEncrypted = encrypt(tokens.refresh_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    // Upsert connection via admin client (bypasses RLS)
    const admin = createAdminClient();
    const { error: upsertError } = await admin
      .from("ehr_connections")
      .upsert(
        {
          user_id: user.id,
          provider: "bluebutton",
          fhir_patient_id: fhirPatientId,
          access_token_encrypted: accessTokenEncrypted,
          refresh_token_encrypted: refreshTokenEncrypted,
          token_expires_at: expiresAt,
          scopes: tokens.scope ?? blueButton.scopes,
          status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,provider" }
      );

    if (upsertError) {
      console.error("[FHIR callback] Failed to save connection:", upsertError);
      return NextResponse.redirect(
        new URL("/app/health?error=save_failed", request.url)
      );
    }

    console.log("[FHIR callback] Connection saved for user:", user.id);

    logAudit("FHIR_CONNECT", {
      userId: user.id,
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

    return response;
  } catch (error) {
    console.error("[FHIR callback] Error:", error);
    return NextResponse.redirect(
      new URL("/app/health?error=unknown", request.url)
    );
  }
}

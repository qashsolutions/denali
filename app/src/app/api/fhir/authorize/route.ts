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
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { API_CONFIG, getBaseUrl } from "@/config";
import { randomBytes, createHash } from "crypto";
import { logAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated
    const supabase = await createServerSupabaseClient();
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: "You must be logged in to connect Medicare" },
        { status: 401 }
      );
    }

    // If user has TOTP enrolled, require AAL2 before connecting FHIR
    const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const { data: factors } = await supabase.auth.mfa.listFactors();
    const hasTOTP = factors?.totp?.some(
      (f) => f.status === "verified"
    );

    if (hasTOTP && aalData?.currentLevel !== "aal2") {
      return NextResponse.json(
        { error: "Authenticator verification required", requiresAAL2: true },
        { status: 403 }
      );
    }

    const clientId = process.env.BLUEBUTTON_CLIENT_ID;
    if (!clientId) {
      console.error("[FHIR authorize] Missing BLUEBUTTON_CLIENT_ID");
      return NextResponse.json(
        { error: "Blue Button not configured" },
        { status: 500 }
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
    // Use explicit env var to avoid origin-detection issues on Vercel
    const redirectUri = process.env.BLUEBUTTON_CALLBACK_URL
      || `${getBaseUrl(request.headers.get("origin") ?? request.nextUrl.origin).replace("://www.", "://")}${blueButton.callbackPath}`;
    console.log("[FHIR authorize] redirect_uri:", redirectUri);

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      scope: blueButton.scopes,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    });

    const authorizeUrl = `${blueButton.baseUrl}/${blueButton.version}/o/authorize/?${params}`;

    logAudit("FHIR_CONNECT", {
      userId: user.id,
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
      { error: "Failed to initiate Medicare connection" },
      { status: 500 }
    );
  }
}

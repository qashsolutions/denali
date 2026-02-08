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
import { randomBytes } from "crypto";

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

    // Build callback URL
    const origin = getBaseUrl(request.headers.get("origin") ?? request.nextUrl.origin);
    const redirectUri = `${origin}${blueButton.callbackPath}`;

    // Build authorization URL
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      state,
      scope: blueButton.scopes,
    });

    const authorizeUrl = `${blueButton.baseUrl}/${blueButton.version}/o/authorize/?${params}`;

    // Set state in httpOnly cookie (10 minute TTL)
    const response = NextResponse.redirect(authorizeUrl);
    response.cookies.set("bb_oauth_state", state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 600, // 10 minutes
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("[FHIR authorize] Error:", error);
    return NextResponse.json(
      { error: "Failed to initiate Medicare connection" },
      { status: 500 }
    );
  }
}

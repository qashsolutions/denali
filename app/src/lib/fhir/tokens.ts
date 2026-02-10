/**
 * Token Management
 *
 * Retrieves, decrypts, and auto-refreshes Blue Button OAuth tokens.
 * All DB access uses admin client (bypasses RLS for token read/write).
 */

import { createAdminClient } from "@/lib/supabase-admin";
import { encrypt, decrypt } from "./crypto";
import { API_CONFIG } from "@/config";

interface TokenPair {
  accessToken: string;
  fhirPatientId: string | null;
}

/**
 * Get a valid access token for the user, auto-refreshing if expired.
 */
export async function getValidToken(userId: string): Promise<TokenPair | null> {
  const admin = createAdminClient();

  const { data: conn, error } = await admin
    .from("ehr_connections")
    .select("*")
    .eq("user_id", userId)
    .eq("provider", "bluebutton")
    .eq("status", "active")
    .single();

  if (error || !conn) return null;

  const now = new Date();
  const expiresAt = new Date(conn.token_expires_at);

  // Refresh if expiring within 5 minutes
  if (expiresAt.getTime() - now.getTime() < 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(conn.id, conn.refresh_token_encrypted);
    if (!refreshed) return null;
    return { accessToken: refreshed, fhirPatientId: conn.fhir_patient_id };
  }

  const accessToken = decrypt(conn.access_token_encrypted);
  return {
    accessToken,
    fhirPatientId: conn.fhir_patient_id,
  };
}

/**
 * Refresh the access token using the refresh token.
 */
async function refreshAccessToken(
  connectionId: string,
  refreshTokenEncrypted: string
): Promise<string | null> {
  const refreshToken = decrypt(refreshTokenEncrypted);
  const { blueButton } = API_CONFIG;

  const clientId = process.env.BLUEBUTTON_CLIENT_ID;
  const clientSecret = process.env.BLUEBUTTON_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error("[FHIR tokens] Missing BLUEBUTTON_CLIENT_ID or BLUEBUTTON_CLIENT_SECRET");
    return null;
  }

  const tokenUrl = `${blueButton.baseUrl}/${blueButton.version}/o/token/`;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: body.toString(),
  });

  if (!res.ok) {
    console.error("[FHIR tokens] Refresh failed:", res.status, await res.text());
    // Mark connection as expired
    const admin = createAdminClient();
    await admin
      .from("ehr_connections")
      .update({ status: "expired", updated_at: new Date().toISOString() })
      .eq("id", connectionId);
    return null;
  }

  const tokens = await res.json();
  const admin = createAdminClient();

  await admin
    .from("ehr_connections")
    .update({
      access_token_encrypted: encrypt(tokens.access_token),
      refresh_token_encrypted: encrypt(tokens.refresh_token),
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", connectionId);

  return tokens.access_token;
}

/**
 * Check if a user has an active Blue Button connection.
 */
export async function hasActiveConnection(userId: string): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("ehr_connections")
    .select("id")
    .eq("user_id", userId)
    .eq("provider", "bluebutton")
    .eq("status", "active")
    .single();
  return !!data;
}

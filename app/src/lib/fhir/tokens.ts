/**
 * Token Management
 *
 * Retrieves, decrypts, and auto-refreshes Blue Button OAuth tokens.
 * All DB access uses RDS PostgreSQL via query().
 */

import { query } from "@/lib/db";
import { encrypt, decrypt } from "./crypto";
import { API_CONFIG } from "@/config";

interface TokenPair {
  accessToken: string;
  fhirPatientId: string | null;
}

type ConnRow = {
  id: string;
  user_id: string;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  token_expires_at: string;
  fhir_patient_id: string | null;
  status: string;
};

/**
 * Get a valid access token for the user, auto-refreshing if expired.
 */
export async function getValidToken(userId: string): Promise<TokenPair | null> {
  const result = await query<ConnRow>(
    `SELECT * FROM ehr_connections
     WHERE user_id = $1 AND provider = 'bluebutton' AND status = 'active'
     LIMIT 1`,
    [userId]
  );
  const conn = result.rows[0] ?? null;
  if (!conn) return null;

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
    await query(
      `UPDATE ehr_connections SET status = 'expired', updated_at = $1 WHERE id = $2`,
      [new Date().toISOString(), connectionId]
    );
    return null;
  }

  const tokens = await res.json() as { access_token: string; refresh_token: string; expires_in: number };

  await query(
    `UPDATE ehr_connections
     SET access_token_encrypted = $1,
         refresh_token_encrypted = $2,
         token_expires_at = $3,
         updated_at = $4
     WHERE id = $5`,
    [
      encrypt(tokens.access_token),
      encrypt(tokens.refresh_token),
      new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      new Date().toISOString(),
      connectionId,
    ]
  );

  return tokens.access_token;
}

/**
 * Check if a user has an active Blue Button connection.
 */
export async function hasActiveConnection(userId: string): Promise<boolean> {
  const result = await query<{ id: string }>(
    `SELECT id FROM ehr_connections
     WHERE user_id = $1 AND provider = 'bluebutton' AND status = 'active'
     LIMIT 1`,
    [userId]
  );
  return result.rows.length > 0;
}

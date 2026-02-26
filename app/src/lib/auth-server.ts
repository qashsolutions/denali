/**
 * Server-side Cognito Auth
 *
 * Replaces createServerSupabaseClient().auth.getUser() in API routes.
 * Validates the Cognito JWT from the Authorization header or cookie.
 *
 * Usage in API routes:
 *   const user = await getAuthUser(request);
 *   if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
 */

import { CognitoJwtVerifier } from "aws-jwt-verify";
import { CognitoIdentityProviderClient, AdminDeleteUserCommand, AdminGetUserCommand } from "@aws-sdk/client-cognito-identity-provider";
import type { NextRequest } from "next/server";

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

// Singleton verifier — caches JWKS from Cognito
let verifier: ReturnType<typeof CognitoJwtVerifier.create> | null = null;

function getVerifier() {
  if (!verifier) {
    verifier = CognitoJwtVerifier.create({
      userPoolId: USER_POOL_ID,
      tokenUse: "access",
      clientId: CLIENT_ID,
    });
  }
  return verifier;
}

export interface AuthUser {
  userId: string;    // Cognito sub (UUID)
  email: string;     // email from token claims
}

/**
 * Extract and verify the Cognito access token.
 * Looks for Bearer token in Authorization header, then in `access_token` cookie.
 * Returns null if missing or invalid (caller should return 401).
 */
export async function getAuthUser(request: NextRequest): Promise<AuthUser | null> {
  try {
    let token: string | undefined;

    // 1. Authorization: Bearer <token>
    const authHeader = request.headers.get("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }

    // 2. Cookie fallback (set by auth flow)
    if (!token) {
      token = request.cookies.get("access_token")?.value;
    }

    if (!token) return null;

    const payload = await getVerifier().verify(token);
    const email = (payload.email as string | undefined) ?? (payload.username as string | undefined) ?? "";

    return {
      userId: payload.sub,
      email,
    };
  } catch {
    // Invalid or expired token
    return null;
  }
}

/**
 * Get user from token — returns null without throwing.
 * Use in routes that work for both authenticated and anonymous users.
 */
export async function getAuthUserOptional(request: NextRequest): Promise<AuthUser | null> {
  return getAuthUser(request).catch(() => null);
}

// Singleton Cognito admin client
let cognitoAdmin: CognitoIdentityProviderClient | null = null;
function getCognitoAdmin() {
  if (!cognitoAdmin) {
    cognitoAdmin = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION || "us-east-1" });
  }
  return cognitoAdmin;
}

/**
 * Delete a Cognito user (account deletion).
 * Uses IAM credentials from ECS task role — no access key needed.
 */
export async function deleteCognitoUser(username: string): Promise<void> {
  await getCognitoAdmin().send(new AdminDeleteUserCommand({
    UserPoolId: USER_POOL_ID,
    Username: username,
  }));
}

/**
 * Look up the Cognito username for a given sub (UUID).
 * Cognito AdminDeleteUser requires the username, not the sub.
 */
export async function getCognitoUsernameByEmail(email: string): Promise<string | null> {
  try {
    const result = await getCognitoAdmin().send(new AdminGetUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
    }));
    return result.Username ?? null;
  } catch {
    return null;
  }
}

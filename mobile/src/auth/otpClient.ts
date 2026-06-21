/**
 * otpClient — email OTP sign-in functions wired to the Next.js backend.
 *
 * Phase 1 mobile, Wave 1.
 *
 * Endpoints called:
 *   - POST /api/auth/send-otp     {email}                       → no tokens
 *   - POST /api/auth/verify-otp   {email, otp} + X-Client-Type  → body tokens
 *   - POST /api/auth/refresh      {refresh_token} + X-Client-Type → body tokens
 *   - POST /api/auth/signout                                    → 200 ok
 *
 * After `verifyOtp`, tokens are persisted to the secure tokenStore. After
 * `signOut`, tokens are wiped. The mobile app NEVER receives a Set-Cookie
 * header from the backend — that's the whole point of the X-Client-Type
 * branch.
 *
 * Each function uses `rawRequest` (not `requestJson`) so it can handle
 * its own non-success codes. None of these functions emit token values
 * to logs.
 */

import type { VerifyOtpResult } from "@/contracts";

import { rawRequest, HttpError, type HttpClientHooks } from "./httpClient";
import { clearTokens, setTokens } from "./tokenStore";

interface VerifyOtpBody {
  success?: boolean;
  mfaRequired?: boolean;
  user?: { userId?: string; email?: string };
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

interface RefreshBody {
  access_token?: string;
  expires_in?: number;
  error?: string;
}

interface SendOtpBody {
  success?: boolean;
  error?: string;
}

export async function sendOtp(
  email: string,
  hooks: HttpClientHooks,
): Promise<void> {
  const response = await rawRequest(
    {
      method: "POST",
      path: "/api/auth/send-otp",
      body: JSON.stringify({ email }),
      // `noRefreshOn401` — send-otp is unauthenticated; never trigger refresh.
      options: { noRefreshOn401: true },
    },
    hooks,
  );

  const body = (await response.json().catch(() => null)) as SendOtpBody | null;
  if (!response.ok) {
    throw new HttpError(response.status, body);
  }
}

export async function verifyOtp(
  email: string,
  otp: string,
  hooks: HttpClientHooks,
): Promise<VerifyOtpResult> {
  const response = await rawRequest(
    {
      method: "POST",
      path: "/api/auth/verify-otp",
      body: JSON.stringify({ email, otp }),
      options: { noRefreshOn401: true },
    },
    hooks,
  );

  const body = (await response.json().catch(() => null)) as VerifyOtpBody | null;
  if (!response.ok || !body) {
    throw new HttpError(response.status, body);
  }
  if (!body.access_token || !body.refresh_token) {
    // The X-Client-Type: mobile branch must always include both tokens
    // on success. Treat a missing token as an upstream contract break.
    throw new HttpError(response.status, {
      ...body,
      error: "Server did not return mobile tokens. Check X-Client-Type branch.",
    });
  }
  if (!body.user?.userId || !body.user?.email) {
    throw new HttpError(response.status, body);
  }

  await setTokens({
    access: body.access_token,
    refresh: body.refresh_token,
    sessionIssuedAt: Date.now(),
    // NAV-3A: anchor the token to its owner so cold-launch restore can refuse a
    // most-recent profile that belongs to a different account on a shared device.
    sessionUserId: body.user.userId,
  });

  return {
    userId: body.user.userId,
    email: body.user.email,
    mfaRequired: body.mfaRequired === true,
  };
}

/**
 * Force a refresh outside the silent-on-401 path (e.g., proactive renewal).
 * Returns when complete; throws on failure.
 *
 * Internally re-uses the httpClient's single-flight refresh by issuing the
 * call directly here — that path is private to httpClient. Instead, we
 * issue a fresh POST and persist the new access token. The single-flight
 * guard inside httpClient still protects the 401 retry path; an explicit
 * caller of `refresh()` accepts the (extremely small) chance of a parallel
 * call.
 */
export async function refresh(hooks: HttpClientHooks): Promise<void> {
  // Read inside this function to avoid stale closure on tokenStore.
  const { getRefreshToken, getSessionIssuedAt } = await import("./tokenStore");
  const { isSessionExpired } = await import("./sessionPolicy");

  const refreshToken = await getRefreshToken();
  if (!refreshToken) {
    throw new HttpError(401, { error: "No refresh token" });
  }
  if (isSessionExpired(await getSessionIssuedAt())) {
    await clearTokens();
    hooks.onSignInRequired();
    throw new HttpError(401, { error: "Session expired" });
  }

  const response = await rawRequest(
    {
      method: "POST",
      path: "/api/auth/refresh",
      body: JSON.stringify({ refresh_token: refreshToken }),
      options: { noRefreshOn401: true },
    },
    hooks,
  );

  const body = (await response.json().catch(() => null)) as RefreshBody | null;
  if (!response.ok || !body?.access_token) {
    // Match httpClient's behavior on hard refresh failure.
    if (response.status === 401) {
      await clearTokens();
      hooks.onSignInRequired();
    }
    throw new HttpError(response.status, body);
  }
  await setTokens({ access: body.access_token });
}

/**
 * Sign out. Best-effort server call (we ignore failure modes other than
 * network — the user is leaving anyway) followed by a local token wipe.
 *
 * Critical: clear tokens even when the server call fails. The web does
 * the same — see `app/src/app/api/auth/signout/route.ts` which clears
 * cookies regardless of Cognito's response.
 */
export async function signOut(hooks: HttpClientHooks): Promise<void> {
  try {
    await rawRequest(
      {
        method: "POST",
        path: "/api/auth/signout",
        options: { noRefreshOn401: true },
      },
      hooks,
    );
  } catch {
    // Swallow — we're tearing down anyway.
  }
  await clearTokens();
}

/**
 * sessionPolicy — 7-day NIST 800-63B session cap (mobile mirror).
 *
 * Mirrors the web's session cap at `app/src/middleware.ts:19, 38-67`:
 *   - 7 days from `session_issued_at`, then forced re-OTP.
 *
 * The web enforces this in middleware on every navigation. On mobile,
 * there is no middleware — the httpClient checks `isSessionExpired` on
 * every request boundary, and the SignIn screen checks it on launch.
 *
 * The constant is exported (not just the function) because callers like
 * `httpClient.ts` may want to compute "time remaining" for UX hints.
 */

/** 7 days in milliseconds (matches `SEVEN_DAYS_MS` in app/src/middleware.ts). */
export const SESSION_MAX_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Returns true when the stored `session_issued_at` is older than
 * SESSION_MAX_MS. Null/missing values return false — that means "no
 * session to expire", not "expired session" — the unauthenticated state
 * is handled separately by `getAccessToken()` returning null.
 *
 * Defensive parse: if the stored value isn't a valid epoch-millis
 * literal, treat as expired. This errs on the side of forcing re-auth
 * over trusting corrupted state.
 */
export function isSessionExpired(sessionIssuedAt: string | null): boolean {
  if (sessionIssuedAt == null) return false;
  const issuedAtMs = Number.parseInt(sessionIssuedAt, 10);
  if (!Number.isFinite(issuedAtMs)) return true;
  return Date.now() - issuedAtMs > SESSION_MAX_MS;
}

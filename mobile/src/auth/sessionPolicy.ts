/**
 * sessionPolicy — 30-day NIST 800-63B session cap (mobile).
 *
 * INTENTIONAL DIVERGENCE from the web (decision D15, 2026-06-12): the web
 * `app/src/middleware.ts` keeps its 7-day cap for the server-side-PHI
 * Medicare path. Mobile is local-first (no health data server-side; the
 * SQLCipher key is device-bound) AND now gates app launch behind a
 * biometric / device-credential check (`biometricGate.ts`), which gives
 * daily presence assurance. Email OTP is a single factor (≈ AAL1, where
 * NIST permits up to 30-day reauth); biometrics are the continuous control,
 * so the OTP re-prompt cap is 30 days here, not 7. The 30-minute inactivity
 * timeout (useIdleTimeout) is unchanged.
 *
 * On mobile there is no middleware — the httpClient checks `isSessionExpired`
 * on every request boundary, and the launch gate checks it on cold start.
 *
 * 30 days matches the Cognito refresh-token lifetime (verified 2026-06-04),
 * so silent refresh stays viable for the whole window.
 *
 * The constant is exported (not just the function) because callers like
 * `httpClient.ts` may want to compute "time remaining" for UX hints.
 */

/** 30 days in milliseconds. Deliberately longer than the web's 7-day cap —
 *  see the docblock (D15: biometric launch gate + local-first posture). */
export const SESSION_MAX_MS = 30 * 24 * 60 * 60 * 1000;

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

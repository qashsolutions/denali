/**
 * tokenStore — expo-secure-store wrapper for Cognito JWTs.
 *
 * Phase 1 mobile, Wave 1 (mobile-auth-wirer).
 *
 * Stores three values in the platform Keychain (iOS) / Keystore (Android):
 *   - access_token       — Cognito JWT used for `Authorization: Bearer ...`
 *   - refresh_token      — used to mint new access tokens via /api/auth/refresh
 *   - session_issued_at  — epoch-millis string for the 7-day NIST 800-63B
 *                          session cap enforced by sessionPolicy.ts
 *
 * Invariants:
 *   - Never use AsyncStorage. AsyncStorage is unencrypted on disk; tokens
 *     must live in the secure enclave. (Phase 1 invariant 2.)
 *   - Never log token values. Use boolean "is it present?" if anything.
 *   - SecureStore keys cannot contain ":" or "/" — use snake_case constants
 *     that match the Cognito cookie names from the web (`access_token`,
 *     `refresh_token`, `session_issued_at`).
 *
 * `setTokens` accepts a partial bundle so the refresh path (which only
 * mints a new access token + renews `session_issued_at` reference time)
 * does not have to round-trip the refresh token through the caller.
 */

import * as SecureStore from "expo-secure-store";

/** SecureStore key for the Cognito access token (JWT). */
const KEY_ACCESS = "access_token";
/** SecureStore key for the Cognito refresh token. */
const KEY_REFRESH = "refresh_token";
/** SecureStore key for the epoch-millis string used by the 7-day session cap. */
const KEY_SESSION_ISSUED_AT = "session_issued_at";

/**
 * iOS Keychain accessibility: items become readable AFTER first device unlock
 * and are NEVER copied to iCloud Keychain / migrated to a new device on
 * restore. Auth tokens are device-bound, matching the SQLCipher key's class
 * in `mobile/src/db/keystore.ts`. Cross-device sync is a Phase 2 explicit
 * opt-in (matches Invariant 6 — no cloud backup in Phase 1).
 *
 * Android note: expo-secure-store on Android uses AndroidKeystore, which
 * isn't user-presence-gated by default. The `keychainAccessible` option is
 * a no-op there; we still pass it for iOS.
 */
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export interface TokenBundle {
  access: string;
  refresh: string;
  /** Epoch milliseconds for when the session was first established. */
  sessionIssuedAt: number;
}

export type PartialTokenBundle =
  | TokenBundle
  | {
      /** Refresh-flow update — only the new access token is provided. */
      access: string;
      refresh?: undefined;
      sessionIssuedAt?: undefined;
    };

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_ACCESS, SECURE_STORE_OPTIONS);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_REFRESH, SECURE_STORE_OPTIONS);
}

/**
 * Returns the session-issued-at instant as an ISO-string-compatible epoch
 * millis literal (the same shape the web's `session_issued_at` cookie
 * uses). Callers parse it with `parseInt(value, 10)`.
 */
export async function getSessionIssuedAt(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY_SESSION_ISSUED_AT, SECURE_STORE_OPTIONS);
}

/**
 * Writes any subset of the three values. The full-bundle overload is used
 * after a successful OTP verification; the access-only overload is used
 * after a silent refresh (refresh token + session_issued_at preserved).
 */
export async function setTokens(bundle: PartialTokenBundle): Promise<void> {
  await SecureStore.setItemAsync(KEY_ACCESS, bundle.access, SECURE_STORE_OPTIONS);
  if (bundle.refresh !== undefined) {
    await SecureStore.setItemAsync(
      KEY_REFRESH,
      bundle.refresh,
      SECURE_STORE_OPTIONS,
    );
  }
  if (bundle.sessionIssuedAt !== undefined) {
    await SecureStore.setItemAsync(
      KEY_SESSION_ISSUED_AT,
      String(bundle.sessionIssuedAt),
      SECURE_STORE_OPTIONS,
    );
  }
}

/**
 * Deletes all three values. Used on sign-out, on a hard 401 (refresh
 * failure), and when the 7-day session cap fires.
 *
 * Per-key try/catch: SecureStore raises if the key was never written. We
 * swallow because the post-condition we care about is "no tokens remain",
 * which already holds if the key was absent.
 */
export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEY_ACCESS, SECURE_STORE_OPTIONS).catch(() => {}),
    SecureStore.deleteItemAsync(KEY_REFRESH, SECURE_STORE_OPTIONS).catch(() => {}),
    SecureStore.deleteItemAsync(KEY_SESSION_ISSUED_AT, SECURE_STORE_OPTIONS).catch(
      () => {},
    ),
  ]);
}

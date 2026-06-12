/**
 * ApiClientImpl — concrete `ApiClient` for Phase 1 mobile.
 *
 * The single implementation of the frozen `ApiClient` contract at
 * `src/contracts/ApiClient.ts`. Wraps:
 *   - tokenStore.ts        (Keychain/Keystore via expo-secure-store)
 *   - httpClient.ts        (fetch wrapper + silent refresh + 7-day cap)
 *   - otpClient.ts         (send/verify/refresh/signout)
 *   - chatStream.ts        (SSE iterable)
 *
 * Exposes a `createApiClient()` factory and a React provider hook in
 * `ApiClientProvider.tsx`. Consumers obtain the instance via
 * `useApiClient()` and depend only on the interface from `@/contracts`.
 *
 * State stored in-process:
 *   - `currentUser` — bootstrapped on `verifyOtp` and via the optional
 *     `initialUser` constructor arg (used by the provider after
 *     `getCurrentUser()` from `LocalDataDAL` on app launch).
 *   - `signInListeners` — onSignInRequired subscribers; fired when
 *     tokens are cleared by a failed refresh or by the 7-day session cap.
 */

import type {
  ApiClient,
  ApiRequestOptions,
  ChatStreamEvent,
  ChatTurnInput,
  VerifyOtpResult,
} from "@/contracts";

import {
  chatStream,
  type ChatStreamOptions,
} from "./chatStream";
import {
  HttpError,
  SessionExpiredError,
  rawRequest,
  requestJson,
  type HttpClientHooks,
} from "./httpClient";
import {
  refresh as otpRefresh,
  sendOtp as otpSendOtp,
  signOut as otpSignOut,
  verifyOtp as otpVerifyOtp,
} from "./otpClient";
import { isSessionExpired } from "./sessionPolicy";
import {
  clearTokens,
  getAccessToken,
  getSessionIssuedAt,
} from "./tokenStore";

export interface CreateApiClientOptions {
  /**
   * Initial signed-in user, if already known from the local store. Lets
   * the app render an authenticated UI on cold boot without waiting for
   * a /api/profile round-trip.
   */
  initialUser?: { userId: string; email: string } | null;
}

class ApiClientImpl implements ApiClient {
  private currentUser: { userId: string; email: string } | null;
  private signInListeners = new Set<() => void>();

  private hooks: HttpClientHooks = {
    onSignInRequired: () => {
      // Clear in-memory user state and fan out to subscribers.
      this.currentUser = null;
      for (const listener of this.signInListeners) {
        try {
          listener();
        } catch {
          // Swallow listener errors so one misbehaving subscriber doesn't
          // wedge the others.
        }
      }
    },
  };

  constructor(options: CreateApiClientOptions = {}) {
    this.currentUser = options.initialUser ?? null;
  }

  // ── Auth lifecycle ──

  async sendOtp(email: string): Promise<void> {
    await otpSendOtp(email, this.hooks);
  }

  async verifyOtp(email: string, otp: string): Promise<VerifyOtpResult> {
    const result = await otpVerifyOtp(email, otp, this.hooks);
    this.currentUser = { userId: result.userId, email: result.email };
    return result;
  }

  async refresh(): Promise<void> {
    await otpRefresh(this.hooks);
  }

  async signOut(): Promise<void> {
    await otpSignOut(this.hooks);
    this.currentUser = null;
  }

  isAuthenticated(): boolean {
    // Sync check based on cached state. For a definitive answer at
    // boot, the provider's effect calls `bootstrap()` (below) which
    // reads SecureStore.
    return this.currentUser != null;
  }

  getCurrentUser(): { userId: string; email: string } | null {
    return this.currentUser;
  }

  onSignInRequired(handler: () => void): () => void {
    this.signInListeners.add(handler);
    return () => {
      this.signInListeners.delete(handler);
    };
  }

  /**
   * Hydrate `currentUser` from a separately-known identity. The DAL owns
   * the local profile row; the provider passes `{userId, email}` into
   * this method after reading `LocalDataDAL.getProfile()`. Splitting it
   * keeps `ApiClientImpl` free of any DAL import.
   */
  hydrateUser(user: { userId: string; email: string } | null): void {
    this.currentUser = user;
  }

  /**
   * On cold launch, returns true if a usable access token exists in the
   * secure store. Provider uses this to decide whether to call
   * `hydrateUser()` from the local profile or route to SignIn.
   *
   * Does NOT validate the token server-side — that happens implicitly on
   * the first authenticated request (and triggers silent refresh on 401).
   */
  async hasStoredAccessToken(): Promise<boolean> {
    const token = await getAccessToken();
    return token != null;
  }

  /**
   * Cold-launch session restore (see the ApiClient contract). Hydrates
   * `currentUser` from the supplied local-profile identity IFF a stored
   * access token exists AND the 7-day session cap has not elapsed. On an
   * elapsed cap or a missing token, clears any stale tokens and returns
   * false. No network call — token validity is proven on the first authed
   * request, which silently refreshes on 401.
   */
  async restoreSession(user: {
    userId: string;
    email: string;
  }): Promise<boolean> {
    const token = await getAccessToken();
    if (token == null) return false;
    const issuedAt = await getSessionIssuedAt();
    // A stored token whose 7-day cap has elapsed — OR that carries no issue
    // timestamp at all (can't be age-bounded) — is refused and cleared,
    // rather than granting an uncapped session. `isSessionExpired` treats
    // null as "no session"; here a token IS present, so null means a
    // partial/legacy write we must not trust. (HIPAA review finding M1.)
    if (issuedAt == null || isSessionExpired(issuedAt)) {
      await clearTokens();
      return false;
    }
    this.currentUser = user;
    return true;
  }

  // ── REST ──

  apiGet<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    return requestJson<T>(
      { method: "GET", path, options },
      this.hooks,
    );
  }

  apiPost<T>(
    path: string,
    body: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    return requestJson<T>(
      {
        method: "POST",
        path,
        body: JSON.stringify(body),
        options,
      },
      this.hooks,
    );
  }

  apiPatch<T>(
    path: string,
    body: unknown,
    options?: ApiRequestOptions,
  ): Promise<T> {
    return requestJson<T>(
      {
        method: "PATCH",
        path,
        body: JSON.stringify(body),
        options,
      },
      this.hooks,
    );
  }

  apiDelete<T>(path: string, options?: ApiRequestOptions): Promise<T> {
    return requestJson<T>(
      { method: "DELETE", path, options },
      this.hooks,
    );
  }

  // ── Chat (SSE) ──

  chat(
    input: ChatTurnInput,
    options?: ApiRequestOptions,
  ): AsyncIterable<ChatStreamEvent> {
    const streamOpts: ChatStreamOptions = {
      signal: options?.signal,
      timeoutMs: options?.timeoutMs,
    };
    return chatStream(input, this.hooks, streamOpts);
  }
}

/**
 * Factory. Most callers use the React context (`ApiClientProvider` +
 * `useApiClient()`); the factory is exposed for tests and for any non-React
 * boot-up path.
 */
export function createApiClient(
  options: CreateApiClientOptions = {},
): ApiClient & {
  hydrateUser: (user: { userId: string; email: string } | null) => void;
  hasStoredAccessToken: () => Promise<boolean>;
} {
  return new ApiClientImpl(options);
}

export type { ApiClient } from "@/contracts";

// Re-export the error types so consumers can pattern-match on them
// without importing from the lower-level modules.
export { HttpError, SessionExpiredError };

// Internal helpers needed by tests that don't want to go through the
// public factory.
export { rawRequest };

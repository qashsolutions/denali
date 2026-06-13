/**
 * ApiClient — frozen Phase 1 contract for the authed HTTP + SSE client.
 *
 * Implementation: mobile-auth-wirer agent owns src/auth/* (httpClient.ts,
 * tokenStore.ts, sessionPolicy.ts).
 *
 * All authenticated requests carry:
 *   - Authorization: Bearer <access_token>
 *   - X-Client-Type: mobile  (so the backend returns body tokens, no cookies)
 *
 * 401 responses trigger a silent refresh and one retry. If refresh fails,
 * tokens are cleared and the onSignInRequired listener fires.
 *
 * session cap (NIST 800-63B) is enforced locally — when exceeded,
 * tokens are cleared and OTP sign-in is required again.
 *
 * Consumers: every surface that calls /api/* (onboarding, upload, chat,
 * app shell). Auth-wirer is the only implementor; everyone else imports
 * the interface from src/contracts/ and depends on injected instances.
 */

export interface ApiRequestOptions {
  signal?: AbortSignal;
  /** Override default timeout (30s for non-chat, 330s for chat/inference). */
  timeoutMs?: number;
  /** Suppress silent refresh on 401 — useful for auth endpoints themselves. */
  noRefreshOn401?: boolean;
}

export interface VerifyOtpResult {
  userId: string;        // Cognito sub
  email: string;
  mfaRequired: boolean;  // Phase 1 consumer mobile: always false (no TOTP UI)
}

export interface ChatTurnInput {
  /** The next user message to send. */
  content: string;
  /** Local conversation context (prior messages); the server is no-persist. */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  /**
   * Phase 1 mobile: ALWAYS true. Forces /api/chat to skip persistence into
   * the conversations/messages tables. The backend honors this when the
   * X-Client-Type: mobile header is also set.
   */
  noPersist: true;
  /**
   * Optional model override (rarely set; defaults follow chat/route.ts:594-600
   * precedence — appeal > trial > paid).
   */
  modelOverride?: string;
}

export type ChatStreamEvent =
  | { type: "delta"; text: string }
  | { type: "done"; iterations: number; model: string; totalMs: number }
  | { type: "error"; message: string };

/**
 * Frozen Phase 1 contract. Implemented by mobile-auth-wirer.
 */
export interface ApiClient {
  // Auth lifecycle
  sendOtp(email: string): Promise<void>;
  verifyOtp(email: string, otp: string): Promise<VerifyOtpResult>;
  /** Force a refresh of the access token. Normally called internally on 401. */
  refresh(): Promise<void>;
  signOut(): Promise<void>;
  isAuthenticated(): boolean;
  /**
   * Returns the current authenticated user (Cognito sub + email) or null
   * if not signed in. Consumers use this to bootstrap profile state and to
   * supply `user_id` when calling `LocalDataDAL` write methods.
   */
  getCurrentUser(): { userId: string; email: string } | null;
  /**
   * Cold-launch session restore. If a stored access token exists AND the
   * session cap (NIST 800-63B) has NOT elapsed, hydrate the signed-in
   * user from the supplied local-profile identity and return true; the app
   * then skips the sign-in screen for a returning user — no new OTP. If no
   * token exists or the cap elapsed, any stale tokens are cleared and false
   * is returned (caller routes to sign-in). Does not hit the network; token
   * validity is proven on the first authed request (silent refresh on 401).
   */
  restoreSession(user: { userId: string; email: string }): Promise<boolean>;
  /** Subscribe to "tokens cleared, must re-sign-in" events. Returns unsubscribe. */
  onSignInRequired(handler: () => void): () => void;

  // REST
  apiGet<T>(path: string, options?: ApiRequestOptions): Promise<T>;
  apiPost<T>(path: string, body: unknown, options?: ApiRequestOptions): Promise<T>;
  apiPatch<T>(path: string, body: unknown, options?: ApiRequestOptions): Promise<T>;
  apiDelete<T>(path: string, options?: ApiRequestOptions): Promise<T>;

  /**
   * SSE — chat-only. Returns an async iterable; the consumer drives the
   * iteration and decides when to stop reading (e.g., on user abort).
   */
  chat(input: ChatTurnInput, options?: ApiRequestOptions): AsyncIterable<ChatStreamEvent>;
}

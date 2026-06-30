/**
 * httpClient — fetch wrapper for Phase 1 mobile.
 *
 * Responsibilities:
 *   - Resolve `API_BASE_URL` from @/config/env.
 *   - Stamp every request with `X-Client-Type: mobile` so the backend
 *     returns body tokens (not Set-Cookie) on auth routes, and so any
 *     future server-side branching on client type works uniformly.
 *   - Attach `Authorization: Bearer <token>` whenever a token is present
 *     in the secure tokenStore. (Auth-bearing requests do nothing else
 *     special — the backend prefers the header over the cookie per
 *     `app/src/lib/auth-server.ts:50-61`.)
 *   - Default 30s timeout; 330s for /api/chat (matches web's
 *     `useChat.ts` AbortController per the root CLAUDE.md). Caller can
 *     override via `ApiRequestOptions.timeoutMs`.
 *   - On 401, try silent refresh, retry the original request once, and
 *     if refresh fails OR the 30-day session cap has fired, clear tokens
 *     and fire `onSignInRequired`.
 *
 * Single-flight refresh: concurrent 401s share one in-flight refresh
 * Promise so we don't stampede /api/auth/refresh.
 *
 * Logging: NEVER log token values or refresh values. Boolean presence
 * only ("had access token: true").
 */

import type { ApiRequestOptions } from "@/contracts";
import { API_BASE_URL } from "@/config/env";

import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  getSessionIssuedAt,
  setTokens,
} from "./tokenStore";
import { isSessionExpired } from "./sessionPolicy";

/** Default HTTP timeout for non-chat requests. */
const DEFAULT_TIMEOUT_MS = 30_000;
/** Chat / inference timeout — matches the web's 330s ceiling. */
export const CHAT_TIMEOUT_MS = 330_000;

const CHAT_PATH = "/api/chat";
const REFRESH_PATH = "/api/auth/refresh";

export interface HttpRequest {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  /** Already-stringified JSON body, or undefined for no body. */
  body?: string;
  /** Optional extra headers (merged after defaults; cannot override Authorization here). */
  headers?: Record<string, string>;
  options?: ApiRequestOptions;
}

export interface HttpClientHooks {
  /** Invoked when tokens have been cleared and the user must re-sign-in. */
  onSignInRequired: () => void;
}

/**
 * Single-flight refresh: only one /api/auth/refresh call may be inflight
 * at a time. All concurrent callers await the same promise.
 */
let refreshInFlight: Promise<boolean> | null = null;

/**
 * Attempt a silent refresh. Returns true on success (tokens updated),
 * false on failure (caller should clear and bounce to sign-in).
 *
 * Uses the mobile-body path: sends `{ refresh_token }` and reads
 * `{ access_token, expires_in }` from the JSON body. NEVER reads
 * cookies; mobile never receives Set-Cookie from the backend.
 */
async function performRefresh(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return false;

      // Enforce 30-day cap BEFORE issuing the refresh — if the session is
      // already past the cap, we must not silently extend it.
      const sessionIssuedAt = await getSessionIssuedAt();
      if (isSessionExpired(sessionIssuedAt)) return false;

      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        DEFAULT_TIMEOUT_MS,
      );

      let response: Response;
      try {
        response = await fetch(`${API_BASE_URL}${REFRESH_PATH}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Client-Type": "mobile",
          },
          body: JSON.stringify({ refresh_token: refreshToken }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      // 5xx: transient — keep tokens, surface as failure for this call;
      // the next request will retry.
      if (response.status >= 500) return false;

      // 4xx (typically 401 with invalid/revoked refresh): hard fail.
      if (!response.ok) return false;

      const data = (await response.json().catch(() => null)) as
        | { access_token?: unknown; expires_in?: unknown }
        | null;
      const newAccess =
        data && typeof data.access_token === "string" ? data.access_token : null;
      if (!newAccess) return false;

      await setTokens({ access: newAccess });
      return true;
    } catch {
      // Network / abort / parse error → treat as transient failure.
      return false;
    }
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

/**
 * Core request runner. Returns the raw `Response` so callers can handle
 * SSE streaming vs JSON parsing themselves.
 *
 * @param request   The HTTP request to issue.
 * @param hooks     Callbacks for "must sign in again" events.
 * @param noRetry   Internal flag — set true on the retry after a refresh.
 */
export async function rawRequest(
  request: HttpRequest,
  hooks: HttpClientHooks,
  noRetry: boolean = false,
): Promise<Response> {
  const isChat = request.path.startsWith(CHAT_PATH);
  const timeoutMs =
    request.options?.timeoutMs ?? (isChat ? CHAT_TIMEOUT_MS : DEFAULT_TIMEOUT_MS);

  // 30-day session cap — checked before EVERY request, not only on 401.
  // If expired, clear and bounce immediately.
  const sessionIssuedAt = await getSessionIssuedAt();
  if (isSessionExpired(sessionIssuedAt)) {
    await clearTokens();
    hooks.onSignInRequired();
    throw new SessionExpiredError();
  }

  const accessToken = await getAccessToken();

  const headers: Record<string, string> = {
    "X-Client-Type": "mobile",
    ...(request.body !== undefined ? { "Content-Type": "application/json" } : {}),
    ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    ...(request.headers ?? {}),
  };

  // Honor external abort signals AND impose the per-request timeout.
  const internalController = new AbortController();
  const externalSignal = request.options?.signal;
  const onExternalAbort = () => internalController.abort();
  if (externalSignal) {
    if (externalSignal.aborted) internalController.abort();
    else externalSignal.addEventListener("abort", onExternalAbort);
  }
  const timeoutId = setTimeout(() => internalController.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${request.path}`, {
      method: request.method,
      headers,
      body: request.body,
      signal: internalController.signal,
    });
  } finally {
    clearTimeout(timeoutId);
    if (externalSignal) {
      externalSignal.removeEventListener("abort", onExternalAbort);
    }
  }

  // 401 → silent refresh → retry once (unless suppressed).
  if (
    response.status === 401 &&
    !noRetry &&
    !request.options?.noRefreshOn401 &&
    request.path !== REFRESH_PATH
  ) {
    const refreshed = await performRefresh();
    if (refreshed) {
      return rawRequest(request, hooks, /* noRetry */ true);
    }
    // Refresh failed — clear tokens and bounce.
    await clearTokens();
    hooks.onSignInRequired();
  }

  return response;
}

/**
 * Issue a request and parse the JSON body as `T`.
 *
 * Throws `HttpError` for non-2xx responses (the caller can inspect
 * `status` and the parsed `body` for an `error` field).
 */
export async function requestJson<T>(
  request: HttpRequest,
  hooks: HttpClientHooks,
): Promise<T> {
  const response = await rawRequest(request, hooks);
  const contentType = response.headers.get("content-type") ?? "";
  const parsed: unknown = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : null;

  if (!response.ok) {
    throw new HttpError(response.status, parsed);
  }
  return parsed as T;
}

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: unknown,
  ) {
    super(`HTTP ${status}`);
    this.name = "HttpError";
  }
}

export class SessionExpiredError extends Error {
  constructor() {
    super("Session expired (30-day NIST 800-63B cap exceeded).");
    this.name = "SessionExpiredError";
  }
}

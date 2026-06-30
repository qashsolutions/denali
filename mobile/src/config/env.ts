/**
 * Runtime env — Phase 1 mobile.
 *
 * Reads non-secret values that were baked into the build via
 * `app.config.ts` `extra` (surfaced through `expo-constants`).
 *
 * Only `API_BASE_URL` lives here. Secrets (Cognito client IDs, Bedrock
 * credentials, encryption keys) MUST NOT be added. The mobile app talks
 * exclusively to the Next.js backend; that backend holds all secrets.
 */

import Constants from "expo-constants";

type ExtraConfig = {
  apiBaseUrl?: string;
  refreshTokenLifetimeDays?: number;
};

const extra: ExtraConfig =
  (Constants.expoConfig?.extra as ExtraConfig | undefined) ?? {};

/** Base URL for all backend calls. Defaults to staging until overridden. */
export const API_BASE_URL: string =
  extra.apiBaseUrl ?? "https://staging.denali.health";

/**
 * Cognito refresh-token lifetime in days. Sourced from `app.config.ts`
 * `extra.refreshTokenLifetimeDays` (per-env value baked into the build).
 *
 * Currently 30 days on both prod (`us-east-1_bA3bcPcy2`) and staging
 * (`us-east-1_elz0mvqwh`) — verified 2026-06-04. NEVER hardcode this
 * value in mobile/src/auth/**; always read it from here so the per-env
 * Cognito setting is the single source of truth.
 *
 * Note: this is the absolute refresh-token lifetime, NOT the NIST 800-63B
 * session cap. The session cap is enforced separately by `sessionPolicy.ts`
 * (30 days on mobile) and is unrelated to Cognito's refresh-token TTL.
 */
export const REFRESH_TOKEN_LIFETIME_DAYS: number =
  typeof extra.refreshTokenLifetimeDays === "number" &&
  Number.isFinite(extra.refreshTokenLifetimeDays) &&
  extra.refreshTokenLifetimeDays > 0
    ? extra.refreshTokenLifetimeDays
    : 30;

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
};

const extra: ExtraConfig =
  (Constants.expoConfig?.extra as ExtraConfig | undefined) ?? {};

/** Base URL for all backend calls. Defaults to staging until overridden. */
export const API_BASE_URL: string =
  extra.apiBaseUrl ?? "https://staging.denali.health";

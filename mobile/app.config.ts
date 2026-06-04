import type { ExpoConfig } from "expo/config";

/**
 * Expo app config — Phase 1 mobile.
 *
 * `extra` carries non-secret runtime config (e.g., API_BASE_URL) into the
 * built app. Read it via `expo-constants` (see src/config/env.ts).
 *
 * Secrets MUST NOT live here. Cognito client IDs, Bedrock keys, encryption
 * keys, etc. never appear in the mobile build. The mobile app talks only
 * to the Next.js backend over HTTPS; that backend holds the secrets.
 */
const config: ExpoConfig = {
  name: "Denali",
  slug: "denali-mobile",
  scheme: "denali",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "health.denali.mobile",
  },
  android: {
    package: "health.denali.mobile",
  },
  extra: {
    // Default to staging until the build pipeline injects per-channel overrides.
    apiBaseUrl: process.env.DENALI_API_BASE_URL ?? "https://staging.denali.health",
  },
};

export default config;

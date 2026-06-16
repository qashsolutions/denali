import type { ExpoConfig } from "expo/config";
import { withAndroidManifest, type ConfigPlugin } from "expo/config-plugins";

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
    // ZK invariant: never let Google auto-backup exfiltrate the on-device
    // secrets. expo-secure-store maps to EncryptedSharedPreferences on Android,
    // which (unlike iOS ThisDeviceOnly) could otherwise be swept into Google
    // Account backup — leaking the SQLCipher key AND the backup recovery key
    // off-device, defeating zero-knowledge. (D16 privacy review, 2026-06-14.)
    allowBackup: false,
  },
  // Plugins:
  //   expo-sqlite with useSQLCipher: true compiles the native module against
  //   SQLCipher (AES-256). The DB passphrase is supplied at open time via
  //   `PRAGMA key = '<hex>'`; the key itself is generated and stored on-device
  //   by src/db/keystore.ts (CSPRNG → expo-secure-store). Invariant 3: the key
  //   is never derived from any Cognito/server-issued value.
  //   expo-secure-store backs Keychain (iOS) / Keystore (Android) and holds
  //   the SQLCipher key. Phase 1 mobile/CLAUDE.md, invariants 2 & 3.
  plugins: [
    [
      "expo-sqlite",
      {
        useSQLCipher: true,
      },
    ],
    "expo-secure-store",
    [
      // Biometric / device-credential launch gate (D15). The plugin injects
      // the iOS NSFaceIDUsageDescription; Android needs no manifest change.
      "expo-local-authentication",
      {
        faceIDPermission:
          "Denali uses Face ID to unlock your health information on this device.",
      },
    ],
    [
      // Local-only check-in reminders (O7). The plugin injects the iOS
      // NSUserNotificationUsageDescription and wires the Android channel
      // permissions. Push tokens are never requested — scheduling is
      // calendar-trigger only (scheduleNotificationAsync, no server).
      // Invariant 1: nothing leaves the device.
      "expo-notifications",
      {
        icon: "./assets/notification-icon.png",
        color: "#4B9E9E",
        iosDisplayInForeground: false,
        requestPermissionsOnLaunch: false,
      },
    ],
  ],
  extra: {
    // Default to staging until the build pipeline injects per-channel overrides.
    apiBaseUrl: process.env.DENALI_API_BASE_URL ?? "https://staging.denali.health",
    // Cognito refresh-token lifetime in days. Sourced from per-env Cognito
    // user pool configuration (currently 30 days for both prod and staging,
    // verified 2026-06-04 against `us-east-1_bA3bcPcy2` /
    // `us-east-1_elz0mvqwh`). Surfaced via `extra` so the value can change
    // without code rework — auth-wirer never hardcodes 30 days.
    refreshTokenLifetimeDays: process.env.DENALI_REFRESH_TOKEN_LIFETIME_DAYS
      ? Number(process.env.DENALI_REFRESH_TOKEN_LIFETIME_DAYS)
      : 30,
  },
};

/**
 * Android 11+ (API 30) package-visibility fix for the 988 crisis hand-off.
 *
 * Without an explicit `<queries>` entry, `Linking.canOpenURL("tel:988")` /
 * `("sms:988")` return false on Android 11+, so the Crisis988Modal's
 * "Call 988" / "Text 988" buttons hit their fallback ("Cannot open…")
 * instead of launching the dialer / SMS app — i.e. the crisis hand-off is
 * broken on every modern Android device. This plugin declares the schemes
 * so `canOpenURL` resolves them. iOS is unaffected (tel/sms are system
 * schemes there). The modal itself is untouched. (2026-06-11)
 */
const withDialerSmsQueries: ConfigPlugin = (cfg) =>
  withAndroidManifest(cfg, (c) => {
    const manifest = c.modResults.manifest;
    manifest.queries ??= [];
    const queries = (manifest.queries[0] ??= {});
    queries.intent ??= [];
    for (const scheme of ["tel", "sms", "smsto"]) {
      const exists = queries.intent.some(
        (i) =>
          i.action?.[0]?.$?.["android:name"] ===
            "android.intent.action.VIEW" &&
          i.data?.[0]?.$?.["android:scheme"] === scheme,
      );
      if (!exists) {
        queries.intent.push({
          action: [{ $: { "android:name": "android.intent.action.VIEW" } }],
          data: [{ $: { "android:scheme": scheme } }],
        });
      }
    }
    return c;
  });

export default withDialerSmsQueries(config);

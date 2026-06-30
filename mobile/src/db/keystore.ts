/**
 * SQLCipher Keystore — owned by mobile-local-data-modeler (Wave 1).
 *
 * Generates and persists the SQLCipher passphrase used to encrypt the
 * on-device SQLite database. The passphrase is:
 *
 *   • 256 bits from a cryptographic CSPRNG (expo-crypto / Web Crypto on web,
 *     SecRandomCopyBytes on iOS, SecureRandom on Android — all FIPS-grade);
 *   • generated on first launch only;
 *   • stored in the OS secure enclave via expo-secure-store
 *     (Keychain on iOS with kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
 *     Keystore-backed EncryptedSharedPreferences on Android);
 *   • returned as a lowercase hex string for `PRAGMA key = 'x...'`.
 *
 * INVARIANT 3 ("login ≠ encryption key"): this module must NEVER derive the
 * key from a Cognito sub, JWT, refresh token, email, or any other value
 * issued by the backend. It imports nothing from `@/auth/**` and nothing
 * that touches the network. The conformance test in
 * `__tests__/keystore.test.ts` enforces this by spying on the module graph.
 *
 * If reading from secure storage fails (e.g., user revoked Keychain access),
 * the module FAILS CLOSED — it does NOT fall back to AsyncStorage or any
 * plaintext store. The caller (db/open.ts) surfaces the error to the user.
 */

import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

/**
 * Key name used inside Keychain / Keystore. Distinct from any auth-token
 * key the auth-wirer might use; the secure store is keyed by string label
 * so namespace collisions are impossible across modules.
 */
const KEYSTORE_LABEL = "denali.sqlcipher.key.v1";

/**
 * 256 bits → 32 bytes → 64 lowercase hex chars.
 * SQLCipher accepts a raw hex blob via `PRAGMA key = "x'<hex>'"`; the open
 * module quotes the string accordingly.
 */
const KEY_BYTES = 32;

/**
 * Random byte source. We delegate to the platform CSPRNG only — never
 * Math.random, never a time-based seed.
 *
 * We use `expo-crypto`'s synchronous `getRandomBytes()` which is a thin
 * wrapper around the platform CSPRNG on every supported target:
 *   - iOS: SecRandomCopyBytes (Security framework)
 *   - Android: java.security.SecureRandom
 *   - Web / Node test env: crypto.getRandomValues (Web Crypto)
 *
 * We do NOT use `globalThis.crypto.getRandomValues` directly: RN 0.85 +
 * Hermes does NOT polyfill it globally, so that path threw on iOS on
 * first launch (validated on iPhone 16 Pro simulator, 2026-06-05).
 * expo-crypto is the contract-stable platform CSPRNG path.
 */
function getRandomBytes(length: number): Uint8Array {
  if (typeof Crypto.getRandomBytes !== "function") {
    throw new Error(
      "[keystore] No CSPRNG available on this platform — refusing to " +
        "generate an SQLCipher key without a secure source of randomness.",
    );
  }
  return Crypto.getRandomBytes(length);
}

function bytesToHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

/**
 * Returns the SQLCipher passphrase, generating + persisting it on first run.
 *
 * Stable across launches — same key forever for a given install. Calling
 * this multiple times within one session is safe and cheap (Keychain reads
 * are sub-millisecond on warm devices).
 *
 * Throws if SecureStore is unavailable. NEVER returns a derived or
 * predictable value.
 */
export async function getOrCreateDbKey(): Promise<string> {
  // Probe first. Some platforms (notably web) don't support SecureStore;
  // we surface that clearly rather than silently falling back.
  const isAvailable = await SecureStore.isAvailableAsync();
  if (!isAvailable) {
    throw new Error(
      "[keystore] expo-secure-store is not available on this platform. " +
        "SQLCipher requires a hardware-backed secret store; refusing to " +
        "proceed without one.",
    );
  }

  const existing = await SecureStore.getItemAsync(KEYSTORE_LABEL, {
    // iOS: only readable while the device is unlocked; do not sync to iCloud.
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  if (existing && existing.length === KEY_BYTES * 2) {
    return existing;
  }

  // First launch (or corrupted entry) — generate fresh.
  const fresh = bytesToHex(getRandomBytes(KEY_BYTES));
  await SecureStore.setItemAsync(KEYSTORE_LABEL, fresh, {
    keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  return fresh;
}

/**
 * Test-only — wipes the stored key. NOT exported from any production code
 * path. Used by unit tests to exercise the "first launch" branch.
 */
export async function __dangerouslyResetKeyForTests(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYSTORE_LABEL);
}

/**
 * Test-only constant exposure for assertion ("this is the label we read").
 * Real callers never need to know the label name.
 */
export const __KEYSTORE_LABEL_FOR_TESTS = KEYSTORE_LABEL;

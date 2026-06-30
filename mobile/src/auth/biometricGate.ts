/**
 * biometricGate — local-authentication launch gate (decision D15).
 *
 * On cold launch, AFTER a session is restored from SecureStore, the app asks
 * the OS to confirm the device owner is present (Face ID / Touch ID /
 * fingerprint, falling back to the device passcode). This is the continuous
 * presence control that lets the OTP re-prompt cap stretch to 30 days (see
 * `sessionPolicy.ts`). It is NOT a replacement for OTP — new sign-ins still
 * verify the email factor through Cognito.
 *
 * Boundary rules (HIPAA / Phase-1 invariant 3):
 *   - NEVER touches the SQLCipher key or any token. It only asks the OS
 *     "is the owner present?" and returns a verdict.
 *   - When the device has no biometric/credential enrolled, the verdict is
 *     "unavailable" and the caller proceeds — we cannot enforce a lock the
 *     device itself lacks, and must not brick the user.
 *   - The native call is wrapped here so it can be mocked in unit tests; the
 *     routing decision for each verdict lives in RootNavigator.
 */
import * as LocalAuthentication from "expo-local-authentication";

export type BiometricVerdict = "passed" | "failed" | "unavailable";

/** True only when the device has biometric hardware AND an enrolled credential. */
export async function isBiometricAvailable(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    if (!hasHardware) return false;
    return await LocalAuthentication.isEnrolledAsync();
  } catch {
    // Any native error → treat as unavailable (fail-open to the existing
    // session-restore behavior; we never fail-closed into a brick).
    return false;
  }
}

/**
 * Run the launch gate.
 *   - "unavailable" — no enrolled biometric/credential; the caller proceeds.
 *   - "passed"      — the OS confirmed the owner.
 *   - "failed"      — owner not confirmed (cancel, lockout, mismatch); the
 *                     caller shows the locked screen.
 */
export async function runBiometricGate(): Promise<BiometricVerdict> {
  if (!(await isBiometricAvailable())) return "unavailable";
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: "Unlock Denali",
      cancelLabel: "Cancel",
      // Allow the device passcode as a fallback so a user whose face/finger
      // fails can still get in without a full re-OTP.
      disableDeviceFallback: false,
    });
    return result.success ? "passed" : "failed";
  } catch {
    return "failed";
  }
}

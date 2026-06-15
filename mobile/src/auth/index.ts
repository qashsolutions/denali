/**
 * Phase 1 mobile — auth barrel.
 *
 * Public surface for the auth-wirer module. Consumers prefer the contract
 * (`import type { ApiClient } from "@/contracts"`) + the provider hook
 * (`import { useApiClient } from "@/auth"`).
 *
 * Lower-level helpers (tokenStore, sessionPolicy, httpClient) are not
 * re-exported here — they are implementation details. Tests reach in via
 * direct module imports.
 */

export {
  createApiClient,
  HttpError,
  SessionExpiredError,
} from "./ApiClientImpl";
export { ApiClientProvider, useApiClient } from "./ApiClientProvider";
export { isBiometricAvailable, runBiometricGate } from "./biometricGate";
export type { BiometricVerdict } from "./biometricGate";

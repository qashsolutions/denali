/**
 * Consent gate helpers — pure.
 *
 * The three toggles (health_data_ai, health_data_storage, analytics) live in
 * the server's `consent_preferences` table and are read by mobile via
 * `apiClient.apiGet<ConsentResponse>("/api/consent")`. See
 * app/src/app/api/consent/route.ts.
 *
 * ────────────────────────────────────────────────────────────────────────
 * health_data_storage interpretation (Phase 1 mobile)
 * ────────────────────────────────────────────────────────────────────────
 *
 * The agent spec calls this out as needing reconciliation. Phase 1 mobile
 * adopts the following reading:
 *
 *   - On-device SQLCipher storage is INTRINSIC to the mobile build. The
 *     user opted into encrypted local persistence by installing the app
 *     and authenticating. Toggling `health_data_storage = false` would
 *     mean "wipe my device data" which is destructive UX, not what the
 *     toggle currently semantically means on web.
 *   - On web, `health_data_storage` gates IndexedDB writes (offline cache
 *     of FHIR + diabetes log). The analogous mobile concept is **cloud
 *     backup** — a Phase 2 feature. In Phase 1 there is no cloud backup,
 *     so the toggle has no enforcement point in mobile onboarding.
 *   - The main thread will record this decision in
 *     docs/history/phase-1-mobile-decisions.md after Wave 2 lands.
 *
 * Therefore: onboarding does NOT block on `health_data_storage`. The
 * toggle is read and shown, but does not gate any onboarding action.
 *
 * ────────────────────────────────────────────────────────────────────────
 * health_data_ai — the load-bearing gate for downstream Bedrock
 * ────────────────────────────────────────────────────────────────────────
 *
 * Onboarding screens themselves make NO Bedrock calls. They write only to
 * the local DAL and PATCH /api/profile. But Wave 3 timeline insights + the
 * chat surface will gate on this; we surface the current state during
 * onboarding so the user can opt in before reaching a surface that needs
 * it. The pure `canCallAi(consent)` helper is the single answer-key for
 * any future caller deciding whether a Bedrock-bound request is allowed.
 *
 * ────────────────────────────────────────────────────────────────────────
 * analytics
 * ────────────────────────────────────────────────────────────────────────
 *
 * Onboarding currently emits zero telemetry. If a future revision adds a
 * `trackEvent` call from these screens, gate via `canEmitAnalytics(consent)`.
 */

import type { ConsentGetResponse } from "@/api/routeContracts";

/**
 * The three-boolean consent map. Aliased to the network contract's inner
 * shape (src/api/routeContracts.ts) so there is a single source of truth —
 * a route-side rename now breaks this and its consumers at typecheck.
 */
export type ConsentState = ConsentGetResponse["consent"];

/** Full GET /api/consent envelope — alias of the network contract. */
export type ConsentApiResponse = ConsentGetResponse;

export const DEFAULT_CONSENT: ConsentState = {
  health_data_ai: false,
  health_data_storage: false,
  analytics: false,
};

/**
 * Strict `=== true` check — mirrors the web's allow-list pattern in
 * app/src/lib/fhir/context.ts and app/src/lib/skills-loader.ts. Anything
 * other than the literal `true` (null, undefined, false, "true") is OFF.
 */
export function canCallAi(consent: ConsentState | null | undefined): boolean {
  return consent != null && consent.health_data_ai === true;
}

/**
 * Strict `=== true` check for analytics. Mirrors
 * app/src/lib/conversation-service.ts behavior.
 */
export function canEmitAnalytics(
  consent: ConsentState | null | undefined,
): boolean {
  return consent != null && consent.analytics === true;
}

/**
 * consentToggle — pure helper for SettingsScreen.
 *
 * Encapsulates the `/api/consent` write shape so the screen layer stays
 * declarative and the toggle behavior is testable in node env. The body
 * shape is dictated by `app/src/app/api/consent/route.ts`, which reads
 * `{ consentType, granted }` (camelCase — same as the web client in
 * `app/src/hooks/useConsent.ts`). This helper is the single point of
 * truth for the mobile mapping.
 *
 * 2026-06-10 fix: the body key was `consent_type` (snake_case) and the
 * verb hit a PUT-only route via PATCH — both diverged from the real
 * route, so every save failed (405, then 400). The route now also
 * accepts PATCH (alias for PUT); the body key is corrected to
 * `consentType` here.
 *
 * D10 (mobile decision): three toggles surface in Settings —
 *   - health_data_ai      — enforced at chat + parse-report.
 *   - health_data_storage — Phase 2 cloud backup gate; INERT in Phase 1.
 *   - analytics           — enforced wherever analytics emit (Phase 2).
 *
 * The PUT call is the same for all three — the difference is the copy
 * shown alongside each toggle. The copy lives in the screen; this helper
 * stays type-only / behavior-only.
 */

import type { ApiClient } from "@/contracts";

export type ConsentType =
  | "health_data_ai"
  | "health_data_storage"
  | "analytics";

export interface ConsentPutBody {
  consentType: ConsentType;
  granted: boolean;
}

/**
 * Build the body the mobile client sends to `/api/consent`. Key is
 * `consentType` (camelCase) to match the route's destructure. Exported
 * as a pure function so unit tests don't need a live ApiClient.
 */
export function buildConsentPatchBody(
  type: ConsentType,
  granted: boolean,
): ConsentPutBody {
  return { consentType: type, granted };
}

/**
 * Apply a toggle change via the injected ApiClient. The web route uses
 * PUT semantics ("upsert this consent preference"), so we mirror that
 * verb for symmetry with `app/src/app/api/consent/route.ts`.
 *
 * Returns the API's response (typed as `unknown` because the route
 * returns metadata that mobile doesn't currently consume — keeps this
 * narrow).
 */
export async function applyConsentToggle(
  client: ApiClient,
  type: ConsentType,
  granted: boolean,
): Promise<unknown> {
  // The route accepts PATCH (alias for PUT) so the mobile ApiClient —
  // whose frozen contract exposes apiPatch but no apiPut — can write
  // consent with the same auth/validation/audit handler the web PUT uses.
  return client.apiPatch("/api/consent", buildConsentPatchBody(type, granted));
}

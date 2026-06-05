/**
 * consentToggle — pure helper for SettingsScreen.
 *
 * Encapsulates the `/api/consent` PUT shape so the screen layer stays
 * declarative and the toggle behavior is testable in node env. The PUT
 * body shape is dictated by `app/src/app/api/consent/route.ts` —
 * `{consent_type, granted}` per type — and this helper is the single
 * point of truth for the mobile mapping.
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
  consent_type: ConsentType;
  granted: boolean;
}

/**
 * Build the PATCH body the mobile client sends to `/api/consent`.
 * Exported as a pure function so unit tests don't need a live ApiClient.
 */
export function buildConsentPatchBody(
  type: ConsentType,
  granted: boolean,
): ConsentPutBody {
  return { consent_type: type, granted };
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
  // The mobile ApiClient surface exposes apiPatch + apiPost but the
  // existing /api/consent route is PUT. We use apiPatch as the closest
  // analog; the route handler accepts both shapes via the consent_type +
  // granted body. If apiPut is added to ApiClient later, swap here.
  return client.apiPatch("/api/consent", buildConsentPatchBody(type, granted));
}

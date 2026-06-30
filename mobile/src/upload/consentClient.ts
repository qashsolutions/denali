/**
 * Phase 1 mobile — consent gate helper.
 *
 * Wave 2 / mobile-upload-parse-builder.
 *
 * The upload pipeline must NOT call `/api/parse-report` when the user has
 * `health_data_ai === false` (Privacy & Data → AI parsing OFF). The server
 * also enforces this; the client-side gate avoids surfacing extracted text
 * over the wire and keeps the local-first invariant intact even if the
 * server check were ever weakened.
 *
 * This module is intentionally tiny — it fetches consent state via the
 * injected `ApiClient` and returns a boolean. The mobile app does not have
 * an independent consent storage layer; the server `consent_preferences`
 * table is the source of truth.
 *
 * Failure mode: when the call fails (network error, 401, etc.) we return
 * `false` — fail-closed. The UI surfaces "consent state unknown; enable in
 * Settings and try again."
 */

import type { ConsentGetResponse } from "@/api/routeContracts";
import type { ApiClient } from "@/contracts";

const CONSENT_PATH = "/api/consent";

/**
 * Reads the `ConsentGetResponse` contract (`{ consent: {…} }`) — see
 * src/api/routeContracts.ts. `Partial` because a malformed/unknown
 * response must fail closed to `false`. (2026-06-10: the old read parsed
 * `{health_data_ai}`/`{consents:[]}`, which never matched the route, so
 * it returned false unconditionally and Upload always showed "AI off".)
 */
export async function fetchHealthDataAiConsent(
  api: ApiClient,
): Promise<boolean> {
  try {
    const res = await api.apiGet<Partial<ConsentGetResponse>>(CONSENT_PATH);
    return res.consent?.health_data_ai === true;
  } catch {
    return false;
  }
}

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

import type { ApiClient } from "@/contracts";

interface ConsentResponse {
  health_data_ai?: boolean;
  consents?: Array<{ type?: string; granted?: boolean }>;
}

const CONSENT_PATH = "/api/consent";

export async function fetchHealthDataAiConsent(
  api: ApiClient,
): Promise<boolean> {
  try {
    const res = await api.apiGet<ConsentResponse>(CONSENT_PATH);
    // Two shapes are tolerated: the flat `{ health_data_ai: bool }` projection
    // OR the underlying `{ consents: [{type, granted}] }` array. The route
    // returns the latter (see app/src/app/api/consent/route.ts); the former
    // is preserved in case a downstream simplification ships.
    if (typeof res.health_data_ai === "boolean") return res.health_data_ai;
    if (Array.isArray(res.consents)) {
      const row = res.consents.find((c) => c.type === "health_data_ai");
      return row?.granted === true;
    }
    return false;
  } catch {
    return false;
  }
}

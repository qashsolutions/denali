/**
 * Route contracts — the wire shapes mobile exchanges with the Next.js
 * backend, defined ONCE so client modules type against them and pinning
 * tests catch drift.
 *
 * WHY THIS EXISTS
 * ---------------
 * Three production bugs in one session (2026-06-10) all had the same
 * root cause: a mobile client module was written against an *assumed*
 * request/response shape that didn't match the real route, and nothing
 * caught the drift until the screen was exercised on-device:
 *   - consent WRITE sent PATCH + snake_case body vs the route's PUT +
 *     camelCase  → HTTP 405/400.
 *   - consent READ parsed `{health_data_ai}`/`{consents:[]}` vs the
 *     route's `{consent:{…}}`  → always false (Upload "AI off").
 *   - chat sent `{content,history}` vs the route's `{messages}`  → 400.
 *
 * This module is the mobile-side source of truth for those shapes. Each
 * entry cites the `app/` route it mirrors. Client modules import these
 * types; `__tests__/routeContracts.test.ts` pins each client's produced
 * request body / parsed response against them, so a mobile-side change
 * that drifts from the contract fails typecheck or tests.
 *
 * SCOPE / LIMITATION
 * ------------------
 * mobile/ and app/ are separate TS projects, so these types are mirrored
 * by hand (not imported from app/). They catch MOBILE-side drift
 * automatically. An app/-side route change still requires updating this
 * file — the `@see` citations make that a reviewable, findable step
 * rather than a silent on-device failure. (A shared/generated contract
 * package is the heavier option, deferred.)
 *
 * NOT the frozen Phase-1 seam: `mobile/src/contracts/` holds the
 * intra-app contracts (LocalDataDAL / ApiClient / Theme). THIS module is
 * the network wire contract — a different layer, intentionally separate.
 */

import type { ReportType, SexAtBirth, GenderIdentity } from "@/contracts";

// ─── /api/consent ─────────────────────────────────────────────────────────
// @see app/src/app/api/consent/route.ts

/** GET /api/consent → per-type boolean map under a `consent` key. */
export interface ConsentGetResponse {
  consent: {
    health_data_ai: boolean;
    health_data_storage: boolean;
    analytics: boolean;
  };
}

/** Consent type keys (mirror VALID_CONSENT_TYPES in the route). */
export type ConsentType =
  | "health_data_ai"
  | "health_data_storage"
  | "analytics";

/**
 * PUT/PATCH /api/consent body — camelCase `consentType` (NOT snake_case).
 * The route exports PUT (web) + PATCH (mobile alias); both read this shape.
 */
export interface ConsentWriteRequest {
  consentType: ConsentType;
  granted: boolean;
}

// ─── /api/chat ──────────────────────────────────────────────────────────
// @see app/src/app/api/chat/route.ts (POST + handleMobileChat)

/** A chat turn as the route's `messages` array expects it. */
export interface ChatWireMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * POST /api/chat body. The route VALIDATES `messages` (non-empty array)
 * before the mobile dispatch + consent gate — sending `{content,history}`
 * was rejected with 400. `noPersist` stays top-level for the D9 guard.
 */
export interface ChatWireRequest {
  messages: ChatWireMessage[];
  noPersist: true;
  modelOverride?: string;
}

// ─── /api/parse-report ──────────────────────────────────────────────────
// @see app/src/app/api/parse-report/route.ts

/** POST /api/parse-report body — snake_case. */
export interface ParseReportRequest {
  report_type: ReportType;
  extracted_text: string;
  locale?: string;
}

// (Response `{ observations, summary }` is typed by upload/types.ts
//  ParseReportResponse; kept there to avoid duplicating the observation
//  shape. This contract pins the REQUEST, the historically-risky side.)

// ─── /api/profile ─────────────────────────────────────────────────────────
// @see app/src/app/api/profile/route.ts
// NOTE the asymmetry: GET RESPONSE is camelCase; PATCH REQUEST is
// snake_case (the route's allowedKeys). This split is a known drift trap
// — pin both.

/** GET /api/profile → camelCase projection (anonymous → {authenticated:false}). */
export interface ProfileGetResponse {
  authenticated?: boolean;
  email?: string;
  userId?: string;
  plan?: string;
  birthYear?: number | null;
  isOnMedicare?: boolean;
  sexAtBirth?: SexAtBirth | null;
  genderIdentity?: GenderIdentity | null;
}

/**
 * PATCH /api/profile body — snake_case, additive (omitted keys untouched).
 * Only these four keys are in the route's allowedKeys.
 */
export interface ProfilePatchRequest {
  birth_year?: number | null;
  is_on_medicare?: boolean | null;
  sex_at_birth?: SexAtBirth | null;
  gender_identity?: GenderIdentity | null;
}

/**
 * Consent Preferences API
 *
 * GET   /api/consent — return user's consent preferences
 * PUT   /api/consent — update consent preference
 * PATCH /api/consent — mobile alias for PUT (same handler, added 2026-06-10)
 *
 * CMS criteria: Section I.5 (patient consent preferences)
 * Auth via Cognito JWT; data from RDS PostgreSQL.
 */

import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { query } from "@/lib/db";
import { logAudit } from "@/lib/audit";
import { withMetrics } from "@/lib/metrics";
import { AUTH, VALIDATION, SYSTEM } from "@/config/messages";

const VALID_CONSENT_TYPES = [
  "health_data_ai",
  "health_data_storage",
  "analytics",
] as const;

type ConsentType = (typeof VALID_CONSENT_TYPES)[number];

async function _GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: AUTH.SIGN_IN_REQUIRED },
        { status: 401 },
      );
    }

    const result = await query<{ consent_type: string; granted: boolean }>(
      `SELECT consent_type, granted FROM consent_preferences WHERE user_id = $1`,
      [user.userId],
    );

    const consent: Record<string, boolean> = {};
    for (const type of VALID_CONSENT_TYPES) {
      const pref = result.rows.find(
        (p: { consent_type: string; granted: boolean }) =>
          p.consent_type === type,
      );
      consent[type] = pref?.granted ?? false;
    }

    return NextResponse.json({ consent });
  } catch (error) {
    console.error("[Consent] GET error:", error);
    return NextResponse.json(
      { error: SYSTEM.LOAD_PREFERENCES },
      { status: 500 },
    );
  }
}

async function _PUT(request: NextRequest) {
  try {
    const user = await getAuthUser(request);
    if (!user) {
      return NextResponse.json(
        { error: AUTH.SIGN_IN_REQUIRED },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { consentType, granted } = body as {
      consentType: string;
      granted: boolean;
    };

    if (!VALID_CONSENT_TYPES.includes(consentType as ConsentType)) {
      return NextResponse.json(
        { error: VALIDATION.INVALID_PREFERENCE },
        { status: 400 },
      );
    }

    if (typeof granted !== "boolean") {
      return NextResponse.json(
        { error: VALIDATION.INVALID_PREFERENCE },
        { status: 400 },
      );
    }

    const now = new Date().toISOString();

    await query(
      `INSERT INTO consent_preferences (user_id, consent_type, granted, granted_at, revoked_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, consent_type) DO UPDATE
         SET granted = EXCLUDED.granted,
             granted_at = EXCLUDED.granted_at,
             revoked_at = EXCLUDED.revoked_at,
             updated_at = EXCLUDED.updated_at`,
      [
        user.userId,
        consentType,
        granted,
        granted ? now : null,
        granted ? null : now,
        now,
      ],
    );

    logAudit("CONSENT_UPDATED", {
      userId: user.userId,
      resourceType: "consent",
      metadata: { consentType, granted },
      request,
    }).catch(() => {});

    return NextResponse.json({ success: true, consentType, granted });
  } catch (error) {
    console.error("[Consent] PUT error:", error);
    return NextResponse.json(
      { error: SYSTEM.SAVE_PREFERENCE },
      { status: 500 },
    );
  }
}

export const GET = withMetrics(_GET, "/api/consent");
export const PUT = withMetrics(_PUT, "/api/consent");
// PATCH is an alias for PUT (same upsert handler) so the mobile ApiClient,
// whose frozen contract exposes apiPatch but no apiPut, can save consent.
// Web continues to use PUT; both verbs hit the identical auth + validation
// + audit path. Added 2026-06-10 to fix mobile consent-save (was HTTP 405).
export const PATCH = withMetrics(_PUT, "/api/consent");
